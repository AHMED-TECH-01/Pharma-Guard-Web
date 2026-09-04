'use client';

import { useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { KeyRound } from 'lucide-react';
import {
  resetPasswordFormSchema,
  issuesToFieldErrors,
  type ResetPasswordFormInput,
} from '@/lib/auth-forms';
import { createBrowserSupabase } from '@/lib/supabase';
import { AuthLayout } from '@/components/auth/auth-layout';
import { AuthError } from '@/components/auth/auth-error';
import { PasswordField } from '@/components/auth/password-field';
import { PasswordStrength } from '@/components/auth/password-strength';

/**
 * Reset Password (PRD public-pages tree, ui-registry §10).
 *
 * The recovery email link (sent by the backend via auth.service.ts) lands
 * here with either a PKCE `?code=` or implicit-flow tokens in the URL
 * fragment. The exchange is an approved browser auth operation
 * (architecture.md §3) because it is cryptographically bound to this
 * browser. Tokens are stripped from the address bar immediately and the
 * recovery session is discarded right after the password update.
 */

type Phase = 'resolving' | 'ready' | 'invalid' | 'done';

function stripCredentialsFromUrl() {
  // Remove code/tokens from the visible URL without navigation.
  window.history.replaceState(null, '', `${window.location.pathname}`);
}

async function resolveRecoveryCredentials(): Promise<{ ok: true } | { ok: false }> {
  const supabase = createBrowserSupabase();
  const url = new URL(window.location.href);
  const code = url.searchParams.get('code');

  try {
    if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) return { ok: false };
    } else if (window.location.hash.includes('access_token=')) {
      const params = new URLSearchParams(window.location.hash.replace(/^#/, ''));
      const accessToken = params.get('access_token');
      const refreshToken = params.get('refresh_token');
      if (!accessToken || !refreshToken) return { ok: false };
      const { error } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });
      if (error) return { ok: false };
    } else {
      return { ok: false };
    }

    // Confirm the recovery session actually resolved to a user.
    const { data } = await supabase.auth.getUser();
    return data.user ? { ok: true } : { ok: false };
  } catch {
    return { ok: false };
  } finally {
    stripCredentialsFromUrl();
  }
}

function FormSkeleton() {
  return (
    <div className="rounded-lg border border-border bg-surface p-8 shadow-sm" aria-busy="true">
      <div className="h-6 w-48 animate-pulse rounded-md bg-surface-muted" />
      <div className="mt-8 space-y-4">
        <div className="h-10 w-full animate-pulse rounded-md bg-surface-muted" />
        <div className="h-10 w-full animate-pulse rounded-md bg-surface-muted" />
        <div className="h-10 w-full animate-pulse rounded-md bg-surface-muted" />
      </div>
    </div>
  );
}

function ResetPasswordForm() {
  const [phase, setPhase] = useState<Phase>('resolving');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    resolveRecoveryCredentials().then((result) => {
      if (!cancelled) {
        setPhase(result.ok ? 'ready' : 'invalid');
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setFieldErrors({});

    const parsed = resetPasswordFormSchema.safeParse({ password, confirmPassword });
    if (!parsed.success) {
      setFieldErrors(issuesToFieldErrors(parsed.error));
      return;
    }

    setSubmitting(true);
    const input: ResetPasswordFormInput = parsed.data;
    try {
      const supabase = createBrowserSupabase();
      const { error } = await supabase.auth.updateUser({ password: input.password });
      if (error) {
        setFormError(
          error.status === 422
            ? (error.message ?? 'Please choose a stronger password.')
            : 'Could not update the password. The link may have expired - request a new one.',
        );
        setSubmitting(false);
        return;
      }
      // The recovery session has served its purpose; never keep it.
      await supabase.auth.signOut();
      setPhase('done');
    } catch {
      setFormError('Something went wrong. Please try again.');
      setSubmitting(false);
    }
  }

  if (phase === 'resolving') {
    return <FormSkeleton />;
  }

  if (phase === 'invalid') {
    return (
      <div className="rounded-lg border border-border bg-surface p-8 text-center shadow-sm">
        <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-status-warning-bg">
          <KeyRound className="size-6 text-status-warning-fg" aria-hidden />
        </span>
        <h1 className="mt-4 text-xl font-semibold tracking-tight">Link invalid or expired</h1>
        <p className="mt-2 text-sm leading-relaxed text-text-muted">
          This password reset link is invalid or has expired. Request a fresh link and
          open it from your email.
        </p>
        <Link
          href="/forgot-password"
          className="mt-6 flex h-10 items-center justify-center rounded-md bg-primary-700 text-sm font-medium text-white transition-colors duration-150 hover:bg-primary-800"
        >
          Request a new link
        </Link>
      </div>
    );
  }

  if (phase === 'done') {
    return (
      <div className="rounded-lg border border-border bg-surface p-8 text-center shadow-sm">
        <h1 className="text-xl font-semibold tracking-tight">Password updated</h1>
        <p className="mt-2 text-sm leading-relaxed text-text-muted">
          Your password has been changed. Use it to sign in - any other sessions stay
          active until they expire.
        </p>
        <Link
          href="/login"
          className="mt-6 flex h-10 items-center justify-center rounded-md bg-primary-700 text-sm font-medium text-white transition-colors duration-150 hover:bg-primary-800"
        >
          Go to sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-surface p-8 shadow-sm">
      <h1 className="text-2xl font-semibold tracking-tight">Set a new password</h1>
      <p className="mt-1 text-sm text-text-muted">
        Choose a strong password you don&apos;t use anywhere else.
      </p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-4" noValidate>
        <div className="space-y-2">
          <PasswordField
            label="New Password"
            value={password}
            onChange={setPassword}
            placeholder="Create a new password"
            autoComplete="new-password"
            error={fieldErrors.password ?? null}
            disabled={submitting}
          />
          <PasswordStrength password={password} />
        </div>

        <PasswordField
          label="Confirm Password"
          value={confirmPassword}
          onChange={setConfirmPassword}
          placeholder="Confirm your new password"
          autoComplete="new-password"
          error={fieldErrors.confirmPassword ?? null}
          disabled={submitting}
        />

        {formError ? <AuthError message={formError} /> : null}

        <button
          type="submit"
          disabled={submitting}
          className="h-10 w-full rounded-md bg-primary-700 text-sm font-medium text-white transition-colors duration-150 hover:bg-primary-800 disabled:opacity-60"
        >
          {submitting ? 'Updating…' : 'Update password'}
        </button>
      </form>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <AuthLayout>
      <ResetPasswordForm />
    </AuthLayout>
  );
}
