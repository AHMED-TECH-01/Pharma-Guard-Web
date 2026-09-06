import { describe, expect, it } from 'vitest';
import { resendVerificationSchema, sessionExchangeSchema } from '@pharmaguard/validation';

/**
 * Auth-upgrade contract tests: the resend-verification payload and the
 * session-exchange payload (signup verification / password recovery).
 * These pin the server-side rules the auth/verify-email, auth/confirm and
 * reset-password pages mirror.
 */

describe('resendVerificationSchema', () => {
  it('trims, lowercases, and accepts a valid email', () => {
    const result = resendVerificationSchema.parse({ email: '  Pharmacist@Example.COM ' });
    expect(result.email).toBe('pharmacist@example.com');
  });

  it('rejects missing or malformed emails', () => {
    expect(() => resendVerificationSchema.parse({})).toThrow();
    expect(() => resendVerificationSchema.parse({ email: 'not-an-email' })).toThrow();
    expect(() => resendVerificationSchema.parse({ email: 'a@b' })).toThrow();
  });
});

describe('sessionExchangeSchema', () => {
  const tokens = {
    accessToken: 'a'.repeat(40),
    refreshToken: 'b'.repeat(40),
  };

  it('accepts a token pair of realistic length', () => {
    expect(sessionExchangeSchema.parse(tokens)).toEqual(tokens);
  });

  it('rejects truncated or missing tokens', () => {
    expect(() =>
      sessionExchangeSchema.parse({ accessToken: 'short', refreshToken: tokens.refreshToken }),
    ).toThrow();
    expect(() =>
      sessionExchangeSchema.parse({ accessToken: tokens.accessToken, refreshToken: '' }),
    ).toThrow();
    expect(() => sessionExchangeSchema.parse({ accessToken: tokens.accessToken })).toThrow();
  });
});
