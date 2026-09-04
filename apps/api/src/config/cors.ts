import type { CorsOptions } from 'cors';
import { getEnv } from './env.js';

/**
 * Strict CORS (code-standards.md §10, master spec §17).
 * Only explicitly allowlisted origins may call the authenticated API with
 * credentials. Arbitrary Origin values are never reflected.
 */
export function getCorsOptions(): CorsOptions {
  const env = getEnv();
  return {
    origin(origin, callback) {
      // Allow non-browser tools (curl, server-to-server) that send no Origin.
      if (!origin) {
        callback(null, true);
        return;
      }
      if (env.corsOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error('Origin not allowed by CORS'));
    },
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Pharmacy-Id', 'X-Request-Id'],
    exposedHeaders: ['X-Request-Id'],
    credentials: true,
    maxAge: 600,
  };
}
