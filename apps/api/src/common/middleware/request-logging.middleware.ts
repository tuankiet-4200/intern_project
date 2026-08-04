import { Logger } from '@nestjs/common';
import type { NextFunction, Response } from 'express';
import type { AuthUser } from '../decorators/current-user.decorator';
import type { RequestWithId } from './request-context.middleware';

type AuthenticatedRequest = RequestWithId & { user?: AuthUser };

const logger = new Logger('HttpRequest');

export function requestLoggingMiddleware(
  request: AuthenticatedRequest,
  response: Response,
  next: NextFunction,
) {
  const startedAt = Date.now();
  response.once('finish', () => {
    const payload = JSON.stringify({
      event: 'http_request',
      requestId: request.requestId,
      method: request.method,
      path: request.originalUrl,
      statusCode: response.statusCode,
      durationMs: Date.now() - startedAt,
      userId: request.user?.sub,
      role: request.user?.role,
    });
    if (response.statusCode >= 500) logger.error(payload);
    else if (response.statusCode >= 400) logger.warn(payload);
    else logger.log(payload);
  });
  next();
}
