import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as cookieParser from 'cookie-parser';
import { StructuredExceptionFilter } from './common/filters/structured-exception.filter';
import { RateLimitMiddleware } from './common/middleware/rate-limit.middleware';
import { requestContextMiddleware } from './common/middleware/request-context.middleware';
import { requestLoggingMiddleware } from './common/middleware/request-logging.middleware';

export function configureApp(app: INestApplication) {
  const config = app.get(ConfigService);
  const expressApp = app.getHttpAdapter().getInstance();
  expressApp.disable('x-powered-by');
  const trustedProxyHops = Number(config.get('TRUST_PROXY_HOPS') ?? 0);
  if (Number.isInteger(trustedProxyHops) && trustedProxyHops > 0) {
    expressApp.set('trust proxy', trustedProxyHops);
  }

  app.setGlobalPrefix('api');
  app.use(requestContextMiddleware);
  app.use(requestLoggingMiddleware);
  const rateLimiter = app.get(RateLimitMiddleware);
  app.use(rateLimiter.use.bind(rateLimiter));
  app.use(cookieParser());
  app.enableCors({
    origin: config.get<string>('FRONTEND_URL') ?? 'http://localhost:3000',
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new StructuredExceptionFilter());
}
