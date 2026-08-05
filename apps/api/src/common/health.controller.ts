import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RateLimitMiddleware } from './middleware/rate-limit.middleware';

@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rateLimiter: RateLimitMiddleware,
  ) {}

  @Get()
  check() {
    return {
      status: 'ok',
      service: 'intern-project-api',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('ready')
  async ready() {
    await this.prisma.$queryRaw`SELECT 1`;
    const rateLimit = await this.rateLimiter.checkReadiness();
    if (rateLimit.status === 'down' && rateLimit.failureMode === 'closed') {
      throw new ServiceUnavailableException({
        message: 'Rate limit store is unavailable',
        database: 'up',
        rateLimit,
      });
    }
    return {
      status: rateLimit.status === 'up' ? 'ready' : 'ready_degraded',
      service: 'intern-project-api',
      database: 'up',
      rateLimit,
      timestamp: new Date().toISOString(),
    };
  }
}
