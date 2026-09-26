import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getEnv } from '../config/env.js';

/**
 * Supabase clients (architecture.md §6, code-standards.md §2).
 *
 * - supabaseAdmin uses the SECRET key. Server-only. Bypasses RLS.
 * - supabaseAuth uses the PUBLISHABLE key for Auth operations that must run
 *   with user-level semantics (sign-in, password reset email).
 * - supabaseRecovery is an implicit-flow variant of supabaseAuth used ONLY
 *   for resetPasswordForEmail: with the default PKCE flow the code verifier
 *   is generated and stored in THIS server process, so the browser could
 *   never complete the exchange ("Auth session missing"). Implicit links
 *   carry the tokens in the URL fragment, which the /reset-password page
 *   exchanges directly in the same browser that opened the email.
 *
 * These clients must never be imported from frontend code.
 */

let adminClient: SupabaseClient | null = null;
let authClient: SupabaseClient | null = null;
let recoveryClient: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient {
  if (!adminClient) {
    const env = getEnv();
    adminClient = createClient(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }
  return adminClient;
}

export function getSupabaseAuth(): SupabaseClient {
  if (!authClient) {
    const env = getEnv();
    authClient = createClient(env.SUPABASE_URL, env.SUPABASE_PUBLISHABLE_KEY, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }
  return authClient;
}

export function getSupabaseRecovery(): SupabaseClient {
  if (!recoveryClient) {
    const env = getEnv();
    recoveryClient = createClient(env.SUPABASE_URL, env.SUPABASE_PUBLISHABLE_KEY, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        flowType: 'implicit',
      },
    });
  }
  return recoveryClient;
}

/** Test helper. */
export function resetSupabaseClients(): void {
  adminClient = null;
  authClient = null;
  recoveryClient = null;
}
