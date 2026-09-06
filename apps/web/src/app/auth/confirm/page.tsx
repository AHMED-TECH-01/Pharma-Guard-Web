'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { CircleCheck, Loader2, MailCheck } from 'lucide-react';
import { createBrowserSupabase } from '@/lib/supabase';
import { api, ApiClientError, type SessionData } from '@/lib/api';
import { AuthError } from '@/components/auth/auth-error';
import { AuthLayout } from '@/components/auth/auth-layout';

/**
 * Confirm email (/auth/confirm, ui-registry §10): completes signup email
 * confirmation for accounts created server-side (admin.createUser). The
 * confirmation email links here with the token hash
 * (?token_hash=...&type=signup&email=...); the exchange runs via verifyOtp
 * (approved public auth operation, architecture.md §3) - no code input is
 * required. The confirmed session is handed to the backend POST
 * /auth/session, which re-validates it server-side and issues the HttpOnly
 * application cookies; the browser session is discarded by design
 * (persistSession: false).
 */

const RESEND_COOLDOWN_SECONDS = 60;

type ConfirmErrorKind = 'invalid' | 'tooMany' | null;

const CONFIRM_ERROR_MESSAGES: Record<Exclude<ConfirmErrorKind, null>, string> = {
  invalid: 'This confirmation link is invalid or has expired. Request a new confirmation email below.',
  tooMany: 'Too many attempts. Please wait a moment before requesting a new email.',
};

const NETWORK_ERROR_MESSAGE = 'Something went wrong. Check your connection and try again.';

function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!local || !domain) {
    return email;
  }
  return `${local.slice(0, 1)}***@${domain}`;
}

function mapConfirmError(code: string, message: string): ConfirmErrorKind {
  if (code === 'over_request_rate_limit' || code === 'over_email_send_rate_limit' || /attempt|rate/i.test(message)) {
    return 'tooMany';
  }
  return 'invalid';
}

function ConfirmEmailForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tokenHash = (searchParams.get('token_hash') ?? '').trim();
  const type = (searchParams.get('type') ?? 'signup').trim();
  const email = (searchParams.get('email') ?? '').trim().toLowerCase();
  const validRequest = tokenHash.length > 0 && type === 'signup';

  const [confirming, setConfirming] = useState(false);
  const [errorKind, setErrorKind] = useState<ConfirmErrorKind>(null);
  const [networkError, setNetworkError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendError, setResendError] = useState<string | null>(null);
  const [resendInfo, setResendInfo] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN_SECONDS);
  const startedRef = useRef(false);

  useEffect(() => {
    if (cooldown <= 0) {
      return;
    }
    const timer = setInterval(() => {
      setCooldown((seconds) => (seconds > 0 ? seconds - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const routeAfterConfirmation = useCallback(
    (session: SessionData) => {
      setConfirmed(true);
      // Brief success state so the confirmation is perceivable, then continue
      // into the application (no pharmacy yet -> onboarding, else dashboard).
      window.setTimeout(() => {
        router.replace(session.activePharmacy ? '/dashboard' : '/onboarding');
        router.refresh();
      }, 1500);
    },
    [router],
  );

  useEffect(() => {
    if (startedRef.current || !validRequest) {
      return; // Strict-mode / double-effect guard
    }
    startedRef.current = true;

    async function confirm() {
      setConfirming(true);
      setErrorKind(null);
      setNetworkError(null);
      try {
        const supabase = createBrowserSupabase();
        const { data, error } = await supabase.auth.verifyOtp({
          type: 'signup',
          // snake_case on purpose: VerifyTokenHashParams mirrors GoTrue's wire field
          token_hash: tokenHash,
        });
        if (error || !data.session) {
          setErrorKind(mapConfirmError(error?.code ?? '', error?.message ?? ''));
          return;
        }
        const session = await api.post<SessionData>('/auth/session', {
          accessToken: data.session.access_token,
          refreshToken: data.session.refresh_token,
        });
        routeAfterConfirmation(session);
      } catch (cause) {
        setNetworkError(
          cause instanceof ApiClientError && cause.message ? cause.message : NETWORK_ERROR_MESSAGE,
        );
      } finally {
        setConfirming(false);
      }
    }

    void confirm();
  }, [routeAfterConfirmation, tokenHash, validRequest]);

  async function resend() {
    if (resending || cooldown > 0 || confirmed || !email) {
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
      setResendInfo(`A new confirmation email is on its way to ${maskEmail(email)}.`);
    } catch (cause) {
      setResendError(
        cause instanceof ApiClientError && cause.message ? cause.message : NETWORK_ERROR_MESSAGE,
      );
    } finally {
      setResending(false);
    }
  }

  if (confirmed) {
    return (
      <AuthLayout>
        <div className="text-center">
          <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-status-safe-bg">
            <CircleCheck className="size-6 text-status-safe-fg" aria-hidden />
          </span>
          <h1 className="mt-4 text-xl font-semibold tracking-tight">Email confirmed successfully.</h1>
          <p className="mt-2 text-sm leading-relaxed text-text-muted">Redirecting to your pharmacy…</p>
          <Loader2 className="mx-auto mt-4 size-5 animate-spin text-primary-700" aria-hidden />
        </div>
      </AuthLayout>
    );
  }

  if (!validRequest) {
    return (
      <AuthLayout>
        <div className="text-center">
          <h1 className="text-xl font-semibold tracking-tight">Confirm your email</h1>
          <div className="mt-3 text-left">
            <AuthError message="This page needs a confirmation email. Create an account or sign in to continue." />
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
      <div className="text-center">
        <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-primary-50">
          <MailCheck className="size-6 text-primary-700" aria-hidden />
        </span>
        <h1 className="mt-4 text-2xl font-semibold tracking-tight">Confirming your email…</h1>
        <p className="mt-1 text-sm text-text-muted">
          Please wait while we finish setting up your pharmacy account.
        </p>

        {confirming && !errorKind && !networkError ? (
          <Loader2 className="mx-auto mt-6 size-5 animate-spin text-primary-700" aria-hidden />
        ) : null}

        {errorKind ? (
          <div className="mt-5 text-left">
            <AuthError message={CONFIRM_ERROR_MESSAGES[errorKind]} />
          </div>
        ) : null}
        {networkError ? (
          <div className="mt-5 text-left">
            <AuthError message={networkError} />
          </div>
        ) : null}
        {resendError ? (
          <div className="mt-5 text-left">
            <AuthError message={resendError} />
          </div>
        ) : null}
        {resendInfo ? (
          <p
            className="mt-5 rounded-md border border-status-safe-border bg-status-safe-bg px-3 py-2 text-left text-sm text-status-safe-fg"
            role="status"
          >
            {resendInfo}
          </p>
        ) : null}

        {!confirmed && (errorKind || networkError) ? (
          <div className="mt-6 space-y-2 text-sm text-text-muted">
            {email ? (
              <p>
                {cooldown > 0 ? (
                  <span>Resend email in {cooldown}s</span>
                ) : (
                  <button
                    type="button"
                    onClick={() => void resend()}
                    disabled={resending}
                    className="font-medium text-primary-700 transition-colors duration-150 hover:text-primary-800 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {resending ? 'Sending…' : 'Resend confirmation email'}
                  </button>
                )}
              </p>
            ) : null}
            <p>
              <Link
                href="/signup"
                className="font-medium text-primary-700 transition-colors duration-150 hover:text-primary-800"
              >
                Create an account
              </Link>
            </p>
          </div>
        ) : null}
      </div>
    </AuthLayout>
  );
}

export default function ConfirmEmailPage() {
  return (
    <Suspense
      fallback={
        <AuthLayout>
          <div className="text-center text-sm text-text-muted">Loading…</div>
        </AuthLayout>
      }
    >
      <ConfirmEmailForm />
    </Suspense>
  );
}
