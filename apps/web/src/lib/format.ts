import type { ExpiryBucketKey, ExpiryStatus } from '@pharmaguard/types';

/**
 * Presentation formatters for the dashboard (PRD §10.5 shows PKR values).
 * Money is always whole-rupee; chart axes use compact notation.
 */

const currencyFormatter = new Intl.NumberFormat('en-PK', {
  style: 'currency',
  currency: 'PKR',
  maximumFractionDigits: 0,
});

const compactFormatter = new Intl.NumberFormat('en-PK', {
  notation: 'compact',
  maximumFractionDigits: 1,
});

export function formatPKR(value: number): string {
  return currencyFormatter.format(value);
}

export function formatPKRCompact(value: number): string {
  return `PKR ${compactFormatter.format(value)}`;
}

export function formatRelativeTime(iso: string, now: Date = new Date()): string {
  const diffMs = now.getTime() - new Date(iso).getTime();
  const minutes = Math.round(diffMs / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days} day${days === 1 ? '' : 's'} ago`;
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

export function formatGreeting(date: Date = new Date()): string {
  const hour = date.getHours();
  // Reference dashboard: "Good Morning, Ahmed!" (title case).
  if (hour < 12) return 'Good Morning';
  if (hour < 17) return 'Good Afternoon';
  return 'Good Evening';
}

/** Token-mapped colors for expiry donut segments (ui-tokens.md §2/§3). */
export const EXPIRY_BUCKET_COLORS: Record<ExpiryBucketKey, string> = {
  expired: '#9f1f1f',
  critical: '#ef3d3d',
  warning: '#f59e0b',
  safe: '#149447',
};

export function expiryTone(daysLeft: number): ExpiryBucketKey {
  if (daysLeft < 0) return 'expired';
  if (daysLeft <= 30) return 'critical';
  if (daysLeft <= 90) return 'warning';
  return 'safe';
}

export function formatDaysLeft(daysLeft: number): string {
  if (daysLeft < 0) return `${Math.abs(daysLeft)} day${Math.abs(daysLeft) === 1 ? '' : 's'} ago`;
  if (daysLeft === 0) return 'Expires today';
  return `${daysLeft} day${daysLeft === 1 ? '' : 's'} left`;
}

/** Maps a server-computed expiry bucket (TRD §10) to its presentation tone. */
export function expiryBucketTone(bucket: ExpiryStatus): ExpiryBucketKey {
  return bucket.toLowerCase() as ExpiryBucketKey;
}

/** Shared "4 Sep 2026" formatter for date-only and timestamp ISO strings. */
export function formatDate(dateIso: string | null): string {
  if (!dateIso) return '—';
  const date = dateIso.includes('T') ? new Date(dateIso) : new Date(`${dateIso}T00:00:00`);
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}
