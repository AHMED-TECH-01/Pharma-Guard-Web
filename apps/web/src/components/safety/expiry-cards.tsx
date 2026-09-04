'use client';

import type { ExpiryBucketCard, ExpiryStatus } from '@pharmaguard/types';
import { formatPKR } from '@/lib/format';

/**
 * Expiry status cards (PRD §10.9): Expired / Critical / Warning / Safe with
 * batch counts, units, and financial exposure at cost. Clicking a card
 * focuses the table on that bucket; clicking the active card clears it.
 */

const BUCKET_ACCENTS: Record<ExpiryStatus, { label: string; border: string; ring: string }> = {
  EXPIRED: { label: 'Expired', border: 'border-l-status-expired-fg', ring: 'ring-status-expired-fg' },
  CRITICAL: { label: 'Critical', border: 'border-l-status-critical-fg', ring: 'ring-status-critical-fg' },
  WARNING: { label: 'Warning', border: 'border-l-status-warning-fg', ring: 'ring-status-warning-fg' },
  SAFE: { label: 'Safe', border: 'border-l-status-safe-fg', ring: 'ring-status-safe-fg' },
};

interface ExpiryCardsProps {
  buckets: ExpiryBucketCard[];
  activeBucket: ExpiryStatus | 'ALL';
  onSelect: (bucket: ExpiryStatus) => void;
}

export function ExpiryCards({ buckets, activeBucket, onSelect }: ExpiryCardsProps) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {buckets.map((card) => {
        const accent = BUCKET_ACCENTS[card.bucket];
        const isActive = activeBucket === card.bucket;
        return (
          <button
            key={card.bucket}
            type="button"
            onClick={() => onSelect(card.bucket)}
            aria-pressed={isActive}
            className={`rounded-lg border border-border-subtle border-l-4 bg-bg-card p-4 text-left transition hover:bg-surface-muted ${accent.border} ${
              isActive ? `ring-2 ${accent.ring}` : ''
            }`}
          >
            <p className="text-xs font-medium uppercase tracking-wide text-text-muted">{accent.label}</p>
            <p className="mt-2 text-2xl font-semibold text-text-primary">{card.batchCount}</p>
            <p className="mt-1 text-xs text-text-muted">
              {card.units} unit{card.units === 1 ? '' : 's'} · {formatPKR(card.valueAtCost)}
            </p>
          </button>
        );
      })}
    </div>
  );
}
