'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { AlertListItem, AlertSeverity, AlertType } from '@pharmaguard/types';
import { ExternalLink } from 'lucide-react';
import { formatDate, formatRelativeTime } from '@/lib/format';

/**
 * AlertCard (ui-registry §3): one alert with a severity accent and the
 * PRD §10.18 actions - mark read, snooze, resolve, open the linked record.
 */

export const ALERT_TYPE_LABELS: Record<AlertType, string> = {
  EXPIRED: 'Expired stock',
  EXPIRING: 'Expiring soon',
  LOW_STOCK: 'Low stock',
  STOCKOUT_RISK: 'Stockout risk',
  DEAD_STOCK: 'Dead stock',
  OVERSTOCK: 'Overstock',
  RECALL: 'Recall',
  QUARANTINE: 'Quarantine',
  OCR_REVIEW: 'OCR review',
};

const SEVERITY_CHIPS: Record<AlertSeverity, string> = {
  CRITICAL: 'bg-status-critical-bg text-status-critical-fg',
  HIGH: 'bg-status-warning-bg text-status-warning-fg',
  MEDIUM: 'bg-info-bg text-info-fg',
  LOW: 'bg-bg-subtle text-text-muted',
};

const SEVERITY_ACCENTS: Record<AlertSeverity, string> = {
  CRITICAL: 'bg-status-critical-fg',
  HIGH: 'bg-status-warning-fg',
  MEDIUM: 'bg-info-fg',
  LOW: 'bg-border',
};

const SEVERITY_LABELS: Record<AlertSeverity, string> = {
  CRITICAL: 'Critical',
  HIGH: 'High',
  MEDIUM: 'Medium',
  LOW: 'Low',
};

const SNOOZE_OPTIONS = [1, 3, 7, 14, 30];

interface AlertCardProps {
  alert: AlertListItem;
  onRead: (id: string) => Promise<void>;
  onResolve: (id: string) => Promise<void>;
  onSnooze: (id: string, days: number) => Promise<void>;
}

export function AlertCard({ alert, onRead, onResolve, onSnooze }: AlertCardProps) {
  const [snoozeDays, setSnoozeDays] = useState('7');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const recordHref = alert.medicineId
    ? `/inventory/${alert.medicineId}`
    : alert.batchId
      ? '/expiry'
      : null;

  async function run(key: string, task: () => Promise<void>) {
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

  const actionable = alert.status !== 'RESOLVED';

  return (
    <article className="rounded-lg border border-border-subtle bg-bg-card p-4">
      <div className="flex items-start gap-3">
        <span className={`w-1 shrink-0 self-stretch rounded ${SEVERITY_ACCENTS[alert.severity]}`} aria-hidden />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${SEVERITY_CHIPS[alert.severity]}`}>
              {SEVERITY_LABELS[alert.severity]}
            </span>
            <span className="text-xs text-text-muted">{ALERT_TYPE_LABELS[alert.type]}</span>
            <span className="text-xs text-text-faint">{formatRelativeTime(alert.createdAt)}</span>
            {alert.status === 'READ' ? <span className="text-xs text-text-muted">Read</span> : null}
            {alert.status === 'SNOOZED' && alert.snoozedUntil ? (
              <span className="text-xs text-text-muted">Snoozed until {formatDate(alert.snoozedUntil)}</span>
            ) : null}
            {alert.status === 'RESOLVED' && alert.resolvedAt ? (
              <span className="text-xs text-text-muted">Resolved {formatRelativeTime(alert.resolvedAt)}</span>
            ) : null}
          </div>
          <p className="mt-1.5 text-sm font-semibold text-text-primary">{alert.title}</p>
          <p className="mt-0.5 text-sm text-text-secondary">{alert.message}</p>

          {error ? (
            <p role="alert" className="mt-2 text-sm text-status-critical-fg">
              {error}
            </p>
          ) : null}

          {actionable ? (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {alert.status === 'NEW' ? (
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={() => run('read', () => onRead(alert.id))}
                  className="rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs font-medium text-text-primary transition hover:bg-surface-muted disabled:opacity-50"
                >
                  Mark read
                </button>
              ) : null}
              {alert.status === 'NEW' || alert.status === 'READ' ? (
                <>
                  <select
                    value={snoozeDays}
                    onChange={(event) => setSnoozeDays(event.target.value)}
                    disabled={busy !== null}
                    aria-label="Snooze duration"
                    className="h-8 rounded-md border border-border bg-surface px-2 text-xs text-text-primary focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 disabled:opacity-50"
                  >
                    {SNOOZE_OPTIONS.map((days) => (
                      <option key={days} value={days}>
                        {days} day{days === 1 ? '' : 's'}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    disabled={busy !== null}
                    onClick={() => run('snooze', () => onSnooze(alert.id, Number(snoozeDays)))}
                    className="rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs font-medium text-text-primary transition hover:bg-surface-muted disabled:opacity-50"
                  >
                    Snooze
                  </button>
                </>
              ) : null}
              <button
                type="button"
                disabled={busy !== null}
                onClick={() => run('resolve', () => onResolve(alert.id))}
                className="rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs font-medium text-text-primary transition hover:bg-surface-muted disabled:opacity-50"
              >
                Resolve
              </button>
              {recordHref ? (
                <Link
                  href={recordHref}
                  className="inline-flex items-center gap-1 text-xs font-medium text-primary-700 transition hover:text-primary-800"
                >
                  Open record
                  <ExternalLink className="size-3" aria-hidden />
                </Link>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </article>
  );
}
