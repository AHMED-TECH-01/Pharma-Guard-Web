'use client';

import type { ReturnListItem, ReturnStatus } from '@pharmaguard/types';
import { formatDate } from '@/lib/format';

interface ReturnTableProps {
  returns: ReturnListItem[];
  busyId: string | null;
  onAction: (returnItem: ReturnListItem, action: 'approve' | 'complete' | 'reject') => void;
}

const HEAD_CELL = 'px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-text-muted';
const BODY_CELL = 'px-4 py-3 align-top text-sm text-text-primary';

const STATUS_CHIP: Record<ReturnStatus, string> = {
  PENDING: 'bg-status-warning-bg text-status-warning-fg',
  APPROVED: 'bg-status-info-bg text-status-info-fg',
  COMPLETED: 'bg-status-safe-bg text-status-safe-fg',
  REJECTED: 'bg-bg-subtle text-text-secondary',
};

const REASON_LABELS: Record<ReturnListItem['reason'], string> = {
  EXPIRED: 'Expired',
  DAMAGED: 'Damaged',
  RECALL: 'Recall',
  INCORRECT_SHIPMENT: 'Incorrect shipment',
  OTHER: 'Other',
};

/**
 * Returns register table (PRD §10.14, reference RETURNS MANAGEMENT screen):
 * Medicine | Batch No. | Quantity | Reason | Supplier | Return Date | Status.
 * Workflow actions keep their column: PENDING -> approve (stock leaves) or
 * reject; APPROVED -> complete. The API authorizes and audits every action.
 */
export function ReturnTable({ returns, busyId, onAction }: ReturnTableProps) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-border">
          <thead className="bg-subtle">
            <tr>
              <th className={HEAD_CELL}>Medicine</th>
              <th className={HEAD_CELL}>Batch No.</th>
              <th className={HEAD_CELL}>Quantity</th>
              <th className={HEAD_CELL}>Reason</th>
              <th className={HEAD_CELL}>Supplier</th>
              <th className={HEAD_CELL}>Return Date</th>
              <th className={HEAD_CELL}>Status</th>
              <th className={HEAD_CELL}><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {returns.map((returnItem) => (
              <tr key={returnItem.id}>
                <td className={BODY_CELL}>
                  <span className="font-medium" title={`Recorded ${formatDate(returnItem.createdAt)}`}>
                    {returnItem.medicineName}
                  </span>
                  {returnItem.medicineStrength ? (
                    <span className="ml-1.5 text-xs text-text-muted">{returnItem.medicineStrength}</span>
                  ) : null}
                </td>
                <td className={`${BODY_CELL} tabular-nums`}>{returnItem.batchNo}</td>
                <td className={`${BODY_CELL} tabular-nums`}>{returnItem.quantity}</td>
                <td className={BODY_CELL}>{REASON_LABELS[returnItem.reason]}</td>
                <td className={BODY_CELL}>{returnItem.supplierName ?? '—'}</td>
                <td className={BODY_CELL}>{returnItem.returnDate ? formatDate(returnItem.returnDate) : '—'}</td>
                <td className={BODY_CELL}>
                  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_CHIP[returnItem.status]}`}>
                    {returnItem.status.charAt(0) + returnItem.status.slice(1).toLowerCase()}
                  </span>
                </td>
                <td className={`${BODY_CELL} text-right`}>
                  <div className="flex justify-end gap-1.5">
                    {returnItem.status === 'PENDING' ? (
                      <>
                        <button
                          type="button"
                          className="rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-text-primary transition hover:bg-subtle disabled:opacity-60"
                          onClick={() => onAction(returnItem, 'approve')}
                          disabled={busyId !== null}
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          className="rounded-lg border border-status-critical-fg/40 px-2.5 py-1.5 text-xs font-medium text-status-critical-fg transition hover:bg-status-critical-bg disabled:opacity-60"
                          onClick={() => onAction(returnItem, 'reject')}
                          disabled={busyId !== null}
                        >
                          Reject
                        </button>
                      </>
                    ) : null}
                    {returnItem.status === 'APPROVED' ? (
                      <button
                        type="button"
                        className="rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-text-primary transition hover:bg-subtle disabled:opacity-60"
                        onClick={() => onAction(returnItem, 'complete')}
                        disabled={busyId !== null}
                      >
                        Mark completed
                      </button>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
