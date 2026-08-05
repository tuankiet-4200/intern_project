import { ServiceUnavailableException } from '@nestjs/common';
import { describe, expect, it, jest } from '@jest/globals';
import { HealthController } from './health.controller';

describe('HealthController readiness', () => {
  it('reports ready when PostgreSQL and the limiter store are available', async () => {
    const controller = createController({ store: 'redis', status: 'up', failureMode: 'closed' });

    await expect(controller.ready()).resolves.toEqual(expect.objectContaining({
      status: 'ready',
      database: 'up',
      rateLimit: { store: 'redis', status: 'up', failureMode: 'closed' },
    }));
  });

  it('reports degraded readiness for an explicit fail-open limiter outage', async () => {
    const controller = createController({ store: 'redis', status: 'down', failureMode: 'open' });

    await expect(controller.ready()).resolves.toEqual(expect.objectContaining({
      status: 'ready_degraded',
      database: 'up',
      rateLimit: { store: 'redis', status: 'down', failureMode: 'open' },
    }));
  });

  it('rejects readiness for a fail-closed limiter outage', async () => {
    const controller = createController({ store: 'redis', status: 'down', failureMode: 'closed' });

    await expect(controller.ready()).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});

function createController(rateLimit: { store: 'redis'; status: 'up' | 'down'; failureMode: 'open' | 'closed' }) {
  const prisma = { $queryRaw: jest.fn<() => Promise<unknown>>().mockResolvedValue([{ '?column?': 1 }]) };
  const limiter = { checkReadiness: jest.fn<() => Promise<typeof rateLimit>>().mockResolvedValue(rateLimit) };
  return new HealthController(prisma as never, limiter as never);
}
