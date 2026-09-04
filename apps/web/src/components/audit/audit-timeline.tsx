'use client';

import type { AuditEntryItem } from '@pharmaguard/types';
import { formatRelativeTime } from '@/lib/format';
import { EmptyState } from '@/components/ui/states';

/**
 * AuditTimeline (ui-registry §3 - Activity history, PRD §10.19). Vertical
 * timeline of append-only audit events with actor, action chip, entity and
 * an expandable before/after payload. Rendering only - audit rows are
 * written server-side by the API services.
 */

function actionChip(action: string): string {
  if (action.startsWith('sale.') || action.startsWith('purchase.')) {
    return 'bg-status-info-bg text-status-info-fg';
  }
  if (action.includes('quarantine') || action.includes('recall') || action.endsWith('.deleted')) {
    return 'bg-status-critical-bg text-status-critical-fg';
  }
  if (action.startsWith('return.') || action.endsWith('.archived')) {
    return 'bg-status-warning-bg text-status-warning-fg';
  }
  return 'bg-bg-subtle text-text-secondary';
}

export function AuditTimeline({ entries }: { entries: AuditEntryItem[] }) {
  if (entries.length === 0) {
    return (
      <EmptyState
        title="No audit events"
        description="Actions such as sales, approvals and updates will appear here as they happen."
      />
    );
  }

  return (
    <ol className="relative space-y-4 border-l border-border-subtle pl-5">
      {entries.map((entry) => (
        <li key={entry.id} className="relative">
          <span
            className="absolute -left-[25px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-bg-card bg-primary-500"
            aria-hidden="true"
          />
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${actionChip(entry.action)}`}>
              {entry.action}
            </span>
            <span className="text-sm font-medium text-text-primary">
              {entry.actorName ?? 'System'}
            </span>
            <span className="text-xs text-text-faint">{formatRelativeTime(entry.createdAt)}</span>
          </div>
          <p className="mt-0.5 text-xs text-text-muted">
            {entry.entityType}
            {entry.entityId ? ` - ${entry.entityId.slice(0, 8)}` : ''}
          </p>
          {entry.before || entry.after ? (
            <details className="mt-1">
              <summary className="cursor-pointer text-xs text-text-faint hover:text-text-secondary">
                Details
              </summary>
              <pre className="mt-1 max-h-40 overflow-auto rounded-md bg-bg-subtle p-2 text-[11px] leading-relaxed text-text-secondary">
                {JSON.stringify({ before: entry.before, after: entry.after }, null, 2)}
              </pre>
            </details>
          ) : null}
        </li>
      ))}
    </ol>
  );
}
