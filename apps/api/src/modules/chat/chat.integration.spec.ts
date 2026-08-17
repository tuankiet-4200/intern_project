import 'dotenv/config';
import { ConfigService } from '@nestjs/config';
import { ShopStatus, UserRole } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it, jest } from '@jest/globals';
import { PrismaService } from '../../prisma/prisma.service';
import { ChatRealtimeService } from './chat-realtime.service';
import { ChatService } from './chat.service';
import { ChatView } from './dto/chat.dto';
import { DeepSeekService } from './deepseek.service';

describe('Shop chat integration', () => {
  const prisma = new PrismaService();
  const deepSeek = new DeepSeekService({ get: () => undefined } as unknown as ConfigService);
  const realtime = new ChatRealtimeService();
  const chat = new ChatService(prisma, deepSeek, realtime);
  const nonce = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const emails = [`chat-customer-${nonce}@example.com`, `chat-vendor-${nonce}@example.com`, `chat-stranger-${nonce}@example.com`];
  let customerId: string;
  let vendorId: string;
  let strangerId: string;
  let shopId: string;
  let setupComplete = false;

  beforeAll(async () => {
    await prisma.$connect();
    const [customer, vendor, stranger] = await Promise.all([
      prisma.user.create({ data: { email: emails[0], passwordHash: 'test-only', fullName: 'Chat Customer' } }),
      prisma.user.create({ data: { email: emails[1], passwordHash: 'test-only', fullName: 'Chat Vendor', role: UserRole.VENDOR } }),
      prisma.user.create({ data: { email: emails[2], passwordHash: 'test-only', fullName: 'Chat Stranger' } }),
    ]);
    customerId = customer.id;
    vendorId = vendor.id;
    strangerId = stranger.id;
    const shop = await prisma.shop.create({ data: { ownerId: vendorId, name: `Chat Shop ${nonce}`, slug: `chat-shop-${nonce}`, status: ShopStatus.APPROVED } });
    shopId = shop.id;
    setupComplete = true;
  });

  afterAll(async () => {
    if (setupComplete) {
      await prisma.shop.deleteMany({ where: { id: shopId } });
      await prisma.user.deleteMany({ where: { email: { in: emails } } });
    }
    await prisma.$disconnect();
  });

  it('creates one customer/shop conversation and makes message retries idempotent', async () => {
    const conversation = await chat.startConversation(customerId, shopId);
    const duplicate = await chat.startConversation(customerId, shopId);
    expect(duplicate.id).toBe(conversation.id);

    const clientMessageId = '9f238027-dacf-4204-b1fc-5278ace34d11';
    const first = await chat.send(customerId, conversation.id, { content: 'Shop tư vấn giúp mình', clientMessageId });
    const retry = await chat.send(customerId, conversation.id, { content: 'Shop tư vấn giúp mình', clientMessageId });
    expect(retry.id).toBe(first.id);
    await expect(prisma.chatMessage.count({ where: { conversationId: conversation.id } })).resolves.toBe(1);

    const customerInbox = await chat.list(customerId, ChatView.CUSTOMER);
    const vendorInbox = await chat.list(vendorId, ChatView.SHOP);
    expect(customerInbox).toHaveLength(1);
    expect(vendorInbox[0]).toEqual(expect.objectContaining({ unreadCount: 1 }));
    await chat.markRead(vendorId, conversation.id);
    await expect(chat.list(vendorId, ChatView.SHOP)).resolves.toEqual([
      expect.objectContaining({ unreadCount: 0 }),
    ]);
  });

  it('enforces participant and shop ownership boundaries', async () => {
    const conversation = await chat.startConversation(customerId, shopId);
    await expect(chat.messages(strangerId, conversation.id, { limit: 20 })).rejects.toThrow('cannot access');
    await expect(chat.startConversation(vendorId, shopId)).rejects.toThrow('own shop');
    await expect(chat.updateAiSettings(strangerId, shopId, true)).rejects.toThrow('Not your shop');
    await expect(chat.updateAiSettings(vendorId, shopId, true)).rejects.toThrow('DEEPSEEK_API_KEY');
  });

  it('publishes a saved message to the conversation room', async () => {
    const publish = jest.spyOn(realtime, 'publishMessage');
    const conversation = await chat.startConversation(customerId, shopId);
    const message = await chat.send(vendorId, conversation.id, {
      content: 'Shop đã nhận được tin nhắn',
      clientMessageId: 'f901e1f0-27d0-47b3-a35d-cdf77105dc5d',
    });
    expect(publish).toHaveBeenCalledWith(conversation.id, expect.objectContaining({ id: message.id }));
  });
});
