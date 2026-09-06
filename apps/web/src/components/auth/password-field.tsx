'use client';

import { useId, useState, type ComponentType } from 'react';
import { Eye, EyeOff } from 'lucide-react';

/**
 * PasswordField (ui-registry §5, ui-rules §8): labeled password input with
 * an optional leading icon and a show/hide toggle. The toggle announces its
 * state to screen readers.
 */

interface PasswordFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  autoComplete?: string;
  error?: string | null;
  required?: boolean;
  disabled?: boolean;
  leadingIcon?: ComponentType<{ className?: string; 'aria-hidden'?: boolean | 'true' | 'false' }>;
}

export function PasswordField({
  label,
  value,
  onChange,
  placeholder = 'Enter your password',
  autoComplete = 'current-password',
  error = null,
  required = false,
  disabled = false,
  leadingIcon: LeadingIcon,
}: PasswordFieldProps) {
  const id = useId();
  const [visible, setVisible] = useState(false);

  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium">
        {label}
      </label>
      <div className="relative">
        {LeadingIcon ? (
          <LeadingIcon
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-muted"
            aria-hidden
          />
        ) : null}
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          required={required}
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          className={`h-12 w-full rounded-lg border bg-surface text-sm outline-none transition-colors duration-150 placeholder:text-text-muted focus:border-primary-600 disabled:opacity-60 ${
            LeadingIcon ? 'pl-10 pr-10' : 'px-3 pr-10'
          } ${error ? 'border-status-critical-border' : 'border-border'}`}
        />
        <button
          type="button"
          onClick={() => setVisible((current) => !current)}
          aria-label={visible ? 'Hide password' : 'Show password'}
          aria-pressed={visible}
          disabled={disabled}
          className="absolute right-2 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-md text-text-muted transition-colors duration-150 hover:bg-surface-muted hover:text-text disabled:opacity-60"
        >
          {visible ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
        </button>
      </div>
      {error ? (
        <p className="text-xs text-status-critical-fg" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
