import type { AuthUserContext } from '@pharmaguard/types';
import { getEnv } from '../../config/env.js';
import { getSupabaseAdmin, getSupabaseAuth } from '../../database/supabase.js';
import { ApiError } from '../../utils/api-error.js';
import { logger } from '../../utils/logger.js';
import type { MembershipSummary } from '../../types/request.js';

/**
 * Authentication service (FR-001, TRD §5).
 * Passwords and tokens are handled by Supabase Auth; this service never
 * stores, logs, or returns them beyond the short-lived session flow.
 */

export interface SignupResult {
  userId: string;
  requiresEmailVerification: boolean;
}

export interface LoginResult {
  accessToken: string;
  refreshToken: string;
  user: AuthUserContext;
}

export interface RefreshResult {
  accessToken: string;
  refreshToken: string;
}

function mapAuthError(error: { status?: number; code?: string; message?: string }): ApiError {
  const code = error.code ?? '';
  if (code === 'email_exists' || code === 'user_already_exists') {
    return ApiError.conflict('An account with this email already exists');
  }
  if (code === 'invalid_credentials' || code === 'user_not_found' || code === 'user_banned') {
    return ApiError.unauthorized('Invalid email or password');
  }
  if (code === 'email_not_confirmed') {
    return ApiError.unauthorized('Please verify your email address before signing in');
  }
  if (code === 'over_request_rate_limit' || code === 'over_email_send_rate_limit') {
    return ApiError.rateLimited('Too many attempts. Please wait and try again.');
  }
  if (error.status === 422 || code === 'weak_password' || code === 'validation_failed') {
    // Validation messages from the auth provider are user-actionable and safe.
    return ApiError.validation(error.message ?? 'Invalid authentication data');
  }
  logger.error('supabase_auth_error', { code, status: error.status });
  return ApiError.externalService('Authentication service is unavailable');
}

export async function signup(input: {
  fullName: string;
  email: string;
  password: string;
  phone?: string;
}): Promise<SignupResult> {
  const { data, error } = await getSupabaseAdmin().auth.admin.createUser({
    email: input.email,
    password: input.password,
    // Email confirmation follows the project's Supabase Auth configuration.
    email_confirm: false,
    user_metadata: {
      full_name: input.fullName,
      phone: input.phone ?? '',
    },
  });

  if (error) {
    throw mapAuthError(error);
  }
  if (!data.user) {
    throw ApiError.externalService('Authentication service is unavailable');
  }

  // The handle_new_user trigger creates the profiles row.
  return { userId: data.user.id, requiresEmailVerification: true };
}

export async function login(input: { email: string; password: string }): Promise<LoginResult> {
  const { data, error } = await getSupabaseAuth().auth.signInWithPassword({
    email: input.email,
    password: input.password,
  });

  if (error || !data.session || !data.user) {
    throw mapAuthError(error ?? {});
  }

  const user = await loadUserContext(data.user.id, data.user.email ?? input.email);
  return {
    accessToken: data.session.access_token,
    refreshToken: data.session.refresh_token,
    user,
  };
}

export async function refreshSession(refreshToken: string): Promise<RefreshResult> {
  const { data, error } = await getSupabaseAuth().auth.refreshSession({
    refresh_token: refreshToken,
  });

  if (error || !data.session) {
    throw ApiError.unauthorized('Session expired. Please sign in again.');
  }

  return {
    accessToken: data.session.access_token,
    refreshToken: data.session.refresh_token,
  };
}

export async function revokeSession(refreshToken: string): Promise<void> {
  const { error } = await getSupabaseAdmin().auth.admin.signOut(refreshToken);
  if (error) {
    logger.warn('session_revoke_failed', { code: error.code ?? error.message });
  }
}

/**
 * Sends the password-reset email (rate limited at the route). The response
 * is identical whether or not the account exists, to prevent enumeration.
 * Completion happens via the Supabase recovery link; the frontend (approved
 * auth operation, architecture.md §3) exchanges the code and updates the
 * password through Supabase Auth directly.
 */
export async function sendPasswordResetEmail(email: string): Promise<{ sent: true }> {
  const { FRONTEND_URL } = getEnv();
  const { error } = await getSupabaseAuth().auth.resetPasswordForEmail(email, {
    redirectTo: `${FRONTEND_URL}/reset-password`,
  });
  if (error) {
    logger.warn('password_reset_send_failed', { code: error.code ?? error.message });
  }
  return { sent: true };
}

/**
 * Sends/resends the signup verification email through Supabase Auth.
 * GoTrue generates, hashes, stores, expires (10 min), and rate-limits the
 * 6-digit code - this service never sees it. The template displays the
 * code, which the user enters on the frontend /verify-email page (or, if
 * the dashboard template is switched to links, /auth/confirm). Failures
 * are logged but not surfaced so the response cannot enumerate accounts.
 */
export async function sendVerificationEmail(email: string): Promise<void> {
  const { error } = await getSupabaseAuth().auth.resend({
    type: 'signup',
    email,
  });
  if (error) {
    logger.warn('verification_email_send_failed', { code: error.code ?? error.message });
  }
}

export interface ExchangeSessionResult {
  accessToken: string;
  refreshToken: string;
  user: AuthUserContext;
}

/**
 * Completes a browser-side Supabase public auth operation (signup OTP
 * verification or password-recovery PKCE): the browser hands over the session
 * it received from Supabase Auth, the access token is re-validated
 * server-side, and the user context is loaded before any application
 * session cookies are issued.
 */
export async function exchangeSession(input: {
  accessToken: string;
  refreshToken: string;
}): Promise<ExchangeSessionResult> {
  const { data, error } = await getSupabaseAuth().auth.getUser(input.accessToken);
  if (error || !data.user) {
    throw ApiError.unauthorized('Unable to complete sign-in. Please try again.');
  }

  const user = await loadUserContext(data.user.id, data.user.email ?? '');
  return {
    accessToken: input.accessToken,
    refreshToken: input.refreshToken,
    user,
  };
}

export async function loadUserContext(
  userId: string,
  email: string,
): Promise<AuthUserContext> {
  const supabase = getSupabaseAdmin();

  const [{ data: profile, error: profileError }, { data: membershipRows, error: membershipError }] =
    await Promise.all([
      supabase.from('profiles').select('id, full_name, phone').eq('id', userId).single(),
      supabase
        .from('pharmacy_memberships')
        .select('pharmacy_id, role, status, pharmacies(name)')
        .eq('user_id', userId),
    ]);

  if (profileError) {
    // PGRST116 = .single() matched no rows: the authenticated user genuinely
    // has no profile row. Any other code is an infrastructure fault (missing
    // grants, RLS, network) and must not be surfaced as "Account profile not
    // found" - it needs a distinct bootstrap diagnosis (master spec §5).
    if (profileError.code === 'PGRST116') {
      throw ApiError.unauthorized('Account profile not found');
    }
    logger.error('profile_lookup_failed', {
      code: profileError.code,
      message: profileError.message,
    });
    throw ApiError.externalService('Profile service is unavailable');
  }
  if (!profile) {
    throw ApiError.unauthorized('Account profile not found');
  }
  if (membershipError) {
    logger.error('membership_lookup_failed', {
      code: membershipError.code,
      message: membershipError.message,
    });
    throw ApiError.externalService('Unable to resolve memberships');
  }

  const memberships = (membershipRows ?? []).map((row): MembershipSummary => {
    const record = row as {
      pharmacy_id: string;
      role: MembershipSummary['role'];
      status: MembershipSummary['status'];
      pharmacies: { name: string } | { name: string }[] | null;
    };
    const pharmacy = Array.isArray(record.pharmacies) ? record.pharmacies[0] : record.pharmacies;
    return {
      pharmacyId: record.pharmacy_id,
      pharmacyName: pharmacy?.name ?? null,
      role: record.role,
      status: record.status,
    };
  });

  return {
    userId: profile.id,
    email,
    fullName: profile.full_name ?? '',
    phone: profile.phone ?? null,
    memberships,
  };
}
