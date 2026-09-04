import { z } from 'zod';

/**
 * Environment configuration (architecture.md §8, TRD §27).
 *
 * Parsed lazily and memoized via getEnv() so that unit tests can import
 * modules without requiring real credentials, while the running server
 * still fails fast with a clear report when configuration is missing.
 */

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  API_URL: z.string().url().default('http://localhost:4000'),
  FRONTEND_URL: z.string().url('FRONTEND_URL must be a valid URL'),
  CORS_ALLOWED_ORIGINS: z
    .string()
    .min(1, 'CORS_ALLOWED_ORIGINS must list at least one origin'),
  COOKIE_SECURE: z
    .string()
    .optional()
    .transform((value) => value === 'true' || value === '1'),

  // Supabase - server-only secrets. Never exposed to the browser.
  SUPABASE_URL: z.string().url('SUPABASE_URL must be a valid URL'),
  SUPABASE_PUBLISHABLE_KEY: z.string().min(20, 'SUPABASE_PUBLISHABLE_KEY looks invalid'),
  SUPABASE_SECRET_KEY: z.string().min(20, 'SUPABASE_SECRET_KEY looks invalid'),
  SUPABASE_JWKS_URL: z.string().url('SUPABASE_JWKS_URL must be a valid URL'),

  // Phase 5 (AI OCR). GEMINI_API_KEY is validated where it is used
  // (apps/api/src/modules/ocr/gemini.ts); GEMINI_MODEL overrides the default
  // vision model for testing.
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_MODEL: z.string().min(1).optional(),

  // Expiry engine (TRD §10 "Make thresholds configurable"). Days-left
  // thresholds for the CRITICAL and WARNING buckets; SAFE is anything beyond
  // the warning window.
  EXPIRY_CRITICAL_DAYS: z.coerce.number().int().min(0).max(365).default(30),
  EXPIRY_WARNING_DAYS: z.coerce.number().int().min(1).max(730).default(90),

  AUDIT_IP_SALT: z.string().default(''),
});

export type AppEnv = z.infer<typeof envSchema> & {
  corsOrigins: string[];
  isProduction: boolean;
};

let cachedEnv: AppEnv | null = null;

export class EnvValidationError extends Error {
  constructor(public readonly issues: string[]) {
    super(
      `Invalid environment configuration:\n  - ${issues.join('\n  - ')}\n` +
        'Copy .env.example to .env and provide real values (never commit .env).',
    );
    this.name = 'EnvValidationError';
  }
}

/** Parse and memoize environment configuration. Throws EnvValidationError. */
export function getEnv(source: NodeJS.ProcessEnv = process.env): AppEnv {
  if (cachedEnv) return cachedEnv;

  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    const issues = parsed.error.issues.map(
      (issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`,
    );
    throw new EnvValidationError(issues);
  }

  const corsOrigins = parsed.data.CORS_ALLOWED_ORIGINS.split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);

  if (corsOrigins.includes('*')) {
    throw new EnvValidationError([
      'CORS_ALLOWED_ORIGINS: "*" is not allowed for the authenticated API (code-standards.md §10)',
    ]);
  }

  if (parsed.data.EXPIRY_WARNING_DAYS <= parsed.data.EXPIRY_CRITICAL_DAYS) {
    throw new EnvValidationError([
      'EXPIRY_WARNING_DAYS must be greater than EXPIRY_CRITICAL_DAYS (TRD §10)',
    ]);
  }

  cachedEnv = {
    ...parsed.data,
    corsOrigins,
    isProduction: parsed.data.NODE_ENV === 'production',
  };
  return cachedEnv;
}

/** Test helper: reset memoized env (used only by unit tests). */
export function resetEnvCache(): void {
  cachedEnv = null;
}
