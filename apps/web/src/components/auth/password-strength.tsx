import { passwordStrength } from '@/lib/auth-forms';

/**
 * PasswordStrength (ui-registry §5): four-segment meter with a text label.
 * Status is never communicated by color alone (ui-rules §10/§20).
 */

const SEGMENT_COLORS: Record<string, string> = {
  weak: 'bg-status-critical-fg',
  fair: 'bg-status-warning-fg',
  good: 'bg-status-success-fg',
  strong: 'bg-primary-700',
};

interface PasswordStrengthProps {
  password: string;
}

export function PasswordStrength({ password }: PasswordStrengthProps) {
  const { score, level, label } = passwordStrength(password);

  if (level === null || score === 0) {
    return null;
  }

  return (
    <div className="space-y-1" aria-live="polite">
      <div className="flex gap-1" aria-hidden>
        {[1, 2, 3, 4].map((segment) => (
          <span
            key={segment}
            className={`h-1 flex-1 rounded-full transition-colors duration-150 ${
              segment <= score ? SEGMENT_COLORS[level] : 'bg-border'
            }`}
          />
        ))}
      </div>
      <p className="text-xs text-text-muted">
        Password strength: <span className="font-medium text-text">{label}</span>
      </p>
    </div>
  );
}
