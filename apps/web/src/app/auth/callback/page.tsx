'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { createBrowserSupabase } from '@/lib/supabase';
import { api, ApiClientError, type SessionData } from '@/lib/api';
import { AuthError } from '@/components/auth/auth-error';
import { AuthLayout } from '@/components/auth/auth-layout';

/**
 * OAuth callback (/auth/callback, ui-registry §10): the provider returns the
 * browser here with a PKCE authorization code. The code is exchanged for a
 * Supabase session (approved public auth operation - architecture.md §3),
 * which is handed to the backend POST /auth/session; the API re-validates
 * the access token server-side and issues the HttpOnly application cookies.
 * The browser Supabase session itself is discarded by design
 * (persistSession: false) - the application session lives in cookies.
 */

type CallbackState = 'connecting' | 'verifying' | 'error';

export default function AuthCallbackPage() {
  const router = useRouter();
  const [state, setState] = useState<CallbackState>('connecting');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) {
      return; // Strict-mode / double-effect guard
    }
    started.current = true;

    async function complete() {
      const params = new URLSearchParams(window.location.search);
      const providerError = params.get('error');
      const code = params.get('code');

      if (providerError) {
        setState('error');
        setErrorMessage(
          providerError === 'access_denied'
            ? 'Sign-in was cancelled. You can try again whenever you are ready.'
            : 'Unable to sign in with this provider. Please try again.',
        );
        return;
      }

      if (!code) {
        setState('error');
        setErrorMessage(
          'This sign-in link is invalid or has expired. Please start again from the sign-in page.',
        );
        return;
      }

      setState('verifying');
      try {
        const supabase = createBrowserSupabase();
        const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
        if (exchangeError || !data.session) {
          throw exchangeError ?? new Error('PKCE exchange returned no session');
        }

        const session = await api.post<SessionData>('/auth/session', {
          accessToken: data.session.access_token,
          refreshToken: data.session.refresh_token,
        });

        router.replace(session.activePharmacy ? '/dashboard' : '/onboarding');
        router.refresh();
      } catch (cause) {
        setState('error');
        setErrorMessage(
          cause instanceof ApiClientError && cause.message
            ? cause.message
            : 'Unable to sign in with this provider. Please try again.',
        );
      }
    }

    void complete();
  }, [router]);

  return (
    <AuthLayout>
      <div className="text-center">
        {state !== 'error' ? (
          <>
            <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-primary-50">
              <Loader2 className="size-6 animate-spin text-primary-700" aria-hidden />
            </span>
            <h1 className="mt-4 text-xl font-semibold tracking-tight">
              {state === 'connecting' ? 'Completing sign-in…' : 'Verifying your session…'}
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-text-muted">
              Please wait while we finish signing you in to PharmaGuard.
            </p>
          </>
        ) : (
          <>
            <h1 className="text-xl font-semibold tracking-tight">Sign-in could not be completed</h1>
            <div className="mt-3 text-left">
              <AuthError message={errorMessage ?? 'Unable to sign in with this provider. Please try again.'} />
            </div>
            <Link
              href="/login"
              className="mt-6 flex h-10 items-center justify-center rounded-md bg-primary-700 text-sm font-medium text-white transition-colors duration-150 hover:bg-primary-800"
            >
              Back to sign in
            </Link>
          </>
        )}
      </div>
    </AuthLayout>
  );
}
