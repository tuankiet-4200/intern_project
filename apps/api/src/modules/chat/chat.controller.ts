import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { AuthUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { ChatService } from './chat.service';
import {
  ChatConversationQueryDto,
  ChatMessageQueryDto,
  SendChatMessageDto,
  StartConversationDto,
  UpdateShopAiDto,
} from './dto/chat.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.CUSTOMER, UserRole.VENDOR)
@Controller('chat')
export class ChatController {
  constructor(private readonly chat: ChatService) {}

  @Get('conversations')
  list(@CurrentUser() user: AuthUser, @Query() query: ChatConversationQueryDto) {
    return this.chat.list(user.sub, query.view);
  }

  @Post('conversations')
  start(@CurrentUser() user: AuthUser, @Body() dto: StartConversationDto) {
    return this.chat.startConversation(user.sub, dto.shopId);
  }

  @Get('shops/:shopId/ai')
  aiSettings(@CurrentUser() user: AuthUser, @Param('shopId', ParseUUIDPipe) shopId: string) {
    return this.chat.aiSettings(user.sub, shopId);
  }

  @Patch('shops/:shopId/ai')
  updateAiSettings(
    @CurrentUser() user: AuthUser,
    @Param('shopId', ParseUUIDPipe) shopId: string,
    @Body() dto: UpdateShopAiDto,
  ) {
    return this.chat.updateAiSettings(user.sub, shopId, dto.enabled);
  }

  @Get('conversations/:conversationId/messages')
  messages(
    @CurrentUser() user: AuthUser,
    @Param('conversationId', ParseUUIDPipe) conversationId: string,
    @Query() query: ChatMessageQueryDto,
  ) {
    return this.chat.messages(user.sub, conversationId, query);
  }

  @Post('conversations/:conversationId/messages')
  send(
    @CurrentUser() user: AuthUser,
    @Param('conversationId', ParseUUIDPipe) conversationId: string,
    @Body() dto: SendChatMessageDto,
  ) {
    return this.chat.send(user.sub, conversationId, dto);
  }

  @Patch('conversations/:conversationId/read')
  markRead(
    @CurrentUser() user: AuthUser,
    @Param('conversationId', ParseUUIDPipe) conversationId: string,
  ) {
    return this.chat.markRead(user.sub, conversationId);
  }
}
