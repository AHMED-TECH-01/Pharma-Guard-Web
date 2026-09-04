import { createClient } from '@supabase/supabase-js';

/**
 * Browser Supabase client - publishable key only (safe by design).
 *
 * Used exclusively for the password-recovery completion step: the recovery
 * email link lands on /reset-password with a PKCE code or implicit-flow
 * tokens bound to this browser, so the exchange must happen here
 * (approved auth operation, architecture.md §3 - see auth.service.ts).
 * Every other authenticated operation goes through the backend API.
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export function createBrowserSupabase() {
  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
    throw new Error(
      'Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.',
    );
  }
  return createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: {
      // The recovery session is used once to set a new password, then
      // discarded; it must never be treated as an app login.
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}
