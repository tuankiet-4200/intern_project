import { JwtService } from '@nestjs/jwt';
import { AccountStatus } from '@prisma/client';
import { describe, expect, it, jest } from '@jest/globals';
import type { Server, Socket } from 'socket.io';
import { PrismaService } from '../../prisma/prisma.service';
import { ChatGateway } from './chat.gateway';
import { ChatRealtimeService } from './chat-realtime.service';
import { ChatService } from './chat.service';

type NamespaceMiddleware = (socket: Socket, next: (error?: Error) => void) => Promise<void>;

describe('ChatGateway authentication middleware', () => {
  it('sets the authenticated user before allowing the socket to connect', async () => {
    const verifyAsync = jest.fn<JwtService['verifyAsync']>().mockResolvedValue({
      sub: 'user-id', email: 'customer@example.com', role: 'CUSTOMER', exp: Math.floor(Date.now() / 1000) + 60,
    });
    const findUnique = jest.fn(() => Promise.resolve({ status: AccountStatus.ACTIVE }));
    const realtime = new ChatRealtimeService();
    const gateway = new ChatGateway(
      { verifyAsync } as unknown as JwtService,
      { user: { findUnique } } as unknown as PrismaService,
      {} as ChatService,
      realtime,
    );
    let middleware: NamespaceMiddleware | undefined;
    const server = {
      use: (registered: NamespaceMiddleware) => { middleware = registered; },
    } as unknown as Server;
    gateway.afterInit(server);
    const socket = { handshake: { auth: { token: 'valid-token' } }, data: {} } as unknown as Socket;
    let nextError: Error | undefined;

    await middleware?.(socket, (error) => { nextError = error; });

    expect(nextError).toBeUndefined();
    expect(socket.data).toEqual(expect.objectContaining({ userId: 'user-id' }));
    expect(verifyAsync).toHaveBeenCalledWith('valid-token');
  });

  it('rejects a socket when JWT verification fails', async () => {
    const gateway = new ChatGateway(
      { verifyAsync: jest.fn(() => Promise.reject(new Error('invalid token'))) } as unknown as JwtService,
      { user: { findUnique: jest.fn() } } as unknown as PrismaService,
      {} as ChatService,
      new ChatRealtimeService(),
    );
    let middleware: NamespaceMiddleware | undefined;
    gateway.afterInit({ use: (registered: NamespaceMiddleware) => { middleware = registered; } } as unknown as Server);
    const socket = { handshake: { auth: { token: 'bad-token' } }, data: {} } as unknown as Socket;
    let nextError: Error | undefined;

    await middleware?.(socket, (error) => { nextError = error; });

    expect(nextError?.message).toBe('Unauthorized chat connection');
    expect(socket.data.userId).toBeUndefined();
  });
});
