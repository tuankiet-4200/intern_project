import { ConfigService } from '@nestjs/config';
import { describe, expect, it, jest } from '@jest/globals';
import { RateLimitMiddleware } from './rate-limit.middleware';

describe('RateLimitMiddleware', () => {
  it('returns a structured 429 response after the configured memory-store limit', async () => {
    const middleware = new RateLimitMiddleware(config({
      RATE_LIMIT_STORE: 'memory',
      RATE_LIMIT_MAX: 2,
      RATE_LIMIT_WINDOW_MS: 60_000,
    }));
    const request = fakeRequest();
    const response = fakeResponse();
    const next = jest.fn();

    await middleware.use(request as never, response as never, next);
    await middleware.use(request as never, response as never, next);
    await middleware.use(request as never, response as never, next);

    expect(next).toHaveBeenCalledTimes(2);
    expect(response.status).toHaveBeenCalledWith(429);
    expect(response.json).toHaveBeenCalledWith(expect.objectContaining({
      code: 'TOO_MANY_REQUESTS',
      requestId: 'request-1',
    }));
    expect(response.setHeader).toHaveBeenCalledWith('X-RateLimit-Policy', 'enforced');
  });

  it('bypasses liveness and readiness without touching the store', async () => {
    const middleware = new RateLimitMiddleware(config({ RATE_LIMIT_STORE: 'memory', RATE_LIMIT_MAX: 1 }));
    const response = fakeResponse();
    const next = jest.fn();
    await middleware.use({ ...fakeRequest(), path: '/api/health/ready' } as never, response as never, next);
    await middleware.use({ ...fakeRequest(), path: '/api/health/ready' } as never, response as never, next);
    expect(next).toHaveBeenCalledTimes(2);
    expect(response.status).not.toHaveBeenCalled();
  });

  it('supports explicit fail-open and fail-closed behavior when Redis is unavailable', async () => {
    const warning = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const open = new RateLimitMiddleware(config({ RATE_LIMIT_STORE: 'memory', RATE_LIMIT_FAILURE_MODE: 'open' }));
    const closed = new RateLimitMiddleware(config({ RATE_LIMIT_STORE: 'memory', RATE_LIMIT_FAILURE_MODE: 'closed' }));
    const failingStore = () => ({
      kind: 'redis',
      consume: jest.fn<() => Promise<never>>().mockRejectedValue(new Error('Redis unavailable')),
      ping: jest.fn<() => Promise<never>>().mockRejectedValue(new Error('Redis unavailable')),
      close: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
    });
    Reflect.set(open, 'store', failingStore());
    Reflect.set(closed, 'store', failingStore());
    const openResponse = fakeResponse();
    const closedResponse = fakeResponse();
    const openNext = jest.fn();
    const closedNext = jest.fn();

    await open.use(fakeRequest() as never, openResponse as never, openNext);
    await closed.use(fakeRequest() as never, closedResponse as never, closedNext);

    expect(openNext).toHaveBeenCalledTimes(1);
    expect(openResponse.setHeader).toHaveBeenCalledWith('X-RateLimit-Policy', 'bypass');
    expect(closedNext).not.toHaveBeenCalled();
    expect(closedResponse.status).toHaveBeenCalledWith(503);
    expect(closedResponse.json).toHaveBeenCalledWith(expect.objectContaining({
      code: 'RATE_LIMIT_UNAVAILABLE',
    }));
    await open.onModuleDestroy();
    await closed.onModuleDestroy();
    warning.mockRestore();
  });
});

function config(values: Record<string, unknown>) {
  return { get: (key: string) => values[key] } as ConfigService;
}

function fakeRequest() {
  return {
    method: 'GET', path: '/api/products', ip: '127.0.0.1', socket: {},
    originalUrl: '/api/products', requestId: 'request-1',
  };
}

function fakeResponse() {
  const response = {
    setHeader: jest.fn(),
    status: jest.fn(),
    json: jest.fn(),
  };
  response.status.mockReturnValue(response);
  return response;
}
