'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { CircleCheck } from 'lucide-react';
import { signupFormSchema, issuesToFieldErrors } from '@/lib/auth-forms';
import { ApiClientError, api } from '@/lib/api';
import { AuthLayout } from '@/components/auth/auth-layout';
import { AuthError } from '@/components/auth/auth-error';
import { OAuthButtons } from '@/components/auth/oauth-buttons';
import { PasswordField } from '@/components/auth/password-field';
import { PasswordStrength } from '@/components/auth/password-strength';

/**
 * Sign Up (PRD §10.3, ui-rules §15, reference SIGN UP PAGE composition).
 * Cross-field rules (confirm password, terms) are validated client-side;
 * the wire payload is the shared signupSchema enforced again by the API.
 */
export default function SignupPage() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [created, setCreated] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setFieldErrors({});

    const parsed = signupFormSchema.safeParse({
      fullName,
      email,
      phone: phone.trim() === '' ? undefined : phone,
      password,
      confirmPassword,
      acceptTerms,
    });
    if (!parsed.success) {
      setFieldErrors(issuesToFieldErrors(parsed.error));
      return;
    }

    setSubmitting(true);
    try {
      await api.post('/auth/signup', {
        fullName: parsed.data.fullName,
        email: parsed.data.email,
        password: parsed.data.password,
        phone: parsed.data.phone,
      });
      setCreated(true);
    } catch (cause) {
      setFormError(
        cause instanceof ApiClientError
          ? cause.message
          : 'Something went wrong. Please try again.',
      );
      setSubmitting(false);
    }
  }

  if (created) {
    return (
      <AuthLayout>
        <div className="text-center">
          <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-status-safe-bg">
            <CircleCheck className="size-6 text-status-safe-fg" aria-hidden />
          </span>
          <h1 className="mt-4 text-xl font-semibold tracking-tight">Account created</h1>
          <p className="mt-2 text-sm leading-relaxed text-text-muted">
            You can now sign in. If email verification is required for your account,
            we&apos;ve sent you a link - confirm your email first, then sign in.
          </p>
          <Link
            href="/login"
            className="mt-6 flex h-10 items-center justify-center rounded-md bg-primary-700 text-sm font-medium text-white transition-colors duration-150 hover:bg-primary-800"
          >
            Go to sign in
          </Link>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Create Your Account 🚀</h1>
        <p className="mt-1 text-sm text-text-muted">
          Join thousands of pharmacies using PharmaGuard
        </p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-4" noValidate>
          <div className="space-y-1.5">
            <label htmlFor="fullName" className="block text-sm font-medium">
              Full Name
            </label>
            <input
              id="fullName"
              type="text"
              autoComplete="name"
              required
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              placeholder="Enter your full name"
              aria-invalid={fieldErrors.fullName ? true : undefined}
              className={`h-10 w-full rounded-md border bg-surface px-3 text-sm outline-none transition-colors duration-150 placeholder:text-text-muted focus:border-primary-600 ${
                fieldErrors.fullName ? 'border-status-critical-border' : 'border-border'
              }`}
            />
            {fieldErrors.fullName ? (
              <p className="text-xs text-status-critical-fg" role="alert">
                {fieldErrors.fullName}
              </p>
            ) : null}
          </div>

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
            <label htmlFor="phone" className="block text-sm font-medium">
              Phone Number <span className="font-normal text-text-muted">(optional)</span>
            </label>
            <input
              id="phone"
              type="tel"
              autoComplete="tel"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              placeholder="Enter your phone number"
              aria-invalid={fieldErrors.phone ? true : undefined}
              className={`h-10 w-full rounded-md border bg-surface px-3 text-sm outline-none transition-colors duration-150 placeholder:text-text-muted focus:border-primary-600 ${
                fieldErrors.phone ? 'border-status-critical-border' : 'border-border'
              }`}
            />
            {fieldErrors.phone ? (
              <p className="text-xs text-status-critical-fg" role="alert">
                {fieldErrors.phone}
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <PasswordField
              label="Password"
              value={password}
              onChange={setPassword}
              placeholder="Create a password"
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
            placeholder="Confirm your password"
            autoComplete="new-password"
            error={fieldErrors.confirmPassword ?? null}
            disabled={submitting}
          />

          <div className="space-y-1.5">
            <label className="flex items-start gap-2 text-sm text-text-muted">
              <input
                type="checkbox"
                checked={acceptTerms}
                onChange={(event) => setAcceptTerms(event.target.checked)}
                disabled={submitting}
                className="mt-0.5 size-4 rounded border-border accent-primary-700"
              />
              <span>
                I agree to the{' '}
                <span title="Will be available in a later phase" className="font-medium text-text underline decoration-border underline-offset-2">
                  Terms &amp; Conditions
                </span>{' '}
                and{' '}
                <span title="Will be available in a later phase" className="font-medium text-text underline decoration-border underline-offset-2">
                  Privacy Policy
                </span>
              </span>
            </label>
            {fieldErrors.acceptTerms ? (
              <p className="text-xs text-status-critical-fg" role="alert">
                {fieldErrors.acceptTerms}
              </p>
            ) : null}
          </div>

          {formError ? <AuthError message={formError} /> : null}

          <button
            type="submit"
            disabled={submitting}
            className="h-10 w-full rounded-md bg-primary-700 text-sm font-medium text-white transition-colors duration-150 hover:bg-primary-800 disabled:opacity-60"
          >
            {submitting ? 'Creating account…' : 'Create Account'}
          </button>
        </form>

        <div className="mt-6">
          <OAuthButtons action="Sign up" layout="row" />
        </div>

        <p className="mt-6 text-center text-sm text-text-muted">
          Already have an account?{' '}
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
