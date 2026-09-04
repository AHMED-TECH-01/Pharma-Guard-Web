'use client';

import type { QuarantineListItem } from '@pharmaguard/types';
import { formatDate, formatRelativeTime } from '@/lib/format';
import { QuarantineBadge } from '@/components/ui/badges';

/**
 * Quarantine register (PRD §10.15): batches held out of circulation, with
 * the resolve entry point for QUARANTINED rows.
 */

interface QuarantineTableProps {
  items: QuarantineListItem[];
  canAct: boolean;
  onResolve: (item: QuarantineListItem) => void;
}

export function QuarantineTable({ items, canAct, onResolve }: QuarantineTableProps) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border-subtle bg-bg-card">
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead>
          <tr className="border-b border-border-subtle text-xs uppercase tracking-wide text-text-muted">
            <th scope="col" className="px-4 py-3 font-medium">Batch</th>
            <th scope="col" className="px-4 py-3 font-medium">Quantity</th>
            <th scope="col" className="px-4 py-3 font-medium">Reason</th>
            <th scope="col" className="px-4 py-3 font-medium">Quarantined</th>
            <th scope="col" className="px-4 py-3 font-medium">Status</th>
            {canAct ? (
              <th scope="col" className="px-4 py-3 text-right font-medium">
                <span className="sr-only">Resolve</span>
              </th>
            ) : null}
          </tr>
        </thead>
        <tbody className="divide-y divide-border-subtle">
          {items.map((item) => (
            <tr key={item.id}>
              <td className="px-4 py-3">
                <span className="font-medium text-text-primary">{item.medicineName}</span>
                <p className="mt-0.5 text-xs text-text-muted">
                  Batch {item.batchNo} · expires {formatDate(item.batchExpiryDate)}
                </p>
              </td>
              <td className="px-4 py-3 font-medium text-text-primary">{item.quantity}</td>
              <td className="max-w-xs px-4 py-3 text-text-secondary">
                <span className="line-clamp-2">{item.reason}</span>
              </td>
              <td className="px-4 py-3">
                <div className="text-text-primary">{item.createdByName ?? '—'}</div>
                <div className="mt-0.5 text-xs text-text-muted">{formatRelativeTime(item.createdAt)}</div>
              </td>
              <td className="px-4 py-3">
                <QuarantineBadge status={item.status} />
                {item.status !== 'QUARANTINED' && item.resolvedAt ? (
                  <p className="mt-1 text-xs text-text-muted">{formatRelativeTime(item.resolvedAt)}</p>
                ) : null}
              </td>
              {canAct ? (
                <td className="px-4 py-3 text-right">
                  {item.status === 'QUARANTINED' ? (
                    <button
                      type="button"
                      onClick={() => onResolve(item)}
                      className="rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs font-medium text-text-primary transition hover:bg-surface-muted"
                    >
                      Resolve
                    </button>
                  ) : null}
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
