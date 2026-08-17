import { Injectable } from '@nestjs/common';
import type { Server } from 'socket.io';

@Injectable()
export class ChatRealtimeService {
  private server?: Server;

  attach(server: Server) {
    this.server = server;
  }

  publishMessage(conversationId: string, message: unknown) {
    this.server?.to(roomName(conversationId)).emit('chat:message', { conversationId, message });
  }

  publishAiStatus(conversationId: string, messageId: string, status: 'PENDING' | 'COMPLETED' | 'FAILED') {
    this.server?.to(roomName(conversationId)).emit('chat:ai-status', { conversationId, messageId, status });
  }
}

export function roomName(conversationId: string) {
  return `chat:${conversationId}`;
}
