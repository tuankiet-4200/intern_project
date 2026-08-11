import 'dotenv/config';
import { ConfigService } from '@nestjs/config';
import { NotificationType, OutboxStatus } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from './notifications.service';
import { OutboxService } from './outbox.service';

describe('Notifications and outbox integration', () => {
  const prisma = new PrismaService();
  const outbox = new OutboxService(prisma, config({ OUTBOX_WORKER_ENABLED: 'false', OUTBOX_WORKER_BATCH_SIZE: 20 }));
  const notifications = new NotificationsService(prisma);
  const emails = [`notification-a-${Date.now()}@example.com`, `notification-b-${Date.now()}@example.com`];
  const outboxIds: string[] = [];
  let userA: string;
  let userB: string;

  beforeAll(async () => {
    await prisma.$connect();
    const users = await Promise.all(emails.map((email, index) => prisma.user.create({
      data: { email, passwordHash: 'test-only', fullName: `Notification User ${index}` },
    })));
    [userA, userB] = users.map((user) => user.id);
  });

  afterAll(async () => {
    await prisma.notification.deleteMany({ where: { outboxEventId: { in: outboxIds } } });
    await prisma.outboxEvent.deleteMany({ where: { id: { in: outboxIds } } });
    await prisma.user.deleteMany({ where: { email: { in: emails } } });
    await prisma.$disconnect();
  });

  it('delivers an outbox event idempotently and enforces inbox ownership/read state', async () => {
    const event = await prisma.$transaction((tx) => outbox.enqueue(tx, {
      userId: userA,
      type: NotificationType.ORDER_PLACED,
      title: 'Order placed',
      message: 'Order ORD-TEST was created.',
      data: { parentOrderId: 'order-test', orderNumber: 'ORD-TEST' },
      aggregateType: 'ParentOrder',
      aggregateId: 'order-test',
    }));
    outboxIds.push(event.id);

    await expect(outbox.runOnce()).resolves.toEqual({ processed: 1, failed: 0, skipped: 0 });
    await expect(outbox.runOnce()).resolves.toEqual({ processed: 0, failed: 0, skipped: 0 });

    const page = await notifications.list(userA, { page: 1, limit: 20, unreadOnly: true });
    expect(page.total).toBe(1);
    expect(page.unread).toBe(1);
    expect(page.data[0]).toEqual(expect.objectContaining({ outboxEventId: event.id, readAt: null }));
    await expect(notifications.markRead(userB, page.data[0].id)).rejects.toThrow('Notification not found');
    await notifications.markRead(userA, page.data[0].id);
    await expect(notifications.unreadCount(userA)).resolves.toEqual({ count: 0 });

    const storedEvent = await prisma.outboxEvent.findUniqueOrThrow({ where: { id: event.id } });
    expect(storedEvent.status).toBe(OutboxStatus.PROCESSED);
    expect(storedEvent.attempts).toBe(1);
  });

  it('quarantines malformed notification events instead of blocking the queue', async () => {
    const event = await prisma.outboxEvent.create({
      data: {
        aggregateType: 'Test',
        aggregateId: 'malformed',
        eventType: 'notification.requested',
        payload: { title: 'Missing recipient and type' },
      },
    });
    outboxIds.push(event.id);

    await expect(outbox.runOnce()).resolves.toEqual({ processed: 0, failed: 1, skipped: 0 });
    const failed = await prisma.outboxEvent.findUniqueOrThrow({ where: { id: event.id } });
    expect(failed.status).toBe(OutboxStatus.FAILED);
    expect(failed.lastError).toContain('payload is invalid');
  });

  it('quarantines an event whose recipient was deleted before delivery', async () => {
    const deletedUser = await prisma.user.create({
      data: {
        email: `notification-deleted-${Date.now()}@example.com`,
        passwordHash: 'test-only',
        fullName: 'Deleted Notification User',
      },
    });
    const event = await prisma.$transaction((tx) => outbox.enqueue(tx, {
      userId: deletedUser.id,
      type: NotificationType.ORDER_PLACED,
      title: 'Order placed',
      message: 'This recipient will be deleted.',
      aggregateType: 'Test',
      aggregateId: 'deleted-recipient',
    }));
    outboxIds.push(event.id);
    await prisma.user.delete({ where: { id: deletedUser.id } });

    await expect(outbox.runOnce()).resolves.toEqual({ processed: 0, failed: 1, skipped: 0 });
    const failed = await prisma.outboxEvent.findUniqueOrThrow({ where: { id: event.id } });
    expect(failed.status).toBe(OutboxStatus.FAILED);
    expect(failed.lastError).toContain('recipient no longer exists');
  });
});

function config(values: Record<string, unknown>) {
  return { get: (key: string) => values[key] } as ConfigService;
}
