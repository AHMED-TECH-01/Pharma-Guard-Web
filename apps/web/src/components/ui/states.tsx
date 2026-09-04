import type { ReactNode } from 'react';

/**
 * EmptyState and ErrorState (ui-registry §6, TRD §20).
 * Shared primitives for feature cards and full pages.
 */

interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
}

export function EmptyState({ title, description, icon, action }: EmptyStateProps) {
  return (
    <div className="flex min-h-40 flex-col items-center justify-center gap-3 rounded-lg border border-border-subtle bg-bg-card px-6 py-10 text-center">
      {icon ? <div className="text-text-faint">{icon}</div> : null}
      <div>
        <p className="text-sm font-semibold text-text-primary">{title}</p>
        {description ? (
          <p className="mt-1 max-w-md text-sm text-text-muted">{description}</p>
        ) : null}
      </div>
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  );
}

interface ErrorStateProps {
  title?: string;
  description?: string;
  onRetry?: () => void;
}

export function ErrorState({ title = 'Something went wrong', description, onRetry }: ErrorStateProps) {
  return (
    <div
      role="alert"
      className="flex min-h-40 flex-col items-center justify-center gap-3 rounded-lg border border-status-critical-border bg-bg-card px-6 py-10 text-center"
    >
      <div>
        <p className="text-sm font-semibold text-text-primary">{title}</p>
        {description ? (
          <p className="mt-1 max-w-md text-sm text-text-muted">{description}</p>
        ) : null}
      </div>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="mt-1 inline-flex h-9 items-center rounded-md bg-primary-600 px-4 text-sm font-medium text-white transition hover:bg-primary-700"
        >
          Try again
        </button>
      ) : null}
    </div>
  );
}
