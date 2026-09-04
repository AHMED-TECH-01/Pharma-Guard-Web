import type { ApiErrorCode } from '@pharmaguard/types';

/**
 * Typed application error carrying a stable error code + HTTP status
 * (code-standards.md §13). The error middleware converts these into the
 * standard failure envelope without leaking internals.
 */
export class ApiError extends Error {
  constructor(
    public readonly code: ApiErrorCode,
    public readonly status: number,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  static validation(message = 'Invalid request', details?: unknown): ApiError {
    return new ApiError('VALIDATION_ERROR', 422, message, details);
  }

  static badRequest(message = 'Malformed request', details?: unknown): ApiError {
    return new ApiError('VALIDATION_ERROR', 400, message, details);
  }

  static unauthorized(message = 'Authentication required'): ApiError {
    return new ApiError('UNAUTHORIZED', 401, message);
  }

  static forbidden(message = 'You do not have permission to perform this action'): ApiError {
    return new ApiError('FORBIDDEN', 403, message);
  }

  static notFound(message = 'Resource not found'): ApiError {
    return new ApiError('NOT_FOUND', 404, message);
  }

  static conflict(message = 'Resource already exists', details?: unknown): ApiError {
    return new ApiError('CONFLICT', 409, message, details);
  }

  static rateLimited(message = 'Too many requests. Please try again later'): ApiError {
    return new ApiError('RATE_LIMITED', 429, message);
  }

  static ocrFailed(message = 'OCR processing failed', details?: unknown): ApiError {
    return new ApiError('OCR_FAILED', 502, message, details);
  }

  static externalService(message = 'An external service is unavailable'): ApiError {
    return new ApiError('EXTERNAL_SERVICE_ERROR', 502, message);
  }

  static internal(message = 'Something went wrong'): ApiError {
    return new ApiError('INTERNAL_ERROR', 500, message);
  }
}
