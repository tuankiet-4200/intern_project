import type { NextFunction, Request, Response } from 'express';
import { randomUUID } from 'node:crypto';

export const REQUEST_ID_HEADER = 'x-request-id';

export type RequestWithId = Request & { requestId?: string };

const SAFE_REQUEST_ID = /^[A-Za-z0-9._-]{1,100}$/;

export function requestContextMiddleware(request: RequestWithId, response: Response, next: NextFunction) {
  const provided = request.header(REQUEST_ID_HEADER);
  const requestId = provided && SAFE_REQUEST_ID.test(provided) ? provided : randomUUID();
  request.requestId = requestId;
  response.setHeader(REQUEST_ID_HEADER, requestId);
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('X-Frame-Options', 'DENY');
  response.setHeader('Referrer-Policy', 'no-referrer');
  next();
}
