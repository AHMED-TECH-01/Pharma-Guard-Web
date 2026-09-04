'use client';

import type { SaleListItem } from '@pharmaguard/types';
import { formatPKR, formatRelativeTime } from '@/lib/format';

interface SalesTableProps {
  sales: SaleListItem[];
  canReverse: boolean;
  busyId: string | null;
  onReverse: (sale: SaleListItem) => void;
}

const HEAD_CELL = 'px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-text-muted';
const BODY_CELL = 'px-4 py-3 align-top text-sm text-text-primary';

/**
 * Sales history table (PRD §10.10). Reversed rows stay visible with a
 * stamp; reversal is offered only for active sales when the viewer holds
 * sales.reverse (OWNER/MANAGER).
 */
export function SalesTable({ sales, canReverse, busyId, onReverse }: SalesTableProps) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-border">
          <thead className="bg-subtle">
            <tr>
              <th className={HEAD_CELL}>Sold</th>
              <th className={HEAD_CELL}>Medicine</th>
              <th className={HEAD_CELL}>Batch</th>
              <th className={HEAD_CELL}>Qty</th>
              <th className={HEAD_CELL}>Unit price</th>
              <th className={HEAD_CELL}>Total</th>
              <th className={HEAD_CELL}>Note</th>
              <th className={HEAD_CELL}>Status</th>
              {canReverse ? <th className={HEAD_CELL}><span className="sr-only">Actions</span></th> : null}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {sales.map((sale) => {
              const reversed = sale.reversedAt !== null;
              return (
                <tr key={sale.id} className={reversed ? 'opacity-60' : undefined}>
                  <td className={BODY_CELL}>
                    <span title={sale.soldAt}>{formatRelativeTime(sale.soldAt)}</span>
                  </td>
                  <td className={BODY_CELL}>
                    <div className="font-medium">{sale.medicineName}</div>
                    {sale.medicineStrength ? (
                      <div className="text-xs text-text-muted">{sale.medicineStrength}</div>
                    ) : null}
                  </td>
                  <td className={BODY_CELL}>{sale.batchNo}</td>
                  <td className={BODY_CELL}>{sale.quantity}</td>
                  <td className={BODY_CELL}>{formatPKR(sale.unitPrice)}</td>
                  <td className={`${BODY_CELL} font-medium`}>{formatPKR(sale.totalAmount)}</td>
                  <td className={`${BODY_CELL} max-w-[220px]`}>
                    {sale.note ? (
                      <span className="line-clamp-2 text-xs text-text-secondary">{sale.note}</span>
                    ) : (
                      <span className="text-xs text-text-faint">—</span>
                    )}
                  </td>
                  <td className={BODY_CELL}>
                    {reversed ? (
                      <span className="inline-flex items-center rounded-full bg-bg-subtle px-2.5 py-0.5 text-xs font-medium text-text-secondary">
                        Reversed
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-status-safe-bg px-2.5 py-0.5 text-xs font-medium text-status-safe-fg">
                        Active
                      </span>
                    )}
                  </td>
                  {canReverse ? (
                    <td className={`${BODY_CELL} text-right`}>
                      {reversed ? null : (
                        <button
                          type="button"
                          className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-text-primary transition hover:bg-subtle disabled:cursor-not-allowed disabled:opacity-60"
                          onClick={() => onReverse(sale)}
                          disabled={busyId !== null}
                        >
                          {busyId === sale.id ? 'Reversing…' : 'Reverse'}
                        </button>
                      )}
                    </td>
                  ) : null}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
