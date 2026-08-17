import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ChatAiStatus, ChatSenderType, Prisma, ProductStatus, ShopStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ChatRealtimeService } from './chat-realtime.service';
import { ChatMessageQueryDto, ChatView, SendChatMessageDto } from './dto/chat.dto';
import { DeepSeekService } from './deepseek.service';

const messageInclude = { sender: { select: { id: true, fullName: true } } } as const;

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly deepSeek: DeepSeekService,
    private readonly realtime: ChatRealtimeService,
  ) {}

  async startConversation(customerId: string, shopId: string) {
    const shop = await this.prisma.shop.findUnique({ where: { id: shopId } });
    if (!shop || shop.status !== ShopStatus.APPROVED) throw new NotFoundException('Shop is not available for chat');
    if (shop.ownerId === customerId) throw new BadRequestException('You cannot start a customer chat with your own shop');
    const conversation = await this.prisma.chatConversation.upsert({
      where: { shopId_customerId: { shopId, customerId } },
      update: {},
      create: { shopId, customerId },
      include: {
        shop: { select: { id: true, name: true, slug: true, logoUrl: true, aiChatEnabled: true } },
        customer: { select: { id: true, fullName: true } },
      },
    });
    return { ...conversation, unreadCount: 0, lastMessage: null };
  }

  async list(userId: string, view: ChatView) {
    const conversations = await this.prisma.chatConversation.findMany({
      where: view === ChatView.SHOP ? { shop: { ownerId: userId } } : { customerId: userId },
      include: {
        shop: { select: { id: true, name: true, slug: true, logoUrl: true, aiChatEnabled: true } },
        customer: { select: { id: true, fullName: true } },
        messages: { orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 1, include: messageInclude },
      },
      orderBy: [{ lastMessageAt: 'desc' }, { id: 'desc' }],
      take: 100,
    });

    return Promise.all(conversations.map(async ({ messages, ...conversation }) => {
      const readAt = view === ChatView.SHOP ? conversation.shopLastReadAt : conversation.customerLastReadAt;
      const inboundTypes = view === ChatView.SHOP
        ? [ChatSenderType.CUSTOMER]
        : [ChatSenderType.SHOP, ChatSenderType.AI];
      const unreadCount = await this.prisma.chatMessage.count({
        where: {
          conversationId: conversation.id,
          senderType: { in: inboundTypes },
          createdAt: readAt ? { gt: readAt } : undefined,
        },
      });
      return { ...conversation, unreadCount, lastMessage: messages[0] ?? null };
    }));
  }

  async messages(userId: string, conversationId: string, query: ChatMessageQueryDto) {
    await this.assertAccess(userId, conversationId);
    const rows = await this.prisma.chatMessage.findMany({
      where: { conversationId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      cursor: query.cursor ? { id: query.cursor } : undefined,
      skip: query.cursor ? 1 : 0,
      take: query.limit + 1,
      include: messageInclude,
    });
    const hasMore = rows.length > query.limit;
    const page = rows.slice(0, query.limit);
    return { data: page.reverse(), nextCursor: hasMore ? page[page.length - 1]?.id ?? null : null };
  }

  async send(userId: string, conversationId: string, dto: SendChatMessageDto) {
    const conversation = await this.assertAccess(userId, conversationId);
    const senderType = conversation.customerId === userId ? ChatSenderType.CUSTOMER : ChatSenderType.SHOP;
    const content = dto.content.trim();
    if (!content) throw new BadRequestException('Message cannot be empty');

    const existing = await this.prisma.chatMessage.findUnique({
      where: { conversationId_clientMessageId: { conversationId, clientMessageId: dto.clientMessageId } },
      include: messageInclude,
    });
    if (existing) return existing;

    let message;
    try {
      message = await this.prisma.$transaction(async (tx) => {
        const created = await tx.chatMessage.create({
          data: {
            conversationId,
            senderUserId: userId,
            senderType,
            content,
            clientMessageId: dto.clientMessageId,
            aiStatus: senderType === ChatSenderType.CUSTOMER && conversation.shop.aiChatEnabled
              ? ChatAiStatus.PENDING
              : undefined,
          },
          include: messageInclude,
        });
        await tx.chatConversation.update({
          where: { id: conversationId },
          data: {
            lastMessageAt: created.createdAt,
            ...(senderType === ChatSenderType.CUSTOMER
              ? { customerLastReadAt: created.createdAt }
              : { shopLastReadAt: created.createdAt }),
          },
        });
        return created;
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        return this.prisma.chatMessage.findUniqueOrThrow({
          where: { conversationId_clientMessageId: { conversationId, clientMessageId: dto.clientMessageId } },
          include: messageInclude,
        });
      }
      throw error;
    }

    this.realtime.publishMessage(conversationId, message);
    if (message.aiStatus === ChatAiStatus.PENDING) {
      this.realtime.publishAiStatus(conversationId, message.id, 'PENDING');
      void this.generateAiReply(conversationId, message.id);
    }
    return message;
  }

  async markRead(userId: string, conversationId: string) {
    const conversation = await this.assertAccess(userId, conversationId);
    const now = new Date();
    await this.prisma.chatConversation.update({
      where: { id: conversationId },
      data: conversation.customerId === userId ? { customerLastReadAt: now } : { shopLastReadAt: now },
    });
    return { readAt: now };
  }

  async aiSettings(ownerId: string, shopId: string) {
    const shop = await this.assertShopOwner(ownerId, shopId);
    return { shopId, enabled: shop.aiChatEnabled, configured: this.deepSeek.isConfigured() };
  }

  async updateAiSettings(ownerId: string, shopId: string, enabled: boolean) {
    await this.assertShopOwner(ownerId, shopId);
    if (enabled && !this.deepSeek.isConfigured()) {
      throw new BadRequestException('DEEPSEEK_API_KEY is not configured on the API server');
    }
    const shop = await this.prisma.shop.update({ where: { id: shopId }, data: { aiChatEnabled: enabled } });
    return { shopId, enabled: shop.aiChatEnabled, configured: this.deepSeek.isConfigured() };
  }

  async assertAccess(userId: string, conversationId: string) {
    const conversation = await this.prisma.chatConversation.findUnique({
      where: { id: conversationId },
      include: { shop: { select: { id: true, ownerId: true, name: true, description: true, aiChatEnabled: true, status: true } } },
    });
    if (!conversation) throw new NotFoundException('Chat conversation not found');
    if (conversation.customerId !== userId && conversation.shop.ownerId !== userId) {
      throw new ForbiddenException('You cannot access this chat conversation');
    }
    return conversation;
  }

  private async assertShopOwner(ownerId: string, shopId: string) {
    const shop = await this.prisma.shop.findUnique({ where: { id: shopId } });
    if (!shop) throw new NotFoundException('Shop not found');
    if (shop.ownerId !== ownerId) throw new ForbiddenException('Not your shop');
    return shop;
  }

  private async generateAiReply(conversationId: string, sourceMessageId: string) {
    try {
      const conversation = await this.prisma.chatConversation.findUniqueOrThrow({
        where: { id: conversationId },
        include: { shop: true },
      });
      if (!conversation.shop.aiChatEnabled || conversation.shop.status !== ShopStatus.APPROVED) {
        await this.failAiMessage(sourceMessageId);
        return;
      }
      const [products, history] = await Promise.all([
        this.prisma.product.findMany({
          where: { shopId: conversation.shopId, status: ProductStatus.ACTIVE },
          include: { inventory: true, category: { select: { name: true } } },
          orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
          take: 60,
        }),
        this.prisma.chatMessage.findMany({
          where: { conversationId, createdAt: { lte: new Date() } },
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          take: 20,
          select: { senderType: true, content: true },
        }),
      ]);
      const answer = await this.deepSeek.answer({
        shop: { name: conversation.shop.name, description: conversation.shop.description },
        products,
        history: history.reverse(),
      });
      const aiMessage = await this.prisma.$transaction(async (tx) => {
        const created = await tx.chatMessage.create({
          data: {
            conversationId,
            senderType: ChatSenderType.AI,
            content: answer.content,
            replyToMessageId: sourceMessageId,
            aiModel: answer.model,
            aiPromptTokens: answer.promptTokens,
            aiCompletionTokens: answer.completionTokens,
          },
          include: messageInclude,
        });
        await tx.chatMessage.update({ where: { id: sourceMessageId }, data: { aiStatus: ChatAiStatus.COMPLETED } });
        await tx.chatConversation.update({ where: { id: conversationId }, data: { lastMessageAt: created.createdAt } });
        return created;
      });
      this.realtime.publishAiStatus(conversationId, sourceMessageId, 'COMPLETED');
      this.realtime.publishMessage(conversationId, aiMessage);
    } catch (error) {
      await this.failAiMessage(sourceMessageId);
      this.realtime.publishAiStatus(conversationId, sourceMessageId, 'FAILED');
      this.logger.warn(`AI chat reply failed for message ${sourceMessageId}: ${error instanceof Error ? error.message : 'unknown error'}`);
    }
  }

  private async failAiMessage(messageId: string) {
    await this.prisma.chatMessage.updateMany({
      where: { id: messageId, aiStatus: ChatAiStatus.PENDING },
      data: { aiStatus: ChatAiStatus.FAILED },
    });
  }
}
