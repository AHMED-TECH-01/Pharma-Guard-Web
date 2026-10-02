import type { NextFunction, Request, Response } from 'express';
import { getEnv } from '../config/env.js';
import { getSupabaseAdmin } from '../database/supabase.js';
import { ApiError } from '../utils/api-error.js';
import { logger } from '../utils/logger.js';

/**
 * Platform-admin gate (subscriptions spec §18).
 *
 * "Platform admin" is the product owner reviewing manual payments across all
 * pharmacies - it is intentionally NOT a pharmacy role, so it cannot be
 * granted or self-served through team management. Membership in the group is
 * proven by holding the account behind the PLATFORM_ADMIN_EMAILS allowlist:
 * the caller must be authenticated (a verified GoTrue session) AND their
 * account email must appear in the list. Empty list = nobody is an admin.
 */

const EMAIL_CACHE_TTL_MS = 5 * 60 * 1000;
const emailCache = new Map<string, { email: string | null; expiresAt: number }>();

/** Lower-cased allowlist from the environment; empty by default (fail closed). */
export function platformAdminEmails(): string[] {
  return getEnv()
    .PLATFORM_ADMIN_EMAILS.split(',')
    .map((email) => email.trim().toLowerCase())
    .filter((email) => email.length > 0);
}

export function isPlatformAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return platformAdminEmails().includes(email.toLowerCase());
}

async function emailOfUser(userId: string): Promise<string | null> {
  const cached = emailCache.get(userId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.email;
  }
  const { data, error } = await getSupabaseAdmin().auth.admin.getUserById(userId);
  const email = error ? null : (data.user?.email ?? null);
  emailCache.set(userId, { email, expiresAt: Date.now() + EMAIL_CACHE_TTL_MS });
  return email;
}

export async function isPlatformAdmin(userId: string): Promise<boolean> {
  const allowlist = platformAdminEmails();
  if (allowlist.length === 0) return false;
  return isPlatformAdminEmail(await emailOfUser(userId));
}

/** Express middleware: 403 unless the caller is on the platform-admin allowlist. */
export async function requirePlatformAdmin(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.auth) {
      throw ApiError.unauthorized();
    }
    if (!(await isPlatformAdmin(req.auth.userId))) {
      throw ApiError.forbidden('Platform admin access is required for this area');
    }
    next();
  } catch (error) {
    if (error instanceof ApiError) {
      next(error);
      return;
    }
    logger.warn('platform_admin_check_failed', {
      message: error instanceof Error ? error.message : 'unknown',
    });
    next(ApiError.externalService('Unable to verify platform admin access'));
  }
}
