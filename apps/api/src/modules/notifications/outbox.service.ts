import { Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NotificationType, OutboxStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

const NOTIFICATION_EVENT = 'notification.requested';

export type NotificationRequest = {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  data?: Prisma.InputJsonValue;
  aggregateType: string;
  aggregateId: string;
};

type NotificationPayload = Omit<NotificationRequest, 'aggregateType' | 'aggregateId'>;

@Injectable()
export class OutboxService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(OutboxService.name);
  private readonly enabled: boolean;
  private readonly intervalMs: number;
  private readonly batchSize: number;
  private timer?: NodeJS.Timeout;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService,
  ) {
    this.enabled = config.get('OUTBOX_WORKER_ENABLED') !== 'false';
    this.intervalMs = Math.max(250, this.positiveInteger(config.get('OUTBOX_WORKER_INTERVAL_MS'), 2_000));
    this.batchSize = Math.min(500, this.positiveInteger(config.get('OUTBOX_WORKER_BATCH_SIZE'), 100));
  }

  onApplicationBootstrap() {
    if (!this.enabled) return;
    void this.processAndLog();
    this.timer = setInterval(() => void this.processAndLog(), this.intervalMs);
    this.timer.unref();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  enqueue(client: Prisma.TransactionClient | PrismaService, request: NotificationRequest) {
    const { aggregateType, aggregateId, ...payload } = request;
    return client.outboxEvent.create({
      data: {
        aggregateType,
        aggregateId,
        eventType: NOTIFICATION_EVENT,
        payload,
      },
    });
  }

  async runOnce(now = new Date()) {
    const candidates = await this.prisma.outboxEvent.findMany({
      where: { status: OutboxStatus.PENDING, availableAt: { lte: now } },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: this.batchSize,
      select: { id: true },
    });
    let processed = 0;
    let failed = 0;
    let skipped = 0;
    for (const candidate of candidates) {
      const result = await this.processOne(candidate.id, now);
      if (result === 'processed') processed += 1;
      else if (result === 'failed') failed += 1;
      else skipped += 1;
    }
    return { processed, failed, skipped };
  }

  private async processOne(eventId: string, now: Date) {
    return this.prisma.$transaction(async (tx) => {
      const [event] = await tx.$queryRaw<Array<{
        id: string;
        event_type: string;
        payload: Prisma.JsonValue;
      }>>(Prisma.sql`
        SELECT id, event_type, payload
        FROM outbox_events
        WHERE id = ${eventId}::uuid
          AND status = 'PENDING'::"OutboxStatus"
          AND available_at <= ${now}
        FOR UPDATE SKIP LOCKED
      `);
      if (!event) return 'skipped' as const;

      try {
        const payload = this.parsePayload(event.event_type, event.payload);
        const recipient = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
          SELECT id
          FROM users
          WHERE id = ${payload.userId}::uuid
          FOR KEY SHARE
        `);
        if (recipient.length === 0) {
          throw new InvalidOutboxPayloadError('Notification recipient no longer exists');
        }
        await tx.notification.upsert({
          where: { outboxEventId: event.id },
          update: {},
          create: {
            outboxEventId: event.id,
            userId: payload.userId,
            type: payload.type,
            title: payload.title,
            message: payload.message,
            data: payload.data,
          },
        });
        await tx.outboxEvent.update({
          where: { id: event.id },
          data: { status: OutboxStatus.PROCESSED, processedAt: now, attempts: { increment: 1 }, lastError: null },
        });
        return 'processed' as const;
      } catch (error) {
        if (error instanceof InvalidOutboxPayloadError) {
          await tx.outboxEvent.update({
            where: { id: event.id },
            data: {
              status: OutboxStatus.FAILED,
              attempts: { increment: 1 },
              lastError: error.message,
            },
          });
          return 'failed' as const;
        }
        throw error;
      }
    });
  }

  private parsePayload(eventType: string, value: Prisma.JsonValue): NotificationPayload {
    if (eventType !== NOTIFICATION_EVENT || !value || Array.isArray(value) || typeof value !== 'object') {
      throw new InvalidOutboxPayloadError('Unsupported outbox event or payload');
    }
    const payload = value as Record<string, Prisma.JsonValue>;
    if (
      typeof payload.userId !== 'string'
      || !UUID_PATTERN.test(payload.userId)
      || typeof payload.title !== 'string'
      || typeof payload.message !== 'string'
      || typeof payload.type !== 'string'
      || !Object.values(NotificationType).includes(payload.type as NotificationType)
    ) {
      throw new InvalidOutboxPayloadError('Notification outbox payload is invalid');
    }
    return {
      userId: payload.userId,
      type: payload.type as NotificationType,
      title: payload.title,
      message: payload.message,
      data: payload.data as Prisma.InputJsonValue | undefined,
    };
  }

  private async processAndLog() {
    try {
      const result = await this.runOnce();
      if (result.processed || result.failed) {
        this.logger.log(JSON.stringify({ event: 'outbox_batch_processed', ...result }));
      }
    } catch (error) {
      this.logger.error(JSON.stringify({
        event: 'outbox_worker_error',
        message: error instanceof Error ? error.message : 'Unknown outbox error',
      }));
    }
  }

  private positiveInteger(value: unknown, fallback: number) {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
  }
}

class InvalidOutboxPayloadError extends Error {}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
