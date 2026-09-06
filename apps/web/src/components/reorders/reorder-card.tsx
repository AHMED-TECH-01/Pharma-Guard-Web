'use client';

import type { ReorderRecommendation } from '@pharmaguard/types';
import { formatDate } from '@/lib/format';

interface ReorderCardProps {
  recommendation: ReorderRecommendation;
  busy: boolean;
  onRecord: (recommendation: ReorderRecommendation) => void;
}

/**
 * Reorder recommendation card (registry §3, PRD §10.12): current stock,
 * daily sales, stockout estimate, recommended quantity, and the plain-
 * language explanation required by the TRD §11 contract. Every action
 * is authorized and audited by the API.
 */
export function ReorderCard({ recommendation, busy, onRecord }: ReorderCardProps) {
  const urgent = !recommendation.sufficientHistory || recommendation.currentStock === 0;

  return (
    <article
      className={`rounded-xl border bg-card p-5 ${
        urgent ? 'border-status-critical-fg/40' : 'border-border'
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-text-primary">
            {recommendation.medicineName}
            {recommendation.medicineStrength ? (
              <span className="ml-1.5 text-sm font-normal text-text-secondary">
                {recommendation.medicineStrength}
              </span>
            ) : null}
          </h3>
          <p className="mt-0.5 text-sm text-text-secondary">
            {recommendation.currentStock} in stock
            {recommendation.reorderLevel > 0
              ? ` - reorder level ${recommendation.reorderLevel}`
              : ''}
          </p>
        </div>
        {recommendation.sufficientHistory ? (
          <div className="text-right">
            <p className="text-xs text-text-muted">Recommended order</p>
            <p className="text-2xl font-semibold text-primary-700">
              {recommendation.recommendedQuantity}
            </p>
          </div>
        ) : (
          <span className="rounded-full bg-status-warning-bg px-2.5 py-0.5 text-xs font-medium text-status-warning-fg">
            Low stock
          </span>
        )}
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-subtle pt-3 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-xs text-text-muted">Avg daily sales</dt>
          <dd className="font-medium text-text-primary">
            {recommendation.sufficientHistory ? recommendation.averageDailySales : '—'}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-text-muted">Safety stock</dt>
          <dd className="font-medium text-text-primary">{recommendation.safetyStock}</dd>
        </div>
        <div>
          <dt className="text-xs text-text-muted">Estimated stockout</dt>
          <dd className="font-medium text-text-primary">
            {recommendation.estimatedStockoutDate ? formatDate(recommendation.estimatedStockoutDate) : '—'}
          </dd>
        </div>
      </dl>

      <p className="mt-3 text-xs text-text-muted">{recommendation.explanation}</p>

      {recommendation.sufficientHistory ? (
        <div className="mt-4 flex justify-end">
          <button
            type="button"
            className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-60"
            onClick={() => onRecord(recommendation)}
            disabled={busy}
          >
            {busy ? 'Recording…' : 'Record reorder'}
          </button>
        </div>
      ) : null}
    </article>
  );
}
