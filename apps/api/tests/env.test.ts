import { describe, expect, it } from 'vitest';
import { getEnv, EnvValidationError, resetEnvCache } from '../src/config/env.js';

const validEnv = {
  NODE_ENV: 'development',
  PORT: '4000',
  API_URL: 'http://localhost:4000',
  FRONTEND_URL: 'http://localhost:3000',
  CORS_ALLOWED_ORIGINS: 'http://localhost:3000',
  COOKIE_SECURE: 'false',
  SUPABASE_URL: 'https://demo.supabase.co',
  SUPABASE_PUBLISHABLE_KEY: 'demo-publishable-key-000000000000',
  SUPABASE_SECRET_KEY: 'demo-secret-key-0000000000000000000000',
  SUPABASE_JWKS_URL: 'https://demo.supabase.co/auth/v1/.well-known/jwks.json',
};

describe('getEnv', () => {
  it('parses a valid environment and derives corsOrigins', () => {
    resetEnvCache();
    const env = getEnv(validEnv);
    expect(env.PORT).toBe(4000);
    expect(env.corsOrigins).toEqual(['http://localhost:3000']);
    expect(env.isProduction).toBe(false);
  });

  it('fails fast and lists every missing variable', () => {
    resetEnvCache();
    expect(() => getEnv({})).toThrow(EnvValidationError);
    try {
      getEnv({});
    } catch (error) {
      expect(error).toBeInstanceOf(EnvValidationError);
      const issues = (error as EnvValidationError).issues;
      expect(issues.some((issue) => issue.startsWith('FRONTEND_URL'))).toBe(true);
      expect(issues.some((issue) => issue.startsWith('SUPABASE_SECRET_KEY'))).toBe(true);
    }
  });

  it('rejects wildcard CORS origins (code-standards.md §10)', () => {
    resetEnvCache();
    expect(() =>
      getEnv({ ...validEnv, CORS_ALLOWED_ORIGINS: '*' }),
    ).toThrow(EnvValidationError);
  });

  it('rejects malformed URLs', () => {
    resetEnvCache();
    expect(() =>
      getEnv({ ...validEnv, SUPABASE_URL: 'not-a-url' }),
    ).toThrow(EnvValidationError);
  });

  it('marks production mode', () => {
    resetEnvCache();
    const env = getEnv({ ...validEnv, NODE_ENV: 'production', COOKIE_SECURE: 'true' });
    expect(env.isProduction).toBe(true);
    expect(env.COOKIE_SECURE).toBe(true);
    resetEnvCache();
  });
});
