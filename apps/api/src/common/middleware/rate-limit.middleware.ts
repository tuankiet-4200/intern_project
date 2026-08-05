import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import type { NextFunction, Response } from 'express';
import Redis from 'ioredis';
import type { RequestWithId } from './request-context.middleware';

type Bucket = { count: number; resetAt: number };
type FailureMode = 'open' | 'closed';

interface RateLimitStore {
  readonly kind: 'memory' | 'redis';
  consume(key: string, windowMs: number, now: number): Promise<Bucket>;
  ping(): Promise<void>;
  close(): Promise<void>;
}

const REDIS_CONSUME_SCRIPT = `
local count = redis.call('INCR', KEYS[1])
if count == 1 then
  redis.call('PEXPIRE', KEYS[1], ARGV[1])
end
local ttl = redis.call('PTTL', KEYS[1])
return { count, ttl }
`;

class MemoryRateLimitStore implements RateLimitStore {
  readonly kind = 'memory' as const;
  private readonly buckets = new Map<string, Bucket>();
  private requestCount = 0;

  async consume(key: string, windowMs: number, now: number) {
    const current = this.buckets.get(key);
    const bucket = !current || current.resetAt <= now
      ? { count: 0, resetAt: now + windowMs }
      : current;
    bucket.count += 1;
    this.buckets.set(key, bucket);
    this.requestCount += 1;
    if (this.requestCount % 1000 === 0) this.removeExpiredBuckets(now);
    return bucket;
  }

  async close() {}

  async ping() {}

  private removeExpiredBuckets(now: number) {
    for (const [key, bucket] of this.buckets) {
      if (bucket.resetAt <= now) this.buckets.delete(key);
    }
  }
}

class RedisRateLimitStore implements RateLimitStore {
  readonly kind = 'redis' as const;
  private readonly redis: Redis;
  private connectPromise: Promise<void> | null = null;

  constructor(url: string, connectTimeoutMs: number) {
    this.redis = new Redis(url, {
      lazyConnect: true,
      enableOfflineQueue: false,
      connectTimeout: connectTimeoutMs,
      maxRetriesPerRequest: 1,
      retryStrategy: () => null,
    });
    this.redis.on('error', () => undefined);
  }

  async consume(key: string, windowMs: number, now: number) {
    await this.ensureConnected();
    const result = await this.redis.eval(REDIS_CONSUME_SCRIPT, 1, key, windowMs) as [number, number];
    const count = Number(result[0]);
    const ttl = Number(result[1]);
    if (!Number.isFinite(count) || !Number.isFinite(ttl) || ttl < 0) {
      throw new Error('Redis rate limit script returned an invalid result');
    }
    return { count, resetAt: now + ttl };
  }

  async close() {
    this.redis.disconnect(false);
  }

  async ping() {
    await this.ensureConnected();
    await this.redis.ping();
  }

  private async ensureConnected() {
    if (this.redis.status === 'ready') return;
    if (this.connectPromise) {
      await this.connectPromise;
      return;
    }
    if (this.redis.status !== 'wait' && this.redis.status !== 'end') {
      throw new Error(`Redis is not ready (${this.redis.status})`);
    }
    this.connectPromise = this.redis.connect().finally(() => {
      this.connectPromise = null;
    });
    await this.connectPromise;
  }
}

@Injectable()
export class RateLimitMiddleware implements OnModuleDestroy {
  private readonly store: RateLimitStore;
  private readonly limit: number;
  private readonly windowMs: number;
  private readonly failureMode: FailureMode;
  private readonly keyPrefix: string;

  constructor(config: ConfigService) {
    this.limit = this.positiveInteger(config.get('RATE_LIMIT_MAX'), 300);
    this.windowMs = this.positiveInteger(config.get('RATE_LIMIT_WINDOW_MS'), 60_000);
    this.failureMode = config.get('RATE_LIMIT_FAILURE_MODE') === 'closed' ? 'closed' : 'open';
    this.keyPrefix = config.get<string>('RATE_LIMIT_KEY_PREFIX')?.trim() || 'intern-commerce:rate-limit';
    const redisUrl = config.get<string>('REDIS_URL')?.trim();
    const storeType = config.get<string>('RATE_LIMIT_STORE')?.trim() || (redisUrl ? 'redis' : 'memory');
    if (storeType === 'redis') {
      if (!redisUrl) throw new Error('REDIS_URL is required when RATE_LIMIT_STORE=redis');
      this.store = new RedisRateLimitStore(
        redisUrl,
        this.positiveInteger(config.get('RATE_LIMIT_REDIS_CONNECT_TIMEOUT_MS'), 1_000),
      );
    } else if (storeType === 'memory') {
      this.store = new MemoryRateLimitStore();
    } else {
      throw new Error('RATE_LIMIT_STORE must be redis or memory');
    }
  }

  async use(request: RequestWithId, response: Response, next: NextFunction) {
    if (request.method === 'OPTIONS' || ['/api/health', '/api/health/ready'].includes(request.path)) {
      next();
      return;
    }

    const now = Date.now();
    const identity = request.ip || request.socket.remoteAddress || 'unknown';
    const key = `${this.keyPrefix}:${createHash('sha256').update(identity).digest('hex')}`;
    let bucket: Bucket;
    try {
      bucket = await this.store.consume(key, this.windowMs, now);
    } catch (error) {
      console.warn(JSON.stringify({
        event: 'rate_limit_store_error',
        mode: this.failureMode,
        requestId: request.requestId,
        message: error instanceof Error ? error.message : 'Unknown rate limit store error',
      }));
      if (this.failureMode === 'open') {
        response.setHeader('X-RateLimit-Policy', 'bypass');
        next();
        return;
      }
      response.status(503).json({
        statusCode: 503,
        code: 'RATE_LIMIT_UNAVAILABLE',
        message: 'Request protection is temporarily unavailable; please retry later',
        requestId: request.requestId,
        timestamp: new Date().toISOString(),
        path: request.originalUrl,
      });
      return;
    }

    response.setHeader('X-RateLimit-Limit', this.limit);
    response.setHeader('X-RateLimit-Remaining', Math.max(0, this.limit - bucket.count));
    response.setHeader('X-RateLimit-Reset', Math.ceil(bucket.resetAt / 1000));
    response.setHeader('X-RateLimit-Policy', 'enforced');

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

  async onModuleDestroy() {
    await this.store.close();
  }

  async checkReadiness() {
    try {
      await this.store.ping();
      return { store: this.store.kind, status: 'up' as const, failureMode: this.failureMode };
    } catch {
      return { store: this.store.kind, status: 'down' as const, failureMode: this.failureMode };
    }
  }

  private positiveInteger(value: unknown, fallback: number) {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
  }
}
