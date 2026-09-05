'use client';

import { useState } from 'react';
import { createBrowserSupabase } from '@/lib/supabase';
import { AuthError } from './auth-error';

/**
 * OAuthButtons (ui-registry §5): Google / Microsoft sign-in via Supabase
 * Auth OAuth (PRD §10.2). The browser is redirected to the provider and
 * returns to /auth/callback, which exchanges the PKCE code and hands the
 * session to the backend. Provider-side failures (e.g. the provider not
 * being enabled in the Supabase dashboard yet) surface as a calm,
 * actionable AuthError - never raw provider errors (ui-rules §13).
 */

type OAuthProvider = 'google' | 'azure';

const OAUTH_CALLBACK_PATH = '/auth/callback';

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
      <path
        fill="#4285F4"
        d="M23.5 12.27c0-.85-.08-1.66-.22-2.45H12v4.64h6.45a5.52 5.52 0 0 1-2.39 3.62v3h3.87c2.26-2.09 3.57-5.16 3.57-8.81Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.07 7.94-2.91l-3.87-3a7.19 7.19 0 0 1-10.72-3.77H1.35v3.1A12 12 0 0 0 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.35 14.32a7.2 7.2 0 0 1 0-4.6v-3.1H1.35a12 12 0 0 0 0 10.8l4-3.1Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.43-3.43A11.98 11.98 0 0 0 1.35 6.62l4 3.1A7.19 7.19 0 0 1 12 4.75Z"
      />
    </svg>
  );
}

function MicrosoftMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
      <rect x="1" y="1" width="10.5" height="10.5" fill="#F25022" />
      <rect x="12.5" y="1" width="10.5" height="10.5" fill="#7FBA00" />
      <rect x="1" y="12.5" width="10.5" height="10.5" fill="#00A4EF" />
      <rect x="12.5" y="12.5" width="10.5" height="10.5" fill="#FFB900" />
    </svg>
  );
}

interface OAuthButtonsProps {
  action: 'Sign in' | 'Sign up';
  disabled?: boolean;
  /** Reference composition: LOGIN stacks both providers full-width,
   *  SIGN UP places them side by side. */
  layout?: 'stacked' | 'row';
}

export function OAuthButtons({ action, disabled = false, layout = 'stacked' }: OAuthButtonsProps) {
  const [pending, setPending] = useState<OAuthProvider | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSignIn(provider: OAuthProvider) {
    if (pending !== null) {
      return; // prevent duplicate submissions
    }
    setError(null);
    setPending(provider);
    try {
      // Redirects the browser to the provider; when the redirect succeeds
      // this page unloads and the flow continues on /auth/callback.
      const { error: oauthError } = await createBrowserSupabase().auth.signInWithOAuth({
        provider,
        options: { redirectTo: `${window.location.origin}${OAUTH_CALLBACK_PATH}` },
      });
      if (oauthError) {
        throw oauthError;
      }
    } catch {
      setPending(null);
      setError('Unable to sign in with this provider. Please try again.');
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3" aria-hidden>
        <span className="h-px flex-1 bg-border" />
        <span className="text-xs text-text-muted">or continue with</span>
        <span className="h-px flex-1 bg-border" />
      </div>
      <div
        className={
          layout === 'row' ? 'grid grid-cols-2 gap-3' : 'grid grid-cols-1 gap-3'
        }
      >
        <button
          type="button"
          disabled={disabled || pending !== null}
          onClick={() => void handleSignIn('google')}
          className="flex h-10 items-center justify-center gap-2 rounded-md border border-border bg-surface text-sm font-medium transition-colors duration-150 hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-60"
        >
          <GoogleMark />
          {pending === 'google'
            ? 'Connecting…'
            : layout === 'row'
              ? 'Google'
              : `${action} with Google`}
        </button>
        <button
          type="button"
          disabled={disabled || pending !== null}
          onClick={() => void handleSignIn('azure')}
          className="flex h-10 items-center justify-center gap-2 rounded-md border border-border bg-surface text-sm font-medium transition-colors duration-150 hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-60"
        >
          <MicrosoftMark />
          {pending === 'azure'
            ? 'Connecting…'
            : layout === 'row'
              ? 'Microsoft'
              : `${action} with Microsoft`}
        </button>
      </div>
      {error ? <AuthError message={error} /> : null}
    </div>
  );
}
