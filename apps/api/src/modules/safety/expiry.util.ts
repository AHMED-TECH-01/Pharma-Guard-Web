import type { ExpiryStatus } from '@pharmaguard/types';
import { getEnv } from '../../config/env.js';

/**
 * Expiry engine core (TRD §10).
 *
 * Server time is the source of truth; dates are compared as UTC calendar
 * days so the result is stable regardless of the server's timezone. The
 * bucket thresholds are configurable via EXPIRY_CRITICAL_DAYS /
 * EXPIRY_WARNING_DAYS (env.ts).
 */

/** Whole calendar days from today (UTC) until the expiry date; negative once expired. */
export function daysUntil(expiryDate: string, now: Date): number {
  const expiry = new Date(`${expiryDate}T00:00:00Z`).getTime();
  if (Number.isNaN(expiry)) return Number.NaN;
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.floor((expiry - today) / 86_400_000);
}

export function expiryBucket(
  daysLeft: number,
  criticalDays: number,
  warningDays: number,
): ExpiryStatus {
  if (daysLeft < 0) return 'EXPIRED';
  if (daysLeft <= criticalDays) return 'CRITICAL';
  if (daysLeft <= warningDays) return 'WARNING';
  return 'SAFE';
}

export function expiryThresholds(): { criticalDays: number; warningDays: number } {
  const env = getEnv();
  return { criticalDays: env.EXPIRY_CRITICAL_DAYS, warningDays: env.EXPIRY_WARNING_DAYS };
}

/** Bucket + days-left for one batch, using the configured thresholds. */
export function classifyBatch(
  expiryDate: string,
  now: Date,
): { daysLeft: number; bucket: ExpiryStatus } {
  const { criticalDays, warningDays } = expiryThresholds();
  const daysLeft = daysUntil(expiryDate, now);
  return { daysLeft, bucket: expiryBucket(daysLeft, criticalDays, warningDays) };
}
