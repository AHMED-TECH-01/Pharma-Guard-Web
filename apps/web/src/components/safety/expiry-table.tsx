'use client';

import type { ExpiryBatchItem } from '@pharmaguard/types';
import { formatDate, formatPKR } from '@/lib/format';
import { ExpiryDaysBadge } from '@/components/ui/badges';

/**
 * Expiry table (PRD §10.9): FEFO-ordered available batches with multi-select
 * for the bulk actions. Rows carry the server-computed bucket badge so the
 * configurable thresholds (TRD §10) drive the colors. The API authorizes
 * and audits every bulk action.
 */

interface ExpiryTableProps {
  batches: ExpiryBatchItem[];
  selected: string[];
  onToggle: (batchId: string) => void;
  onToggleAll: (selected: boolean) => void;
}

export function ExpiryTable({ batches, selected, onToggle, onToggleAll }: ExpiryTableProps) {
  const allSelected = batches.length > 0 && batches.every((batch) => selected.includes(batch.id));

  return (
    <div className="overflow-x-auto rounded-lg border border-border-subtle bg-bg-card">
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead>
          <tr className="border-b border-border-subtle text-xs uppercase tracking-wide text-text-muted">
            <th scope="col" className="px-4 py-3">
              <input
                type="checkbox"
                aria-label="Select all batches on this page"
                checked={allSelected}
                onChange={(event) => onToggleAll(event.target.checked)}
                className="size-4 rounded border-border accent-primary-600"
              />
            </th>
            <th scope="col" className="px-4 py-3 font-medium">Medicine</th>
            <th scope="col" className="px-4 py-3 font-medium">Batch</th>
            <th scope="col" className="px-4 py-3 font-medium">Expiry</th>
            <th scope="col" className="px-4 py-3 font-medium">Quantity</th>
            <th scope="col" className="px-4 py-3 text-right font-medium">Value</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border-subtle">
          {batches.map((batch) => (
            <tr key={batch.id}>
              <td className="px-4 py-3">
                <input
                  type="checkbox"
                  aria-label={`Select batch ${batch.batchNo} of ${batch.medicineName}`}
                  checked={selected.includes(batch.id)}
                  onChange={() => onToggle(batch.id)}
                  className="size-4 rounded border-border accent-primary-600"
                />
              </td>
              <td className="px-4 py-3">
                <span className="font-medium text-text-primary">{batch.medicineName}</span>
                {batch.strength ? (
                  <p className="mt-0.5 text-xs text-text-muted">{batch.strength}</p>
                ) : null}
              </td>
              <td className="px-4 py-3 text-text-primary">{batch.batchNo}</td>
              <td className="px-4 py-3">
                <div>{formatDate(batch.expiryDate)}</div>
                <div className="mt-1">
                  <ExpiryDaysBadge daysLeft={batch.daysLeft} bucket={batch.bucket} />
                </div>
              </td>
              <td className="px-4 py-3 font-medium text-text-primary">{batch.quantity}</td>
              <td className="px-4 py-3 text-right text-text-primary">{formatPKR(batch.valueAtCost)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
