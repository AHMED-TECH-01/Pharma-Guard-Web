import { ApiError } from './api-error.js';
import { logger } from './logger.js';

/**
 * Client-facing errors never carry provider details (security audit L-4):
 * PostgREST and GoTrue messages can leak schema, constraint or policy
 * internals to the browser. Details go to the server log instead; the client
 * receives the generic context message.
 */
export function dbError(
  context: string,
  error: { code?: string; message?: string | null } | null | undefined,
): ApiError {
  logger.warn('db_error', {
    context,
    code: error?.code ?? null,
    message: error?.message ?? null,
  });
  return ApiError.internal(`${context}.`);
}
