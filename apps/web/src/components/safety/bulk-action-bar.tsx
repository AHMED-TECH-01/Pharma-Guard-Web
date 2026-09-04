'use client';

import { useState } from 'react';
import type { ExpiryAction } from '@pharmaguard/types';
import type { LucideIcon } from 'lucide-react';
import { PackageX, ShieldAlert, Undo2 } from 'lucide-react';
import { Modal } from '@/components/ui/modal';

/**
 * Bulk action bar (PRD §10.9): appears when expiry batches are selected and
 * offers mark removed / mark returned / quarantine. Every action demands a
 * reason (validation: 3-500 chars) so the audit trail explains the decision.
 * QUARANTINE needs the quarantine capability; REMOVE/RETURN need expiry.act -
 * the server enforces this per action and the UI mirrors it.
 */

const ACTION_TITLES: Record<ExpiryAction, string> = {
  REMOVE: 'Mark batches removed',
  RETURN: 'Mark batches returned',
  QUARANTINE: 'Quarantine batches',
};

const ACTION_DESCRIPTIONS: Record<ExpiryAction, string> = {
  REMOVE: 'Batches are marked REMOVED and permanently leave available inventory.',
  RETURN: 'Batches are marked RETURNED so they can be credited by the supplier.',
  QUARANTINE: 'Batches are marked QUARANTINED and move to the Quarantine register for review.',
};

interface BulkActionBarProps {
  selectedCount: number;
  canExpiryAct: boolean;
  canQuarantineAct: boolean;
  onRun: (action: ExpiryAction, reason: string) => Promise<void>;
}

export function BulkActionBar({
  selectedCount,
  canExpiryAct,
  canQuarantineAct,
  onRun,
}: BulkActionBarProps) {
  const [pendingAction, setPendingAction] = useState<ExpiryAction | null>(null);
  const [reason, setReason] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const actions: { action: ExpiryAction; label: string; icon: LucideIcon; allowed: boolean }[] = [
    { action: 'REMOVE', label: 'Mark removed', icon: PackageX, allowed: canExpiryAct },
    { action: 'RETURN', label: 'Mark returned', icon: Undo2, allowed: canExpiryAct },
    { action: 'QUARANTINE', label: 'Quarantine', icon: ShieldAlert, allowed: canQuarantineAct },
  ];

  function openFor(action: ExpiryAction) {
    setPendingAction(action);
    setReason('');
    setError(null);
  }

  async function confirm() {
    if (!pendingAction) return;
    const trimmed = reason.trim();
    if (trimmed.length < 3) {
      setError('Give a reason of at least 3 characters for the audit trail.');
      return;
    }
    setPending(true);
    setError(null);
    try {
      await onRun(pendingAction, trimmed);
      setPendingAction(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Action failed.');
    } finally {
      setPending(false);
    }
  }

  if (selectedCount === 0) return null;

  return (
    <>
      <div className="sticky bottom-4 z-20 flex flex-wrap items-center gap-3 rounded-lg border border-border bg-bg-card px-4 py-3 shadow-lg">
        <p className="text-sm font-medium text-text-primary">
          {selectedCount} batch{selectedCount === 1 ? '' : 'es'} selected
        </p>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {actions.map(({ action, label, icon: Icon, allowed }) => (
            <button
              key={action}
              type="button"
              disabled={!allowed}
              title={allowed ? undefined : 'You do not have permission for this action'}
              onClick={() => openFor(action)}
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-surface px-3 text-xs font-medium text-text-primary transition hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Icon className="size-3.5" aria-hidden />
              {label}
            </button>
          ))}
        </div>
      </div>

      <Modal
        open={pendingAction !== null}
        title={pendingAction ? ACTION_TITLES[pendingAction] : ''}
        onClose={() => {
          if (!pending) setPendingAction(null);
        }}
        pending={pending}
      >
        {pendingAction ? (
          <div className="mt-2 space-y-4">
            <p className="text-sm text-text-muted">
              {ACTION_DESCRIPTIONS[pendingAction]} Applies to {selectedCount} batch
              {selectedCount === 1 ? '' : 'es'}.
            </p>
            <div>
              <label htmlFor="bulk-action-reason" className="text-sm font-medium text-text-primary">
                Reason <span className="text-status-critical-fg">*</span>
              </label>
              <textarea
                id="bulk-action-reason"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                rows={3}
                maxLength={500}
                placeholder="e.g. Damaged in transit, supplier recall DR-2026-08"
                className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-faint focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
              />
            </div>
            {error ? (
              <p role="alert" className="text-sm text-status-critical-fg">
                {error}
              </p>
            ) : null}
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setPendingAction(null)}
                disabled={pending}
                className="h-9 rounded-md border border-border bg-surface px-4 text-sm font-medium text-text-primary transition hover:bg-surface-muted disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirm}
                disabled={pending}
                className={`inline-flex h-9 items-center rounded-md px-4 text-sm font-medium text-white transition disabled:opacity-60 ${
                  pendingAction === 'REMOVE'
                    ? 'bg-status-critical-fg hover:opacity-90'
                    : 'bg-primary-600 hover:bg-primary-700'
                }`}
              >
                {pending ? 'Applying…' : `Apply to ${selectedCount} batch${selectedCount === 1 ? '' : 'es'}`}
              </button>
            </div>
          </div>
        ) : null}
      </Modal>
    </>
  );
}
