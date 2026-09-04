'use client';

import Link from 'next/link';
import type { PurchaseListItem } from '@pharmaguard/types';
import { formatPKR, formatRelativeTime } from '@/lib/format';

interface PurchaseTableProps {
  purchases: PurchaseListItem[];
}

const HEAD_CELL = 'px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-text-muted';
const BODY_CELL = 'px-4 py-3 align-top text-sm text-text-primary';

/**
 * Purchase history table (PRD §10.11). Items render as a compact summary
 * line; the full detail lives in the row expansion on the history page.
 */
export function PurchaseTable({ purchases }: PurchaseTableProps) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-border">
          <thead className="bg-subtle">
            <tr>
              <th className={HEAD_CELL}>Received</th>
              <th className={HEAD_CELL}>Supplier</th>
              <th className={HEAD_CELL}>Invoice</th>
              <th className={HEAD_CELL}>Items</th>
              <th className={HEAD_CELL}>Total cost</th>
              <th className={HEAD_CELL}>Note</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {purchases.map((purchase) => (
              <tr key={purchase.id}>
                <td className={BODY_CELL}>
                  <span title={purchase.receivedAt}>{formatRelativeTime(purchase.receivedAt)}</span>
                </td>
                <td className={BODY_CELL}>
                  {purchase.supplierId ? (
                    <Link
                      href={`/suppliers/${purchase.supplierId}`}
                      className="font-medium text-primary-700 hover:underline"
                    >
                      {purchase.supplierName ?? 'Unknown supplier'}
                    </Link>
                  ) : (
                    <span className="text-text-muted">—</span>
                  )}
                </td>
                <td className={BODY_CELL}>{purchase.invoiceNo ?? '—'}</td>
                <td className={`${BODY_CELL} max-w-[360px]`}>
                  <ul className="space-y-0.5 text-xs text-text-secondary">
                    {purchase.items.slice(0, 3).map((item, index) => (
                      <li key={`${purchase.id}-${index}`}>
                        {item.medicineName} × {item.quantity} ({item.batchNo}) — {formatPKR(item.unitCost)}
                      </li>
                    ))}
                    {purchase.items.length > 3 ? (
                      <li className="text-text-muted">+{purchase.items.length - 3} more item(s)</li>
                    ) : null}
                  </ul>
                </td>
                <td className={`${BODY_CELL} font-medium`}>{formatPKR(purchase.totalCost)}</td>
                <td className={`${BODY_CELL} max-w-[200px]`}>
                  {purchase.note ? (
                    <span className="line-clamp-2 text-xs text-text-secondary">{purchase.note}</span>
                  ) : (
                    <span className="text-xs text-text-faint">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
