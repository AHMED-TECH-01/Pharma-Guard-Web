import { AlertCircle } from 'lucide-react';

/**
 * AuthError (ui-registry §5): persistent error message for auth forms.
 * Calm and actionable - never raw errors (ui-rules §13).
 */

interface AuthErrorProps {
  message: string;
}

export function AuthError({ message }: AuthErrorProps) {
  return (
    <p
      role="alert"
      className="flex items-start gap-2 rounded-md border border-status-critical-border bg-status-critical-bg px-3 py-2 text-sm text-status-critical-fg"
    >
      <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
      <span>{message}</span>
    </p>
  );
}
