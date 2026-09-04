import type { Response } from 'express';
import { getEnv } from './env.js';

/**
 * Session cookie strategy (TRD §5 - "HttpOnly cookies where appropriate").
 *
 * The browser never sees JWTs in JS-readable storage: access and refresh
 * tokens are stored in HttpOnly cookies and attached automatically by the
 * browser. The auth middleware also accepts an Authorization: Bearer header
 * for non-browser API clients.
 */

export const ACCESS_COOKIE = 'pg_access';
export const REFRESH_COOKIE = 'pg_refresh';

export const ACCESS_COOKIE_MAX_AGE_SECONDS = 60 * 60; // 1 hour
export const REFRESH_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 days

function baseCookieOptions() {
  const env = getEnv();
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: env.COOKIE_SECURE || env.isProduction,
    path: '/',
  };
}

/**
 * remember=false issues browser-session cookies (no Max-Age), so closing the
 * browser ends the session; the default keeps the 7-day refresh window. The
 * auth provider's own refresh-token lifetime still applies server-side.
 */
export function setAuthCookies(
  res: Response,
  accessToken: string,
  refreshToken: string,
  remember = true,
): void {
  res.cookie(ACCESS_COOKIE, accessToken, {
    ...baseCookieOptions(),
    ...(remember ? { maxAge: ACCESS_COOKIE_MAX_AGE_SECONDS * 1000 } : {}),
  });
  res.cookie(REFRESH_COOKIE, refreshToken, {
    ...baseCookieOptions(),
    ...(remember ? { maxAge: REFRESH_COOKIE_MAX_AGE_SECONDS * 1000 } : {}),
  });
}

export function clearAuthCookies(res: Response): void {
  res.clearCookie(ACCESS_COOKIE, baseCookieOptions());
  res.clearCookie(REFRESH_COOKIE, baseCookieOptions());
}
