import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { logger } from '../utils/logger.js';

/**
 * Request context: assigns a request id and emits one structured log line
 * per request (TRD §24). Passwords/tokens/cookies are never logged (the
 * logger redacts sensitive keys defensively).
 */
export function requestContext(req: Request, res: Response, next: NextFunction): void {
  req.id = randomUUID();
  res.setHeader('X-Request-Id', req.id);

  const startedAt = Date.now();

  res.on('finish', () => {
    if (req.path === '/api/v1/health') return; // avoid log noise
    logger.info('http_request', {
      reqId: req.id,
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      durationMs: Date.now() - startedAt,
      userId: req.auth?.userId,
      pharmacyId: req.pharmacyId,
    });
  });

  next();
}
