import type { PostgrestError } from '@supabase/supabase-js';

/**
 * Bounded retry for transient PostgREST faults (master spec §5).
 *
 * Supabase's REST edge intermittently rejects freshly minted internal
 * service-role JWTs with PGRST303 "JWT issued at future" (stale time cache);
 * the identical request succeeds moments later. Auth bootstrap lookups wrap
 * their queries here so a transient platform window resolves the data instead
 * of surfacing a 502 ("Profile service is unavailable") dead-end.
 * Deterministic faults (PGRST116 no-rows, permission/schema errors) are never
 * retried, so real bootstrap defects still fail fast with their distinct
 * diagnosis.
 */

const TRANSIENT_RETRY_DELAYS_MS = [250, 750] as const;

function isTransient(error: PostgrestError | null): boolean {
  if (!error) {
    return false;
  }
  return error.code === 'PGRST303' || /JWT issued at future/i.test(error.message);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function withTransientRetry<
  TResponse extends { error?: PostgrestError | null },
>(run: () => PromiseLike<TResponse>): Promise<TResponse> {
  let result: TResponse = await run();
  for (const delayMs of TRANSIENT_RETRY_DELAYS_MS) {
    if (!isTransient(result.error ?? null)) {
      return result;
    }
    await delay(delayMs);
    result = await run();
  }
  return result;
}
