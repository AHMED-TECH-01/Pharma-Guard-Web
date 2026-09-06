'use client';

import type { Batch } from '@pharmaguard/types';
import { formatDate, formatPKR } from '@/lib/format';
import { BatchStatusBadge, ExpiryBadge } from '@/components/ui/badges';

/**
 * BatchTable (ui-registry §7): batch-level rows in FEFO order with the
 * stock-adjustment entry point per row. The API authorizes and audits
 * every adjustment.
 */

interface BatchTableProps {
  batches: Batch[];
  onAdjust: (batch: Batch) => void;
}

export function BatchTable({ batches, onAdjust }: BatchTableProps) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border-subtle bg-bg-card">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead>
          <tr className="border-b border-border-subtle text-xs uppercase tracking-wide text-text-muted">
            <th scope="col" className="px-4 py-3 font-medium">Batch</th>
            <th scope="col" className="px-4 py-3 font-medium">Expiry</th>
            <th scope="col" className="px-4 py-3 font-medium">Quantity</th>
            <th scope="col" className="px-4 py-3 font-medium">Cost</th>
            <th scope="col" className="px-4 py-3 font-medium">Status</th>
            <th scope="col" className="px-4 py-3 text-right font-medium">
              <span className="sr-only">Adjust</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border-subtle">
          {batches.map((batch) => (
            <tr key={batch.id}>
              <td className="px-4 py-3">
                <span className="font-medium text-text-primary">{batch.batchNo}</span>
                <p className="mt-0.5 text-xs text-text-muted">Mfd {formatDate(batch.manufacturingDate)}</p>
              </td>
              <td className="px-4 py-3">
                <div>{formatDate(batch.expiryDate)}</div>
                <div className="mt-1">
                  <ExpiryBadge expiryDate={batch.expiryDate} />
                </div>
              </td>
              <td className="px-4 py-3 font-medium text-text-primary">{batch.quantity}</td>
              <td className="px-4 py-3 text-text-primary">
                {batch.purchasePrice !== null ? formatPKR(batch.purchasePrice) : '—'}
              </td>
              <td className="px-4 py-3">
                <BatchStatusBadge status={batch.status} />
              </td>
              <td className="px-4 py-3 text-right">
                <button
                  type="button"
                  onClick={() => onAdjust(batch)}
                  className="rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs font-medium transition hover:bg-surface-muted"
                >
                  Adjust
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
