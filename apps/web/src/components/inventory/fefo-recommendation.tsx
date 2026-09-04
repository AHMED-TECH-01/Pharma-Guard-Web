'use client';

import type { Batch } from '@pharmaguard/types';
import { expiryTone, formatDaysLeft, formatDate } from '@/lib/format';

/**
 * FEFORecommendation (ui-registry §3, TRD §12): highlights the earliest
 * batch that can actually be dispensed next - AVAILABLE, quantity > 0, and
 * not expired. Expired batches are never recommended; if nothing qualifies
 * the card says so instead of pointing at bad stock.
 */

function daysUntil(dateIso: string): number {
  const expiry = new Date(`${dateIso}T00:00:00`);
  return Math.round((expiry.getTime() - new Date().setHours(0, 0, 0, 0)) / 86400000);
}

const TONE_STYLES = {
  expired: 'bg-status-expired-bg text-status-expired-fg',
  critical: 'bg-status-critical-bg text-status-critical-fg',
  warning: 'bg-status-warning-bg text-status-warning-fg',
  safe: 'bg-status-safe-bg text-status-safe-fg',
} as const;

export function FEFORecommendation({ batches }: { batches: Batch[] }) {
  const candidates = batches
    .filter((batch) => batch.status === 'AVAILABLE' && batch.quantity > 0)
    .sort((a, b) => a.expiryDate.localeCompare(b.expiryDate));
  const pick = candidates.find((batch) => daysUntil(batch.expiryDate) >= 0) ?? null;

  if (!pick) {
    return (
      <section
        aria-label="FEFO recommendation"
        className="rounded-lg border border-border-subtle border-l-4 border-l-status-warning-fg bg-bg-card px-4 py-3"
      >
        <p className="text-sm text-text-muted">
          No dispensable batch - every batch is expired, quarantined, returned, or out of stock.
        </p>
      </section>
    );
  }

  const daysLeft = daysUntil(pick.expiryDate);

  return (
    <section
      aria-label="FEFO recommendation"
      className="rounded-lg border border-border-subtle border-l-4 border-l-status-safe-fg bg-bg-card px-4 py-3"
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="rounded-full bg-status-safe-bg px-2 py-0.5 text-xs font-semibold text-status-safe-fg">
          Dispense next (FEFO)
        </span>
        <p className="text-sm text-text-primary">
          Batch <span className="font-semibold">{pick.batchNo}</span> · {pick.quantity} unit
          {pick.quantity === 1 ? '' : 's'} · expires {formatDate(pick.expiryDate)}
        </p>
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${TONE_STYLES[expiryTone(daysLeft)]}`}>
          {formatDaysLeft(daysLeft)}
        </span>
      </div>
    </section>
  );
}
