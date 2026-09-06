'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { CircleCheck, Loader2, MailCheck } from 'lucide-react';
import { createBrowserSupabase } from '@/lib/supabase';
import { api, ApiClientError, type SessionData } from '@/lib/api';
import { AuthError } from '@/components/auth/auth-error';
import { AuthLayout } from '@/components/auth/auth-layout';
import { OTPInput } from '@/components/auth/otp-input';

/**
 * Verify your email (/verify-email, ui-registry §10): completes the signup
 * email-verification OTP flow. The 6-digit code is generated, hashed,
 * stored, expired (10 minutes), and attempt-limited entirely by Supabase
 * Auth (GoTrue) - this page only submits it via verifyOtp (approved public
 * auth operation, architecture.md §6); delivery goes through Gmail SMTP
 * configured in the Supabase dashboard. The confirmed session is then handed
 * to the backend POST /auth/session, which re-validates it server-side and
 * issues the HttpOnly application cookies; the browser session is discarded
 * by design (persistSession: false).
 */

const RESEND_COOLDOWN_SECONDS = 60;

type VerifyErrorKind = 'invalid' | 'expired' | 'tooMany' | null;

const VERIFY_ERROR_MESSAGES: Record<Exclude<VerifyErrorKind, null>, string> = {
  invalid: 'Invalid verification code. Please check the code and try again.',
  expired: 'This verification code has expired. Please request a new code.',
  tooMany: 'Too many verification attempts. Please request a new code.',
};

const NETWORK_ERROR_MESSAGE = 'Something went wrong. Check your connection and try again.';

function mapOtpError(code: string, message: string): VerifyErrorKind {
  if (code === 'otp_expired' || /expired/i.test(message)) {
    return 'expired';
  }
  if (code === 'over_request_rate_limit' || code === 'over_email_send_rate_limit' || /attempt|rate/i.test(message)) {
    return 'tooMany';
  }
  return 'invalid';
}

function VerifyEmailForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = (searchParams.get('email') ?? '').trim().toLowerCase();
  const validEmail = /.+@.+\..+/.test(email);

  const [code, setCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [errorKind, setErrorKind] = useState<VerifyErrorKind>(null);
  const [networkError, setNetworkError] = useState<string | null>(null);
  const [verified, setVerified] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendError, setResendError] = useState<string | null>(null);
  const [resendInfo, setResendInfo] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN_SECONDS);
  const routingRef = useRef(false);

  useEffect(() => {
    if (cooldown <= 0) {
      return;
    }
    const timer = setInterval(() => {
      setCooldown((seconds) => (seconds > 0 ? seconds - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const routeAfterVerification = useCallback(
    (session: SessionData) => {
      if (routingRef.current) {
        return;
      }
      routingRef.current = true;
      setVerified(true);
      // Brief success state so the confirmation is perceivable, then continue
      // into the application (no pharmacy yet -> onboarding, else dashboard).
      window.setTimeout(() => {
        router.replace(session.activePharmacy ? '/dashboard' : '/onboarding');
        router.refresh();
      }, 1500);
    },
    [router],
  );

  async function verify(token: string) {
    if (verifying || verified || token.length !== 6) {
      return; // prevent duplicate submissions
    }
    setErrorKind(null);
    setNetworkError(null);
    setVerifying(true);
    try {
      const supabase = createBrowserSupabase();
      const { data, error } = await supabase.auth.verifyOtp({
        email,
        token,
        type: 'signup',
      });
      if (error || !data.session) {
        setErrorKind(mapOtpError(error?.code ?? '', error?.message ?? ''));
        return;
      }
      const session = await api.post<SessionData>('/auth/session', {
        accessToken: data.session.access_token,
        refreshToken: data.session.refresh_token,
      });
      routeAfterVerification(session);
    } catch (cause) {
      setNetworkError(
        cause instanceof ApiClientError && cause.message ? cause.message : NETWORK_ERROR_MESSAGE,
      );
    } finally {
      setVerifying(false);
    }
  }

  async function resend() {
    if (resending || cooldown > 0 || verified) {
      return;
    }
    setResending(true);
    setResendError(null);
    setResendInfo(null);
    try {
      // Backend enforces its own rate limit; GoTrue enforces the provider one.
      // Anti-enumeration: the response is identical for unknown accounts.
      await api.post('/auth/resend-verification', { email });
      setCooldown(RESEND_COOLDOWN_SECONDS);
      setResendInfo(`A new verification code is on its way to ${email}.`);
    } catch (cause) {
      setResendError(
        cause instanceof ApiClientError && cause.message ? cause.message : NETWORK_ERROR_MESSAGE,
      );
    } finally {
      setResending(false);
    }
  }

  if (verified) {
    return (
      <AuthLayout>
        <div className="text-center">
          <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-status-safe-bg">
            <CircleCheck className="size-6 text-status-safe-fg" aria-hidden />
          </span>
          <h1 className="mt-4 text-xl font-semibold tracking-tight">Email verified successfully.</h1>
          <p className="mt-2 text-sm leading-relaxed text-text-muted">Redirecting to your pharmacy…</p>
          <Loader2 className="mx-auto mt-4 size-5 animate-spin text-primary-700" aria-hidden />
        </div>
      </AuthLayout>
    );
  }

  if (!validEmail) {
    return (
      <AuthLayout>
        <div className="text-center">
          <h1 className="text-xl font-semibold tracking-tight">Verify your email</h1>
          <div className="mt-3 text-left">
            <AuthError message="This page needs a verification email. Create an account or sign in to continue." />
          </div>
          <Link
            href="/signup"
            className="mt-6 flex h-10 items-center justify-center rounded-md bg-primary-700 text-sm font-medium text-white transition-colors duration-150 hover:bg-primary-800"
          >
            Create an account
          </Link>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <div>
        <span className="flex size-12 items-center justify-center rounded-full bg-primary-50">
          <MailCheck className="size-6 text-primary-700" aria-hidden />
        </span>
        <h1 className="mt-4 text-2xl font-semibold tracking-tight">Check your email</h1>
        <p className="mt-1 text-sm text-text-muted">We&apos;ve sent a verification code to:</p>
        <p className="mt-1 text-sm font-medium text-text">{email}</p>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            void verify(code);
          }}
          className="mt-8 space-y-5"
          noValidate
        >
          <OTPInput value={code} onChange={setCode} disabled={verifying || verified} />

          {errorKind ? <AuthError message={VERIFY_ERROR_MESSAGES[errorKind]} /> : null}
          {networkError ? <AuthError message={networkError} /> : null}
          {resendError ? <AuthError message={resendError} /> : null}
          {resendInfo ? (
            <p className="rounded-md border border-status-safe-border bg-status-safe-bg px-3 py-2 text-sm text-status-safe-fg" role="status">
              {resendInfo}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={code.length !== 6 || verifying || verified}
            className="h-12 w-full rounded-lg bg-primary-700 text-sm font-medium text-white transition-colors duration-150 hover:bg-primary-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {verifying ? 'Verifying…' : 'Verify'}
          </button>
        </form>

        <div className="mt-5 space-y-2 text-center text-sm text-text-muted">
          <p>
            {cooldown > 0 ? (
              <span>Resend code in {cooldown}s</span>
            ) : (
              <button
                type="button"
                onClick={() => void resend()}
                disabled={resending}
                className="font-medium text-primary-700 transition-colors duration-150 hover:text-primary-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {resending ? 'Sending…' : 'Resend code'}
              </button>
            )}
          </p>
          <p>
            <Link
              href="/signup"
              className="font-medium text-primary-700 transition-colors duration-150 hover:text-primary-800"
            >
              Change email
            </Link>
          </p>
        </div>
      </div>
    </AuthLayout>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <AuthLayout>
          <div className="text-center text-sm text-text-muted">Loading…</div>
        </AuthLayout>
      }
    >
      <VerifyEmailForm />
    </Suspense>
  );
}
