'use client';

import { useState } from 'react';
import type { RecallListItem, RecallStatus } from '@pharmaguard/types';
import { ShieldAlert } from 'lucide-react';
import { formatRelativeTime } from '@/lib/format';
import { RecallBadge } from '@/components/ui/badges';

/**
 * RecallCard (ui-registry §3): one recall with its lifecycle status and the
 * §10.16 quick actions - open the detail dialog, advance the status, and
 * quarantine the affected stock.
 */

const RECALL_STATUS_OPTIONS: { value: RecallStatus; label: string }[] = [
  { value: 'OPEN', label: 'Open' },
  { value: 'IN_PROGRESS', label: 'In progress' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

interface RecallCardProps {
  recall: RecallListItem;
  onOpen: () => void;
  onUpdateStatus: (status: RecallStatus) => Promise<void>;
  onQuarantine: () => Promise<void>;
}

export function RecallCard({ recall, onOpen, onUpdateStatus, onQuarantine }: RecallCardProps) {
  const [busy, setBusy] = useState<'status' | 'quarantine' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const title = recall.medicineName ?? (recall.batchNo ? `Batch ${recall.batchNo}` : 'Recall');
  const quarantinable = recall.status === 'OPEN' || recall.status === 'IN_PROGRESS';

  async function run(key: 'status' | 'quarantine', task: () => Promise<void>) {
    setBusy(key);
    setError(null);
    try {
      await task();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Action failed.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <article className="rounded-lg border border-border-subtle bg-bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-text-primary">{title}</p>
            <RecallBadge status={recall.status} />
          </div>
          <p className="mt-0.5 text-xs text-text-muted">
            {recall.batchNo ? `Batch ${recall.batchNo}` : 'All batches of the medicine'}
            {recall.manufacturer ? ` · ${recall.manufacturer}` : ''}
            {` · reported by ${recall.createdByName ?? 'unknown'} ${formatRelativeTime(recall.createdAt)}`}
          </p>
          {recall.reason ? (
            <p className="mt-1.5 max-w-2xl text-sm text-text-secondary">{recall.reason}</p>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onOpen}
            className="rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs font-medium text-text-primary transition hover:bg-surface-muted"
          >
            Details
          </button>
          <select
            value={recall.status}
            disabled={busy !== null}
            onChange={(event) => run('status', () => onUpdateStatus(event.target.value as RecallStatus))}
            aria-label={`Update status of ${title}`}
            className="h-8 rounded-md border border-border bg-surface px-2 text-xs text-text-primary focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 disabled:opacity-50"
          >
            {RECALL_STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          {quarantinable ? (
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => run('quarantine', onQuarantine)}
              className="inline-flex items-center gap-1.5 rounded-md border border-status-warning-fg bg-status-warning-bg px-2.5 py-1.5 text-xs font-medium text-status-warning-fg transition hover:opacity-90 disabled:opacity-50"
            >
              <ShieldAlert className="size-3.5" aria-hidden />
              {busy === 'quarantine' ? 'Quarantining…' : 'Quarantine affected'}
            </button>
          ) : null}
        </div>
      </div>

      {error ? (
        <p role="alert" className="mt-2 text-sm text-status-critical-fg">
          {error}
        </p>
      ) : null}
    </article>
  );
}
