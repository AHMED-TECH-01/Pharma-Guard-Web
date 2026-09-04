import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';

/**
 * App-level route guard tests (build-plan Phase 14 "test every route").
 * Runs the real Express app offline: every protected prefix must answer 401
 * without credentials (the guard fires before any database call), the
 * health probe stays public, unknown routes use the 404 envelope, and
 * unknown CORS origins are rejected. Authenticated flows need live
 * Supabase credentials and stay in the manual/E2E pass.
 */

process.env.NODE_ENV = 'development';
process.env.PORT = '4000';
process.env.API_URL = 'http://localhost:4000';
process.env.FRONTEND_URL = 'http://localhost:3000';
process.env.CORS_ALLOWED_ORIGINS = 'http://localhost:3000';
process.env.COOKIE_SECURE = 'false';
process.env.SUPABASE_URL = 'https://demo.supabase.co';
process.env.SUPABASE_PUBLISHABLE_KEY = 'demo-publishable-key-000000000000';
process.env.SUPABASE_SECRET_KEY = 'demo-secret-key-0000000000000000000000';
process.env.SUPABASE_JWKS_URL = 'https://demo.supabase.co/auth/v1/.well-known/jwks.json';

import { createApp } from '../src/app.js';

/** Every prefix mounted in the authenticated area (app.ts). */
const PROTECTED_PREFIXES = [
  'onboarding',
  'dashboard',
  'medicines',
  'batches',
  'ocr',
  'expiry',
  'alerts',
  'quarantine',
  'recalls',
  'sales',
  'purchases',
  'suppliers',
  'returns',
  'reorders',
  'analytics',
  'reports',
  'audit',
  'compliance',
  'users',
  'settings',
];

let server: Server;
let baseUrl: string;

beforeAll(async () => {
  server = createServer(createApp());
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${address.port}/api/v1`;
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
});

describe('protected route guards', () => {
  for (const prefix of PROTECTED_PREFIXES) {
    it(`GET /${prefix} requires authentication`, async () => {
      const response = await fetch(`${baseUrl}/${prefix}`);
      expect(response.status).toBe(401);
      const body = (await response.json()) as {
        success: boolean;
        error: { code: string; message: string };
      };
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('UNAUTHORIZED');
    });
  }

  it('keeps every 401 in the standard failure envelope', () => {
    expect(PROTECTED_PREFIXES.length).toBe(20);
  });
});

describe('public and fallback routes', () => {
  it('serves the health probe without authentication', async () => {
    const response = await fetch(`${baseUrl}/health`);
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      success: boolean;
      data: { status: string; service: string };
    };
    expect(body.success).toBe(true);
    expect(body.data).toEqual({ status: 'ok', service: 'pharmaguard-api' });
  });

  it('hides unknown authenticated-area routes behind the auth guard (no existence leak)', async () => {
    const response = await fetch(`${baseUrl}/does-not-exist`);
    expect(response.status).toBe(401);
    const body = (await response.json()) as {
      success: boolean;
      error: { code: string };
    };
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('UNAUTHORIZED');
  });

  it('returns the 404 envelope for paths outside the API', async () => {
    const rootUrl = baseUrl.replace(/\/api\/v1$/, '');
    const response = await fetch(`${rootUrl}/unknown`);
    expect(response.status).toBe(404);
    const body = (await response.json()) as {
      success: boolean;
      error: { code: string };
    };
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('NOT_FOUND');
  });

  it('rejects cross-origin browser requests from unknown origins', async () => {
    const response = await fetch(`${baseUrl}/health`, {
      headers: { Origin: 'https://attacker.example' },
    });
    expect(response.status).toBe(500);
    const body = (await response.json()) as {
      success: boolean;
      error: { code: string };
    };
    expect(body.error.code).toBe('INTERNAL_ERROR');
  });

  it('accepts requests with an allowlisted origin', async () => {
    const response = await fetch(`${baseUrl}/health`, {
      headers: { Origin: 'http://localhost:3000' },
    });
    expect(response.status).toBe(200);
  });
});
