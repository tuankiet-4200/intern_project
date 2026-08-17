import { UsePipes, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { AccountStatus } from '@prisma/client';
import type { Server, Socket } from 'socket.io';
import { PrismaService } from '../../prisma/prisma.service';
import { ChatRealtimeService, roomName } from './chat-realtime.service';
import { ChatService } from './chat.service';

type SocketJwt = { sub: string; email: string; role: string; exp: number };

@WebSocketGateway({
  namespace: '/chat',
  cors: { origin: process.env.FRONTEND_URL ?? 'http://localhost:3000', credentials: true },
})
@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
export class ChatGateway implements OnGatewayInit {
  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
    private readonly chat: ChatService,
    private readonly realtime: ChatRealtimeService,
  ) {}

  afterInit(server: Server) {
    server.use(async (client, next) => {
      try {
        const token = typeof client.handshake.auth?.token === 'string' ? client.handshake.auth.token : '';
        const payload = await this.jwt.verifyAsync<SocketJwt>(token);
        const user = await this.prisma.user.findUnique({ where: { id: payload.sub }, select: { status: true } });
        if (!user || user.status !== AccountStatus.ACTIVE) throw new Error('Inactive chat account');
        client.data.userId = payload.sub;
        client.data.jwtExpiresAt = payload.exp * 1000;
        next();
      } catch {
        next(new Error('Unauthorized chat connection'));
      }
    });
    this.realtime.attach(server);
  }

  handleConnection(client: Socket) {
    const expiresAt = Number(client.data.jwtExpiresAt ?? Date.now());
    const remainingMs = Math.max(0, expiresAt - Date.now());
    client.data.expirationTimer = setTimeout(() => client.disconnect(true), remainingMs);
  }

  handleDisconnect(client: Socket) {
    if (client.data.expirationTimer) clearTimeout(client.data.expirationTimer as NodeJS.Timeout);
  }

  @SubscribeMessage('chat:join')
  async join(@ConnectedSocket() client: Socket, @MessageBody() body: { conversationId?: string }) {
    const conversationId = body?.conversationId;
    const userId = client.data.userId as string | undefined;
    if (!userId || !conversationId) return { ok: false };
    await this.chat.assertAccess(userId, conversationId);
    await client.join(roomName(conversationId));
    return { ok: true };
  }

  @SubscribeMessage('chat:leave')
  async leave(@ConnectedSocket() client: Socket, @MessageBody() body: { conversationId?: string }) {
    if (body?.conversationId) await client.leave(roomName(body.conversationId));
    return { ok: true };
  }
}
