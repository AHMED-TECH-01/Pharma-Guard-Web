'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { MailCheck } from 'lucide-react';
import { forgotPasswordFormSchema } from '@/lib/auth-forms';
import { ApiClientError, api } from '@/lib/api';
import { AuthLayout } from '@/components/auth/auth-layout';
import { AuthError } from '@/components/auth/auth-error';

/**
 * Forgot Password (PRD §10.2 link target). The API always responds success
 * whether or not the account exists, and this page mirrors that - no
 * account enumeration.
 */
export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setFieldError(null);

    const parsed = forgotPasswordFormSchema.safeParse({ email });
    if (!parsed.success) {
      setFieldError(parsed.error.issues[0]?.message ?? 'Please check your input.');
      return;
    }

    setSubmitting(true);
    try {
      await api.post('/auth/forgot-password', parsed.data);
      setSent(true);
    } catch (cause) {
      setFormError(
        cause instanceof ApiClientError
          ? cause.message
          : 'Something went wrong. Please try again.',
      );
      setSubmitting(false);
    }
  }

  if (sent) {
    return (
      <AuthLayout>
        <div className="text-center">
          <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-status-info-bg">
            <MailCheck className="size-6 text-status-info-fg" aria-hidden />
          </span>
          <h1 className="mt-4 text-xl font-semibold tracking-tight">Check your email</h1>
          <p className="mt-2 text-sm leading-relaxed text-text-muted">
            If an account exists for <span className="font-medium text-text">{email}</span>,
            a password reset link has been sent. The link expires after a short time.
          </p>
          <Link
            href="/login"
            className="mt-6 flex h-10 items-center justify-center rounded-lg border border-border bg-surface text-sm font-medium transition-colors duration-150 hover:bg-surface-muted"
          >
            Back to sign in
          </Link>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Forgot your password?</h1>
        <p className="mt-1 text-sm text-text-muted">
          Enter your account email and we&apos;ll send you a reset link.
        </p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-4" noValidate>
          <div className="space-y-1.5">
            <label htmlFor="email" className="block text-sm font-medium">
              Email Address
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="Enter your email"
              aria-invalid={fieldError ? true : undefined}
              className={`h-12 w-full rounded-lg border bg-surface px-3 text-sm outline-none transition-colors duration-150 placeholder:text-text-muted focus:border-primary-600 ${
                fieldError ? 'border-status-critical-border' : 'border-border'
              }`}
            />
            {fieldError ? (
              <p className="text-xs text-status-critical-fg" role="alert">
                {fieldError}
              </p>
            ) : null}
          </div>

          {formError ? <AuthError message={formError} /> : null}

          <button
            type="submit"
            disabled={submitting}
            className="h-12 w-full rounded-lg bg-primary-700 text-sm font-medium text-white transition-colors duration-150 hover:bg-primary-800 disabled:opacity-60"
          >
            {submitting ? 'Sending…' : 'Send reset link'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-text-muted">
          Remembered it?{' '}
          <Link
            href="/login"
            className="font-medium text-primary-700 transition-colors duration-150 hover:text-primary-800"
          >
            Sign in
          </Link>
        </p>
      </div>
    </AuthLayout>
  );
}
