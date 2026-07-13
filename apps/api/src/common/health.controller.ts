import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class HealthController {
  @Get()
  check() {
    return {
      status: 'ok',
      service: 'intern-project-api',
      timestamp: new Date().toISOString(),
    };
  }
}
