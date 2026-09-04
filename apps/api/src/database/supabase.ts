import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getEnv } from '../config/env.js';

/**
 * Supabase clients (architecture.md §6, code-standards.md §2).
 *
 * - supabaseAdmin uses the SECRET key. Server-only. Bypasses RLS.
 * - supabaseAuth uses the PUBLISHABLE key for Auth operations that must run
 *   with user-level semantics (sign-in, password reset email).
 *
 * These clients must never be imported from frontend code.
 */

let adminClient: SupabaseClient | null = null;
let authClient: SupabaseClient | null = null;

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

/** Test helper. */
export function resetSupabaseClients(): void {
  adminClient = null;
  authClient = null;
}
