import { ConfigService } from '@nestjs/config';
import type { NextFunction, Response } from 'express';
import type { RequestWithId } from './request-context.middleware';

type Bucket = { count: number; resetAt: number };

export class RateLimitMiddleware {
  private readonly buckets = new Map<string, Bucket>();
  private readonly limit: number;
  private readonly windowMs: number;
  private requestCount = 0;

  constructor(config: ConfigService) {
    this.limit = this.positiveNumber(config.get('RATE_LIMIT_MAX'), 300);
    this.windowMs = this.positiveNumber(config.get('RATE_LIMIT_WINDOW_MS'), 60_000);
  }

  use(request: RequestWithId, response: Response, next: NextFunction) {
    if (request.method === 'OPTIONS' || request.path === '/api/health') {
      next();
      return;
    }

    const now = Date.now();
    const key = request.ip || request.socket.remoteAddress || 'unknown';
    const current = this.buckets.get(key);
    const bucket = !current || current.resetAt <= now
      ? { count: 0, resetAt: now + this.windowMs }
      : current;
    bucket.count += 1;
    this.buckets.set(key, bucket);

    response.setHeader('X-RateLimit-Limit', this.limit);
    response.setHeader('X-RateLimit-Remaining', Math.max(0, this.limit - bucket.count));
    response.setHeader('X-RateLimit-Reset', Math.ceil(bucket.resetAt / 1000));

    this.requestCount += 1;
    if (this.requestCount % 1000 === 0) this.removeExpiredBuckets(now);

    if (bucket.count > this.limit) {
      response.setHeader('Retry-After', Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)));
      response.status(429).json({
        statusCode: 429,
        code: 'TOO_MANY_REQUESTS',
        message: 'Too many requests; please retry later',
        requestId: request.requestId,
        timestamp: new Date().toISOString(),
        path: request.originalUrl,
      });
      return;
    }

    next();
  }

  private removeExpiredBuckets(now: number) {
    for (const [key, bucket] of this.buckets) {
      if (bucket.resetAt <= now) this.buckets.delete(key);
    }
  }

  private positiveNumber(value: unknown, fallback: number) {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  }
}
