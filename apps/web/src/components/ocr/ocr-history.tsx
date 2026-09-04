'use client';

import type { OcrScanListItem, OcrScanStatus } from '@pharmaguard/types';
import { formatRelativeTime } from '@/lib/format';
import { EmptyState } from '@/components/ui/states';

/**
 * OCRHistory (ui-registry §6, PRD §10.6 "Recent scans"): newest first.
 * Failed scans keep their error code so the user can retry with context.
 */

const STATUS_BADGE_STYLES: Record<OcrScanStatus, string> = {
  PROCESSING: 'bg-surface-muted text-text-secondary',
  COMPLETED: 'bg-status-info-bg text-status-info-fg',
  FAILED: 'bg-status-critical-bg text-status-critical-fg',
  CONFIRMED: 'bg-status-safe-bg text-status-safe-fg',
  DISCARDED: 'bg-surface-muted text-text-faint',
};

export function OCRHistory({ scans }: { scans: OcrScanListItem[] }) {
  if (scans.length === 0) {
    return (
      <EmptyState
        title="No scans yet"
        description="Scans you upload appear here with their status and confidence."
      />
    );
  }

  return (
    <ul className="divide-y divide-border rounded-lg border border-border bg-surface">
      {scans.map((scan) => (
        <li key={scan.id} className="flex items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-text-primary">
              {scan.medicineName ?? 'Unidentified medicine'}
            </p>
            <p className="mt-0.5 text-xs text-text-faint">
              {formatRelativeTime(scan.createdAt)}
              {scan.errorCode ? ` · ${scan.errorCode}` : ''}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            {scan.confidence !== null ? (
              <span className="text-xs text-text-secondary">
                {Math.round(scan.confidence * 100)}%
              </span>
            ) : null}
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_BADGE_STYLES[scan.status]}`}
            >
              {scan.status}
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
}
