import 'dotenv/config';
import { ConfigService } from '@nestjs/config';
import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { Prisma } from '@prisma/client';
import { randomBytes } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';
import {
  REFRESH_SESSION_CLEANUP_LOCK_ID,
  RefreshSessionCleanupService,
} from './refresh-session-cleanup.service';

describe('RefreshSessionCleanupService integration', () => {
  const prisma = new PrismaService();
  const email = `session-cleanup-${Date.now()}@example.com`;
  let userId: string;

  beforeAll(async () => {
    await prisma.$connect();
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash: 'test-only',
        fullName: 'Session Cleanup Test',
      },
    });
    userId = user.id;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email } });
    await prisma.$disconnect();
  });

  it('deletes only terminal sessions older than retention and preserves recent/active sessions', async () => {
    const now = new Date('2026-08-05T00:00:00.000Z');
    const days = (value: number) => new Date(now.getTime() + value * 24 * 60 * 60 * 1000);
    await prisma.refreshSession.createMany({
      data: [
        session(userId, days(-10)),
        session(userId, days(10), days(-10)),
        session(userId, days(-1)),
        session(userId, days(10)),
      ],
    });
    const service = new RefreshSessionCleanupService(prisma, config({
      REFRESH_SESSION_RETENTION_DAYS: 7,
      REFRESH_SESSION_CLEANUP_BATCH_SIZE: 100,
      REFRESH_SESSION_CLEANUP_MAX_BATCHES: 2,
    }));

    const result = await service.runCleanup(now);
    const remaining = await prisma.refreshSession.findMany({ where: { userId }, orderBy: { expiresAt: 'asc' } });

    expect(result).toEqual({ acquired: true, deleted: 2, batches: 1 });
    expect(remaining).toHaveLength(2);
    expect(remaining.map((item) => item.expiresAt.toISOString())).toEqual([
      days(-1).toISOString(),
      days(10).toISOString(),
    ]);
  });

  it('skips a run while another replica holds the cleanup transaction lock', async () => {
    let announceLock!: () => void;
    let releaseLock!: () => void;
    const lockAcquired = new Promise<void>((resolve) => { announceLock = resolve; });
    const waitForRelease = new Promise<void>((resolve) => { releaseLock = resolve; });
    const holdingTransaction = prisma.$transaction(async (tx) => {
      await tx.$queryRaw(Prisma.sql`
        SELECT true AS acquired
        FROM (SELECT pg_advisory_xact_lock(${REFRESH_SESSION_CLEANUP_LOCK_ID})) AS held_lock
      `);
      announceLock();
      await waitForRelease;
    }, { timeout: 10_000 });
    await lockAcquired;
    const service = new RefreshSessionCleanupService(prisma, config({}));

    try {
      await expect(service.runCleanup()).resolves.toEqual({ acquired: false, deleted: 0, batches: 0 });
    } finally {
      releaseLock();
      await holdingTransaction;
    }
  });
});

function session(userId: string, expiresAt: Date, revokedAt?: Date) {
  return {
    userId,
    expiresAt,
    revokedAt,
    tokenHash: randomBytes(32).toString('hex'),
  };
}

function config(values: Record<string, unknown>) {
  return { get: (key: string) => values[key] } as ConfigService;
}
