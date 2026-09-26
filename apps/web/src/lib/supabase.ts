import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Browser Supabase clients - publishable key only (safe by design).
 *
 * Used exclusively for the public auth operations the browser must perform
 * itself (approved auth operations, architecture.md §3): the recovery
 * session resolution on /reset-password (URL code/fragment tokens are
 * cryptographically bound to this browser) and the signup email
 * confirmation on /auth/confirm. Every other authenticated operation goes
 * through the backend API.
 *
 * Two flavours:
 * - createBrowserSupabase(): process-wide SINGLETON with a persisted
 *   session. The recovery flow spans multiple page loads (send email ->
 *   open link -> submit form), and the resolved session plus any PKCE
 *   verifier must survive them AND be visible to every component instance
 *   - a per-call client would resolve the session into its own memory and
 *   the submit step would fail with GoTrue's "Auth session missing!".
 *   The recovery session is one-shot: /reset-password signs out right
 *   after a successful password update, so it never becomes an app login.
 * - createEphemeralSupabase(): per-call client with persistSession:false,
 *   used by /auth/confirm where the resolved session is handed to the
 *   backend /auth/session endpoint and must never touch localStorage.
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

function assertConfigured(): { url: string; key: string } {
  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
    throw new Error(
      'Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.',
    );
  }
  return { url: SUPABASE_URL, key: SUPABASE_PUBLISHABLE_KEY };
}

let browserClient: SupabaseClient | null = null;

export function createBrowserSupabase(): SupabaseClient {
  if (browserClient) {
    return browserClient;
  }
  const { url, key } = assertConfigured();
  browserClient = createClient(url, key, {
    auth: {
      // Persisted so the recovery session (and any PKCE verifier) survives
      // the email round-trip and is shared across the resolve + submit steps.
      persistSession: true,
      autoRefreshToken: true,
      // The URL tokens are consumed manually by the recovery page.
      detectSessionInUrl: false,
    },
  });
  return browserClient;
}

export function createEphemeralSupabase(): SupabaseClient {
  const { url, key } = assertConfigured();
  return createClient(url, key, {
    auth: {
      // The confirmed session is handed to the backend and discarded -
      // never written to localStorage.
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}
