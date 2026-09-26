import { describe, expect, it, vi } from 'vitest';
import { withTransientRetry } from '../src/utils/postgrest-retry.js';

/**
 * Pins the bounded-retry behavior that keeps auth bootstrap (confirm email,
 * login, requireAuth) resilient to the intermittent Supabase edge fault
 * PGRST303 "JWT issued at future" (stale time cache) without masking
 * deterministic bootstrap defects.
 */

function postgrestError(code: string, message = 'fault') {
  return { code, message, details: null, hint: null };
}

describe('withTransientRetry', () => {
  it('retries PGRST303 until the lookup succeeds', async () => {
    const run = vi
      .fn()
      .mockResolvedValueOnce({
        data: null,
        error: postgrestError('PGRST303', 'JWT issued at future'),
      })
      .mockResolvedValueOnce({ data: { id: 'u1' }, error: null });

    const result = await withTransientRetry(run);

    expect(result).toEqual({ data: { id: 'u1' }, error: null });
    expect(run).toHaveBeenCalledTimes(2);
  });

  it('does not retry deterministic faults like PGRST116', async () => {
    const run = vi.fn().mockResolvedValue({ data: null, error: postgrestError('PGRST116') });

    const result = await withTransientRetry(run);

    expect(result.error?.code).toBe('PGRST116');
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('gives up after the bounded retries and keeps the fault', async () => {
    const run = vi
      .fn()
      .mockResolvedValue({ data: null, error: postgrestError('PGRST303', 'JWT issued at future') });

    const result = await withTransientRetry(run);

    expect(run).toHaveBeenCalledTimes(3); // initial attempt + 2 retries
    expect(result.error?.code).toBe('PGRST303');
  });
});
