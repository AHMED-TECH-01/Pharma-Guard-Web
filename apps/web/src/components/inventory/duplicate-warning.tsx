'use client';

import { TriangleAlert } from 'lucide-react';
import type { PotentialDuplicate } from '@pharmaguard/types';

/**
 * DuplicateWarning (ui-registry §7, PRD §12). Creation is blocked until
 * the user explicitly confirms - merging is a later-phase workflow.
 */

interface DuplicateWarningProps {
  duplicates: PotentialDuplicate[];
  pendingName: string;
  onConfirmCreate: () => void;
  onCancel: () => void;
  pending?: boolean;
}

export function DuplicateWarning({
  duplicates,
  pendingName,
  onConfirmCreate,
  onCancel,
  pending = false,
}: DuplicateWarningProps) {
  return (
    <div
      role="alert"
      className="rounded-lg border border-status-warning-border bg-status-warning-bg p-4"
    >
      <div className="flex items-start gap-2.5">
        <TriangleAlert className="mt-0.5 size-4 shrink-0 text-status-warning-fg" aria-hidden />
        <div className="min-w-0 text-sm">
          <p className="font-medium text-status-warning-fg">
            Similar medicines already exist
          </p>
          <p className="mt-1 text-text-muted">
            These may be duplicates of <span className="font-medium">{pendingName}</span>:
          </p>
          <ul className="mt-2 space-y-1">
            {duplicates.map((duplicate) => (
              <li key={duplicate.id} className="text-text-muted">
                • {duplicate.name}
                {duplicate.strength ? ` ${duplicate.strength}` : ''}
                {duplicate.manufacturer ? ` — ${duplicate.manufacturer}` : ''}
                {duplicate.isArchived ? ' (archived)' : ''}
              </li>
            ))}
          </ul>
          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              onClick={onConfirmCreate}
              disabled={pending}
              className="h-8 rounded-md bg-status-warning-fg px-3 text-xs font-medium text-white transition hover:opacity-90 disabled:opacity-60"
            >
              {pending ? 'Creating…' : 'Create anyway'}
            </button>
            <button
              type="button"
              onClick={onCancel}
              disabled={pending}
              className="h-8 rounded-md border border-border bg-surface px-3 text-xs font-medium transition hover:bg-surface-muted disabled:opacity-60"
            >
              Go back and review
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
