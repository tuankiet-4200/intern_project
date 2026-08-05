import 'dotenv/config';
import { ConfigService } from '@nestjs/config';
import { describe, expect, it, jest } from '@jest/globals';
import { RateLimitMiddleware } from './rate-limit.middleware';

describe('Redis distributed rate limiter integration', () => {
  it('shares one atomic IP quota across two middleware instances', async () => {
    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) throw new Error('REDIS_URL is required for distributed rate limiter integration test');
    const namespace = `test:rate-limit:${Date.now()}:${Math.random().toString(16).slice(2)}`;
    const values = {
      RATE_LIMIT_STORE: 'redis',
      REDIS_URL: redisUrl,
      RATE_LIMIT_MAX: 2,
      RATE_LIMIT_WINDOW_MS: 5_000,
      RATE_LIMIT_FAILURE_MODE: 'closed',
      RATE_LIMIT_KEY_PREFIX: namespace,
    };
    const firstInstance = new RateLimitMiddleware(config(values));
    const secondInstance = new RateLimitMiddleware(config(values));
    const firstNext = jest.fn();
    const secondNext = jest.fn();
    const blockedNext = jest.fn();
    const firstResponse = fakeResponse();
    const secondResponse = fakeResponse();
    const blockedResponse = fakeResponse();

    try {
      await firstInstance.use(fakeRequest('shared-ip', 'redis-1') as never, firstResponse as never, firstNext);
      await secondInstance.use(fakeRequest('shared-ip', 'redis-2') as never, secondResponse as never, secondNext);
      await firstInstance.use(fakeRequest('shared-ip', 'redis-3') as never, blockedResponse as never, blockedNext);

      expect(firstNext).toHaveBeenCalledTimes(1);
      expect(secondNext).toHaveBeenCalledTimes(1);
      expect(blockedNext).not.toHaveBeenCalled();
      expect(blockedResponse.status).toHaveBeenCalledWith(429);
      expect(blockedResponse.json).toHaveBeenCalledWith(expect.objectContaining({
        code: 'TOO_MANY_REQUESTS',
        requestId: 'redis-3',
      }));
      expect(blockedResponse.setHeader).toHaveBeenCalledWith('X-RateLimit-Remaining', 0);

      const anotherIpNext = jest.fn();
      await secondInstance.use(
        fakeRequest('another-ip', 'redis-4') as never,
        fakeResponse() as never,
        anotherIpNext,
      );
      expect(anotherIpNext).toHaveBeenCalledTimes(1);
    } finally {
      await firstInstance.onModuleDestroy();
      await secondInstance.onModuleDestroy();
    }
  });

  it('atomically admits exactly the quota under concurrent load from four instances', async () => {
    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) throw new Error('REDIS_URL is required for distributed rate limiter integration test');
    const namespace = `test:rate-limit-load:${Date.now()}:${Math.random().toString(16).slice(2)}`;
    const values = {
      RATE_LIMIT_STORE: 'redis',
      REDIS_URL: redisUrl,
      RATE_LIMIT_MAX: 50,
      RATE_LIMIT_WINDOW_MS: 5_000,
      RATE_LIMIT_FAILURE_MODE: 'closed',
      RATE_LIMIT_KEY_PREFIX: namespace,
    };
    const instances = Array.from({ length: 4 }, () => new RateLimitMiddleware(config(values)));
    const nextFunctions = Array.from({ length: 100 }, () => jest.fn());
    const responses = Array.from({ length: 100 }, () => fakeResponse());

    try {
      await Promise.all(nextFunctions.map((next, index) => instances[index % instances.length].use(
        fakeRequest('load-test-ip', `load-${index}`) as never,
        responses[index] as never,
        next,
      )));
      expect(nextFunctions.filter((next) => next.mock.calls.length === 1)).toHaveLength(50);
      expect(responses.filter((response) => response.status.mock.calls.some(([status]) => status === 429))).toHaveLength(50);
    } finally {
      await Promise.all(instances.map((instance) => instance.onModuleDestroy()));
    }
  });
});

function config(values: Record<string, unknown>) {
  return { get: (key: string) => values[key] } as ConfigService;
}

function fakeRequest(ip: string, requestId: string) {
  return {
    method: 'GET', path: '/api/products', ip, socket: {},
    originalUrl: '/api/products', requestId,
  };
}

function fakeResponse() {
  const response = { setHeader: jest.fn(), status: jest.fn(), json: jest.fn() };
  response.status.mockReturnValue(response);
  return response;
}
