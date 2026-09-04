import { z } from 'zod';
import {
  forgotPasswordSchema,
  loginSchema,
  resetPasswordSchema,
  signupSchema,
} from '@pharmaguard/validation';

/**
 * Client-side form schemas. Cross-field rules (confirm password, terms
 * acceptance) are presentation concerns and stay in the web app; the shared
 * package keeps only wire-format schemas enforced by the API.
 */

export const loginFormSchema = loginSchema;

export const signupFormSchema = signupSchema
  .extend({
    confirmPassword: z.string().min(1, 'Please confirm your password'),
    acceptTerms: z.literal(true, {
      message: 'You must accept the Terms & Conditions and Privacy Policy',
    }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match',
  });

export const forgotPasswordFormSchema = forgotPasswordSchema;

export const resetPasswordFormSchema = resetPasswordSchema
  .extend({
    confirmPassword: z.string().min(1, 'Please confirm your password'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match',
  });

export type SignupFormInput = z.infer<typeof signupFormSchema>;
export type ResetPasswordFormInput = z.infer<typeof resetPasswordFormSchema>;

export type PasswordStrengthLevel = 'weak' | 'fair' | 'good' | 'strong';

export interface PasswordStrengthResult {
  score: 0 | 1 | 2 | 3 | 4;
  level: PasswordStrengthLevel | null;
  label: string;
}

/**
 * Visual strength hint for the signup/reset forms. Scoring mirrors the
 * shared password policy (min 8 chars, letter + digit) and rewards longer,
 * more varied passwords. Empty input yields score 0 (no meter shown).
 */
export function passwordStrength(password: string): PasswordStrengthResult {
  if (password.length === 0) {
    return { score: 0, level: null, label: '' };
  }

  let score = 0;
  if (password.length >= 8) score += 1;
  if (/[A-Za-z]/.test(password) && /[0-9]/.test(password)) score += 1;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;

  const levels: Record<1 | 2 | 3 | 4, { level: PasswordStrengthLevel; label: string }> = {
    1: { level: 'weak', label: 'Weak' },
    2: { level: 'fair', label: 'Fair' },
    3: { level: 'good', label: 'Good' },
    4: { level: 'strong', label: 'Strong' },
  };

  if (score <= 1) {
    return { score: 1, level: 'weak', label: 'Weak' };
  }
  return { score: score as 2 | 3 | 4, ...levels[score as 2 | 3 | 4] };
}

/** Extracts the first readable message from a Zod error for inline display. */
export function firstIssueMessage(error: z.ZodError): string {
  return error.issues[0]?.message ?? 'Please check your input.';
}

/**
 * Maps Zod issues to a field-name -> message record for inline field errors.
 * The confirm-password/terms refinements report their own paths.
 */
export function issuesToFieldErrors(error: z.ZodError): Record<string, string> {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? 'form');
    if (!(key in fieldErrors)) {
      fieldErrors[key] = issue.message;
    }
  }
  return fieldErrors;
}
