'use client';

import { useState } from 'react';
import type { RecallDetail, RecallStatus } from '@pharmaguard/types';
import { Modal } from '@/components/ui/modal';
import { BatchStatusBadge, ExpiryDaysBadge, RecallBadge } from '@/components/ui/badges';
import { formatDate, formatRelativeTime } from '@/lib/format';

/**
 * RecallDialog (ui-registry §9): recall details plus the affected-batch
 * table and the §10.16 workflow actions - advance the lifecycle status and
 * quarantine the affected stock.
 */

const RECALL_STATUS_OPTIONS: { value: RecallStatus; label: string }[] = [
  { value: 'OPEN', label: 'Open' },
  { value: 'IN_PROGRESS', label: 'In progress' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

const selectClasses =
  'h-9 rounded-md border border-border bg-surface px-2.5 text-sm text-text-primary focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 disabled:opacity-50';

interface RecallDialogProps {
  recall: RecallDetail | null;
  onClose: () => void;
  onUpdateStatus: (status: RecallStatus) => Promise<void>;
  onQuarantine: () => Promise<void>;
}

export function RecallDialog({
  recall,
  onClose,
  onUpdateStatus,
  onQuarantine,
}: RecallDialogProps) {
  const [draftFor, setDraftFor] = useState<string | null>(null);
  const [statusDraft, setStatusDraft] = useState<RecallStatus>('OPEN');
  const [busy, setBusy] = useState<'status' | 'quarantine' | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Reset the status draft whenever a different recall is opened.
  if (recall && draftFor !== recall.id) {
    setDraftFor(recall.id);
    setStatusDraft(recall.status);
  }

  async function run(key: 'status' | 'quarantine', task: () => Promise<void>) {
    setBusy(key);
    setError(null);
    try {
      await task();
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Action failed.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <Modal open={recall !== null} title="Recall detail" onClose={onClose} size="lg">
      {recall ? (
        <div className="mt-2 space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <RecallBadge status={recall.status} />
            <span className="text-xs text-text-muted">
              Updated {formatRelativeTime(recall.updatedAt)}
            </span>
          </div>

          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <div className="min-w-0">
              <dt className="text-xs text-text-muted">Medicine</dt>
              <dd className="truncate text-text-primary">{recall.medicineName ?? '—'}</dd>
            </div>
            <div className="min-w-0">
              <dt className="text-xs text-text-muted">Batch no.</dt>
              <dd className="truncate text-text-primary">{recall.batchNo ?? '—'}</dd>
            </div>
            <div className="min-w-0">
              <dt className="text-xs text-text-muted">Manufacturer</dt>
              <dd className="truncate text-text-primary">{recall.manufacturer ?? '—'}</dd>
            </div>
            <div className="min-w-0">
              <dt className="text-xs text-text-muted">Reported</dt>
              <dd className="truncate text-text-primary">
                {recall.createdByName ?? '—'} · {formatRelativeTime(recall.createdAt)}
              </dd>
            </div>
          </dl>

          {recall.reason ? <p className="text-sm text-text-secondary">{recall.reason}</p> : null}

          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-text-muted">
              Affected batches ({recall.affectedBatches.length})
            </h3>
            {recall.affectedBatches.length === 0 ? (
              <p className="mt-2 text-sm text-text-muted">
                No batches in this pharmacy match the recall scope.
              </p>
            ) : (
              <div className="mt-2 overflow-x-auto rounded-md border border-border-subtle">
                <table className="w-full min-w-[420px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-border-subtle text-xs uppercase tracking-wide text-text-muted">
                      <th scope="col" className="px-3 py-2 font-medium">Batch</th>
                      <th scope="col" className="px-3 py-2 font-medium">Expiry</th>
                      <th scope="col" className="px-3 py-2 font-medium">Qty</th>
                      <th scope="col" className="px-3 py-2 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-subtle">
                    {recall.affectedBatches.map((batch) => (
                      <tr key={batch.id}>
                        <td className="px-3 py-2 font-medium text-text-primary">{batch.batchNo}</td>
                        <td className="px-3 py-2">
                          <span className="mr-2">{formatDate(batch.expiryDate)}</span>
                          <ExpiryDaysBadge daysLeft={batch.daysLeft} bucket={batch.bucket} />
                        </td>
                        <td className="px-3 py-2 text-text-primary">{batch.quantity}</td>
                        <td className="px-3 py-2">
                          <BatchStatusBadge status={batch.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {error ? (
            <p role="alert" className="text-sm text-status-critical-fg">
              {error}
            </p>
          ) : null}

          <div className="flex flex-wrap items-center gap-3">
            <select
              value={statusDraft}
              disabled={busy !== null}
              onChange={(event) => setStatusDraft(event.target.value as RecallStatus)}
              aria-label="Recall status"
              className={selectClasses}
            >
              {RECALL_STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={busy !== null || statusDraft === recall.status}
              onClick={() => run('status', () => onUpdateStatus(statusDraft))}
              className="inline-flex h-9 items-center rounded-md bg-primary-600 px-4 text-sm font-medium text-white transition hover:bg-primary-700 disabled:opacity-60"
            >
              {busy === 'status' ? 'Updating…' : 'Update status'}
            </button>
            {recall.status === 'OPEN' || recall.status === 'IN_PROGRESS' ? (
              <button
                type="button"
                disabled={busy !== null}
                onClick={() => run('quarantine', onQuarantine)}
                className="inline-flex h-9 items-center rounded-md border border-status-warning-fg bg-status-warning-bg px-4 text-sm font-medium text-status-warning-fg transition hover:opacity-90 disabled:opacity-60"
              >
                {busy === 'quarantine' ? 'Quarantining…' : 'Quarantine affected stock'}
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </Modal>
  );
}
