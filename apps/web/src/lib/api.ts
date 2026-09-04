import type { ApiResponse, AuthUserContext, UserRole } from '@pharmaguard/types';

/**
 * Typed browser client for the PharmaGuard API (apps/api).
 *
 * - Wraps the standard response envelope (code-standards.md §5).
 * - Always sends credentials so the API's HttpOnly session cookies
 *   (apps/api/src/config/cookies.ts) are attached automatically.
 * - Sends X-Pharmacy-Id when the caller has an active pharmacy context,
 *   matching the API's CORS allowed headers.
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

export class ApiClientError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiClientError';
  }
}

interface RequestOptions {
  body?: unknown;
  pharmacyId?: string;
  signal?: AbortSignal;
}

type Method = 'GET' | 'POST' | 'PATCH' | 'DELETE';

async function parseEnvelope<TData>(response: Response): Promise<TData> {
  let envelope: ApiResponse<TData>;
  try {
    envelope = (await response.json()) as ApiResponse<TData>;
  } catch {
    throw new ApiClientError(
      'INTERNAL_ERROR',
      'Unexpected non-JSON response from the server.',
      response.status,
    );
  }

  if (!envelope.success) {
    throw new ApiClientError(
      envelope.error.code,
      envelope.error.message,
      response.status,
      envelope.error.details,
    );
  }
  return envelope.data;
}

async function request<TData>(method: Method, path: string, options: RequestOptions = {}): Promise<TData> {
  const headers = new Headers({ 'Content-Type': 'application/json' });
  if (options.pharmacyId) {
    headers.set('X-Pharmacy-Id', options.pharmacyId);
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      credentials: 'include',
      signal: options.signal,
    });
  } catch (cause) {
    // Network failure / aborted request.
    throw new ApiClientError('EXTERNAL_SERVICE_ERROR', 'Unable to reach the server.', 0, cause);
  }

  return parseEnvelope<TData>(response);
}

export interface UploadOptions {
  file: File;
  /** Multipart field name expected by the API; defaults to "image". */
  fieldName?: string;
  pharmacyId?: string;
  signal?: AbortSignal;
}

/**
 * Multipart upload (AI Scan). The browser sets the Content-Type boundary
 * itself, so no explicit Content-Type header is sent here.
 */
async function upload<TData>(path: string, options: UploadOptions): Promise<TData> {
  const headers = new Headers();
  if (options.pharmacyId) {
    headers.set('X-Pharmacy-Id', options.pharmacyId);
  }

  const form = new FormData();
  form.append(options.fieldName ?? 'image', options.file);

  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers,
      body: form,
      credentials: 'include',
      signal: options.signal,
    });
  } catch (cause) {
    throw new ApiClientError('EXTERNAL_SERVICE_ERROR', 'Unable to reach the server.', 0, cause);
  }

  return parseEnvelope<TData>(response);
}

export const api = {
  get<TData>(path: string, options?: Omit<RequestOptions, 'body'>): Promise<TData> {
    return request<TData>('GET', path, options);
  },
  post<TData>(path: string, body?: unknown, options?: Omit<RequestOptions, 'body'>): Promise<TData> {
    return request<TData>('POST', path, { ...options, body });
  },
  patch<TData>(path: string, body?: unknown, options?: Omit<RequestOptions, 'body'>): Promise<TData> {
    return request<TData>('PATCH', path, { ...options, body });
  },
  delete<TData>(path: string, options?: Omit<RequestOptions, 'body'>): Promise<TData> {
    return request<TData>('DELETE', path, options);
  },
  upload<TData>(path: string, options: UploadOptions): Promise<TData> {
    return upload<TData>(path, options);
  },
};

export interface DownloadResult {
  blob: Blob;
  filename: string;
}

/**
 * Binary download (report CSV/PDF exports). Same credentials/headers as the
 * JSON client; API errors still arrive as the standard envelope so they are
 * parsed here instead of parseEnvelope.
 */
export async function downloadFile(
  path: string,
  options?: Omit<RequestOptions, 'body'>,
): Promise<DownloadResult> {
  const headers = new Headers();
  if (options?.pharmacyId) {
    headers.set('X-Pharmacy-Id', options.pharmacyId);
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method: 'GET',
      headers,
      credentials: 'include',
      signal: options?.signal,
    });
  } catch (cause) {
    throw new ApiClientError('EXTERNAL_SERVICE_ERROR', 'Unable to reach the server.', 0, cause);
  }

  if (!response.ok) {
    let code = 'INTERNAL_ERROR';
    let message = 'Download failed.';
    try {
      const envelope = (await response.json()) as ApiResponse<unknown>;
      if (!envelope.success) {
        code = envelope.error.code;
        message = envelope.error.message;
      }
    } catch {
      // Non-JSON error body; keep the defaults.
    }
    throw new ApiClientError(code, message, response.status);
  }

  const blob = await response.blob();
  const disposition = response.headers.get('Content-Disposition') ?? '';
  const match = /filename="?([^";]+)"?/.exec(disposition);
  return { blob, filename: match?.[1] ?? 'export' };
}

/** Data returned by GET /auth/me (apps/api auth.routes.ts). */
export interface SessionData {
  user: AuthUserContext;
  activePharmacy: {
    pharmacyId: string;
    pharmacyName: string | null;
    role: UserRole;
  } | null;
  permissions: string[];
}

/**
 * Loads the current session. When the access cookie has expired (401) a
 * single silent refresh is attempted before giving up; returns null when
 * unauthenticated so callers can redirect to /login.
 */
export async function fetchSession(signal?: AbortSignal): Promise<SessionData | null> {
  try {
    return await api.get<SessionData>('/auth/me', { signal });
  } catch (error) {
    if (!(error instanceof ApiClientError) || error.status !== 401) {
      return null;
    }
    try {
      await api.post('/auth/refresh');
    } catch {
      return null;
    }
    try {
      return await api.get<SessionData>('/auth/me', { signal });
    } catch {
      return null;
    }
  }
}
