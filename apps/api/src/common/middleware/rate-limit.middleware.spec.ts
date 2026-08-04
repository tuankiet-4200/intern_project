import { ConfigService } from '@nestjs/config';
import { describe, expect, it, jest } from '@jest/globals';
import { RateLimitMiddleware } from './rate-limit.middleware';

describe('RateLimitMiddleware', () => {
  it('returns a structured 429 response after the configured limit', () => {
    const config = { get: (key: string) => key === 'RATE_LIMIT_MAX' ? 2 : 60_000 } as ConfigService;
    const middleware = new RateLimitMiddleware(config);
    const request = {
      method: 'GET', path: '/api/products', ip: '127.0.0.1', socket: {},
      originalUrl: '/api/products', requestId: 'request-1',
    };
    const response = {
      setHeader: jest.fn(),
      status: jest.fn(),
      json: jest.fn(),
    };
    response.status.mockReturnValue(response);
    const next = jest.fn();

    middleware.use(request as never, response as never, next);
    middleware.use(request as never, response as never, next);
    middleware.use(request as never, response as never, next);

    expect(next).toHaveBeenCalledTimes(2);
    expect(response.status).toHaveBeenCalledWith(429);
    expect(response.json).toHaveBeenCalledWith(expect.objectContaining({
      code: 'TOO_MANY_REQUESTS',
      requestId: 'request-1',
    }));
  });
});
