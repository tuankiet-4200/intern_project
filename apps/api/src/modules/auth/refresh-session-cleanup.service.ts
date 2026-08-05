import { Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export const REFRESH_SESSION_CLEANUP_LOCK_ID = 541_137_001;
const DAY_MS = 24 * 60 * 60 * 1000;

export type RefreshSessionCleanupResult = {
  acquired: boolean;
  deleted: number;
  batches: number;
};

@Injectable()
export class RefreshSessionCleanupService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(RefreshSessionCleanupService.name);
  private readonly enabled: boolean;
  private readonly intervalMs: number;
  private readonly retentionMs: number;
  private readonly batchSize: number;
  private readonly maxBatches: number;
  private timer?: NodeJS.Timeout;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService,
  ) {
    this.enabled = config.get('REFRESH_SESSION_CLEANUP_ENABLED') !== 'false';
    this.intervalMs = Math.max(
      60_000,
      this.positiveInteger(config.get('REFRESH_SESSION_CLEANUP_INTERVAL_MS'), 6 * 60 * 60 * 1000),
    );
    this.retentionMs = this.positiveInteger(config.get('REFRESH_SESSION_RETENTION_DAYS'), 7) * DAY_MS;
    this.batchSize = Math.min(
      5_000,
      this.positiveInteger(config.get('REFRESH_SESSION_CLEANUP_BATCH_SIZE'), 500),
    );
    this.maxBatches = Math.min(
      100,
      this.positiveInteger(config.get('REFRESH_SESSION_CLEANUP_MAX_BATCHES'), 10),
    );
  }

  onApplicationBootstrap() {
    if (!this.enabled) return;
    void this.cleanupAndLog();
    this.timer = setInterval(() => void this.cleanupAndLog(), this.intervalMs);
    this.timer.unref();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async runCleanup(now = new Date()): Promise<RefreshSessionCleanupResult> {
    const cutoff = new Date(now.getTime() - this.retentionMs);
    return this.prisma.$transaction(async (tx) => {
      const [lock] = await tx.$queryRaw<Array<{ acquired: boolean }>>(
        Prisma.sql`SELECT pg_try_advisory_xact_lock(${REFRESH_SESSION_CLEANUP_LOCK_ID}) AS acquired`,
      );
      if (!lock?.acquired) return { acquired: false, deleted: 0, batches: 0 };

      let deleted = 0;
      let batches = 0;
      for (let index = 0; index < this.maxBatches; index += 1) {
        const rows = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
          WITH candidates AS (
            SELECT id
            FROM refresh_sessions
            WHERE expires_at <= ${cutoff}
               OR (revoked_at IS NOT NULL AND revoked_at <= ${cutoff})
            ORDER BY COALESCE(revoked_at, expires_at), id
            LIMIT ${this.batchSize}
            FOR UPDATE SKIP LOCKED
          )
          DELETE FROM refresh_sessions AS session
          USING candidates
          WHERE session.id = candidates.id
          RETURNING session.id
        `);
        deleted += rows.length;
        batches += 1;
        if (rows.length < this.batchSize) break;
      }
      return { acquired: true, deleted, batches };
    });
  }

  private async cleanupAndLog() {
    try {
      const result = await this.runCleanup();
      if (result.acquired && result.deleted > 0) {
        this.logger.log(JSON.stringify({ event: 'refresh_session_cleanup', ...result }));
      }
    } catch (error) {
      this.logger.error(JSON.stringify({
        event: 'refresh_session_cleanup_error',
        message: error instanceof Error ? error.message : 'Unknown cleanup error',
      }));
    }
  }

  private positiveInteger(value: unknown, fallback: number) {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
  }
}
