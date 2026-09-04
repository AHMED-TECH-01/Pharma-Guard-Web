/**
 * API contract types (code-standards.md §5).
 * Every API response uses one of these two envelopes.
 */

export type ApiErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'RATE_LIMITED'
  | 'OCR_FAILED'
  | 'EXTERNAL_SERVICE_ERROR'
  | 'INTERNAL_ERROR';

export interface ApiErrorBody {
  code: ApiErrorCode;
  message: string;
  /** Optional structured details (e.g. field-level validation issues). */
  details?: unknown;
}

export interface ApiSuccess<TData> {
  success: true;
  data: TData;
}

export interface ApiFailure {
  success: false;
  error: ApiErrorBody;
}

export type ApiResponse<TData> = ApiSuccess<TData> | ApiFailure;

export interface PageMeta {
  page: number;
  pageSize: number;
  total: number;
}

export interface Paginated<TItem> {
  items: TItem[];
  meta: PageMeta;
}
