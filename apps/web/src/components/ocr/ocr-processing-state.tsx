'use client';

/**
 * OCRProcessingState (ui-registry §6, PRD §10.6): the visible state while the
 * backend validates the upload and runs Gemini Vision. Doubles as the
 * page-level loading state for /ai-scan.
 */

export function OCRProcessingState({ message = 'Extracting medicine details…' }: { message?: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex flex-col items-center justify-center gap-4 rounded-lg border border-border bg-surface px-6 py-16 text-center"
    >
      <span
        aria-hidden
        className="h-10 w-10 animate-spin rounded-full border-4 border-primary-500/25 border-t-primary-600"
      />
      <div>
        <p className="text-sm font-medium text-text-primary">{message}</p>
        <p className="mt-1 text-sm text-text-secondary">
          The AI reads the package and proposes structured fields. You always
          review and confirm before anything is added.
        </p>
      </div>
    </div>
  );
}
