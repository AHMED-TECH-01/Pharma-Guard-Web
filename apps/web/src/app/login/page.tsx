'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { loginFormSchema, issuesToFieldErrors } from '@/lib/auth-forms';
import { ApiClientError, api } from '@/lib/api';
import { AuthLayout } from '@/components/auth/auth-layout';
import { AuthError } from '@/components/auth/auth-error';
import { OAuthButtons } from '@/components/auth/oauth-buttons';
import { PasswordField } from '@/components/auth/password-field';

/**
 * Login (PRD §10.2, ui-rules §14, reference LOGIN PAGE composition).
 * Posts to the backend API, which sets HttpOnly session cookies - the tokens
 * are never exposed to JavaScript. "Remember me" switches the session
 * between persistent (7-day) and browser-session cookies.
 */
export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setFieldErrors({});

    const parsed = loginFormSchema.safeParse({ email, password, remember });
    if (!parsed.success) {
      setFieldErrors(issuesToFieldErrors(parsed.error));
      return;
    }

    setSubmitting(true);
    try {
      await api.post('/auth/login', parsed.data);
      router.replace('/dashboard');
      router.refresh();
    } catch (cause) {
      setFormError(
        cause instanceof ApiClientError
          ? cause.message
          : 'Something went wrong. Please try again.',
      );
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Welcome Back! 👋</h1>
        <p className="mt-1 text-sm text-text-muted">Sign in to continue to your account</p>

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
              aria-invalid={fieldErrors.email ? true : undefined}
              className={`h-10 w-full rounded-md border bg-surface px-3 text-sm outline-none transition-colors duration-150 placeholder:text-text-muted focus:border-primary-600 ${
                fieldErrors.email ? 'border-status-critical-border' : 'border-border'
              }`}
            />
            {fieldErrors.email ? (
              <p className="text-xs text-status-critical-fg" role="alert">
                {fieldErrors.email}
              </p>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <PasswordField
              label="Password"
              value={password}
              onChange={setPassword}
              placeholder="Enter your password"
              error={fieldErrors.password ?? null}
              disabled={submitting}
            />
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-sm text-text-muted">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(event) => setRemember(event.target.checked)}
                  disabled={submitting}
                  className="size-4 rounded border-border accent-primary-700"
                />
                Remember me
              </label>
              <Link
                href="/forgot-password"
                className="text-sm font-medium text-primary-700 transition-colors duration-150 hover:text-primary-800"
              >
                Forgot Password?
              </Link>
            </div>
          </div>

          {formError ? <AuthError message={formError} /> : null}

          <button
            type="submit"
            disabled={submitting}
            className="h-10 w-full rounded-md bg-primary-700 text-sm font-medium text-white transition-colors duration-150 hover:bg-primary-800 disabled:opacity-60"
          >
            {submitting ? 'Signing in…' : 'Sign In'}
          </button>
        </form>

        <div className="mt-6">
          <OAuthButtons action="Sign in" />
        </div>

        <p className="mt-6 text-center text-sm text-text-muted">
          Don&apos;t have an account?{' '}
          <Link
            href="/signup"
            className="font-medium text-primary-700 transition-colors duration-150 hover:text-primary-800"
          >
            Sign up
          </Link>
        </p>
      </div>
    </AuthLayout>
  );
}
