import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import type { Response } from 'express';
import type { RequestWithId } from '../middleware/request-context.middleware';

type ErrorResponse = {
  statusCode?: number;
  error?: string;
  message?: string | string[];
  [key: string]: unknown;
};

@Catch()
export class StructuredExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(StructuredExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const context = host.switchToHttp();
    const request = context.getRequest<RequestWithId>();
    const response = context.getResponse<Response>();
    const status = exception instanceof HttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;
    const raw = exception instanceof HttpException ? exception.getResponse() : null;
    const parsed = this.parseResponse(raw, status);

    if (status >= 500) {
      const error = exception instanceof Error ? exception : new Error(String(exception));
      this.logger.error(JSON.stringify({
        event: 'unhandled_exception',
        requestId: request.requestId,
        method: request.method,
        path: request.originalUrl,
        message: error.message,
        stack: error.stack,
      }));
    }

    response.status(status).json({
      statusCode: status,
      code: HttpStatus[status] ?? 'HTTP_ERROR',
      message: parsed.message,
      ...(parsed.details ? { details: parsed.details } : {}),
      requestId: request.requestId,
      timestamp: new Date().toISOString(),
      path: request.originalUrl,
    });
  }

  private parseResponse(raw: string | object | null, status: number) {
    if (typeof raw === 'string') return { message: raw };
    if (raw && typeof raw === 'object') {
      const value = raw as ErrorResponse;
      const details = { ...value };
      delete details.message;
      delete details.statusCode;
      delete details.error;
      return {
        message: value.message ?? HttpStatus[status] ?? 'Request failed',
        details: Object.keys(details).length ? details : undefined,
      };
    }
    return {
      message: status >= 500 ? 'Internal server error' : HttpStatus[status] ?? 'Request failed',
    };
  }
}
