import { z } from 'zod';

/** Shared primitives reused across schemas. */

export const uuidSchema = z.string().uuid('Must be a valid identifier');

export const idParamSchema = z.object({
  id: uuidSchema,
});

/**
 * Pagination schema. Values arrive as query strings, so they are coerced.
 * Server route handlers must also allowlist sort/filter columns separately
 * (SQL-injection allowlist rule, code-standards.md §7).
 */
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const phoneSchema = z
  .string()
  .trim()
  .regex(
    /^[0-9+()\-\s]{7,20}$/,
    'Must be a valid phone number (7-20 digits, may include + ( ) -)',
  );

export const optionalTrimmedString = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Must be at most ${max} characters`)
    .optional()
    .or(z.literal(''))
    .transform((value) => (value === '' ? undefined : value));

/** Password policy: min 8 chars, at least one letter and one digit. */
export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(72, 'Password must be at most 72 characters')
  .regex(/[A-Za-z]/, 'Password must contain at least one letter')
  .regex(/[0-9]/, 'Password must contain at least one number');

export type PaginationInput = z.infer<typeof paginationSchema>;
