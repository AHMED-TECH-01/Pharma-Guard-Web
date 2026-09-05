import { z } from 'zod';
import { optionalTrimmedString, passwordSchema, phoneSchema } from './common';

/** FR-001 Authentication — signup payload (also mirrors reference Sign Up page fields). */
export const signupSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, 'Full name must be at least 2 characters')
    .max(120, 'Full name must be at most 120 characters'),
  email: z.string().trim().toLowerCase().email('Must be a valid email address').max(255),
  password: passwordSchema,
  phone: phoneSchema.optional(),
});

/**
 * remember extends the session to persistent (7-day) cookies; when false the
 * cookies become browser-session cookies (apps/api/src/config/cookies.ts).
 */
export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Must be a valid email address').max(255),
  password: z.string().min(1, 'Password is required').max(72),
  remember: z.boolean().optional(),
});

export const forgotPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().email('Must be a valid email address').max(255),
});

/** Password reset completion (password only — token handled server-side). */
export const resetPasswordSchema = z.object({
  password: passwordSchema,
});

/**
 * Resend the signup email-verification OTP. Anti-enumeration: the route
 * always answers the same regardless of account state.
 */
export const resendVerificationSchema = z.object({
  email: z.string().trim().toLowerCase().email('Must be a valid email address').max(255),
});

/**
 * Session exchange (FR-001 upgrade: OAuth PKCE callback / signup OTP
 * verification). The browser completes a Supabase public auth operation and
 * hands the resulting session to the backend; the access token is
 * re-validated server-side (never trusted from the client) before the
 * HttpOnly application cookies are issued.
 */
export const sessionExchangeSchema = z.object({
  accessToken: z.string().min(20, 'Access token is missing').max(4096),
  // Supabase refresh tokens are opaque and currently ~12 chars (older projects
  // issued ~40-char JWTs). A sanity floor only - the token itself is verified
  // server-side (auth.getUser) before any cookie is issued.
  refreshToken: z.string().min(6, 'Refresh token is missing').max(4096),
});

/** FR-002 Pharmacy Profile — created during onboarding. */
export const createPharmacySchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Pharmacy name must be at least 2 characters')
    .max(255, 'Pharmacy name must be at most 255 characters'),
  ownerName: optionalTrimmedString(255),
  phone: phoneSchema.optional(),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email('Must be a valid email address')
    .max(255)
    .optional(),
  address: optionalTrimmedString(1000),
});

export type SignupInput = z.infer<typeof signupSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type ResendVerificationInput = z.infer<typeof resendVerificationSchema>;
export type SessionExchangeInput = z.infer<typeof sessionExchangeSchema>;
export type CreatePharmacyInput = z.infer<typeof createPharmacySchema>;
