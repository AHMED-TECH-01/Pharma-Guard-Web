import { Router } from 'express';
import {
  forgotPasswordSchema,
  loginSchema,
  signupSchema,
} from '@pharmaguard/validation';
import { REFRESH_COOKIE } from '../../config/cookies.js';
import { clearAuthCookies, setAuthCookies } from '../../config/cookies.js';
import { requireAuth } from '../../middleware/auth.js';
import { getPermissionsForRole, PERMISSIONS } from '../../middleware/authorize.js';
import {
  loginLimiter,
  passwordResetLimiter,
  signupLimiter,
} from '../../middleware/rate-limit.js';
import { getValidatedBody, validateBody } from '../../middleware/validate.js';
import { ApiError } from '../../utils/api-error.js';
import { ok } from '../../utils/respond.js';
import {
  loadUserContext,
  login,
  refreshSession,
  revokeSession,
  sendPasswordResetEmail,
  signup,
} from './auth.service.js';

/**
 * Auth routes (TRD §7):
 *   POST /api/v1/auth/signup
 *   POST /api/v1/auth/login
 *   POST /api/v1/auth/logout
 *   POST /api/v1/auth/forgot-password
 *   POST /api/v1/auth/refresh
 *   GET  /api/v1/auth/me
 */
export const authRouter = Router();

authRouter.post(
  '/signup',
  signupLimiter,
  validateBody(signupSchema),
  async (req, res, next) => {
    try {
      const input = getValidatedBody(req, signupSchema);
      const result = await signup(input);
      ok(res, result, 201);
    } catch (error) {
      next(error);
    }
  },
);

authRouter.post(
  '/login',
  loginLimiter,
  validateBody(loginSchema),
  async (req, res, next) => {
    try {
      const input = getValidatedBody(req, loginSchema);
      const result = await login(input);
      setAuthCookies(res, result.accessToken, result.refreshToken, input.remember ?? true);
      ok(res, { user: result.user });
    } catch (error) {
      next(error);
    }
  },
);

authRouter.post('/logout', async (req, res, next) => {
  try {
    const refreshToken = req.cookies?.[REFRESH_COOKIE];
    if (typeof refreshToken === 'string' && refreshToken.length > 0) {
      await revokeSession(refreshToken);
    }
    clearAuthCookies(res);
    ok(res, { loggedOut: true });
  } catch (error) {
    next(error);
  }
});

authRouter.post(
  '/forgot-password',
  passwordResetLimiter,
  validateBody(forgotPasswordSchema),
  async (req, res, next) => {
    try {
      const input = getValidatedBody(req, forgotPasswordSchema);
      // Always responds success - no account enumeration.
      await sendPasswordResetEmail(input.email);
      ok(res, { sent: true });
    } catch (error) {
      next(error);
    }
  },
);

authRouter.post('/refresh', async (req, res, next) => {
  try {
    const refreshToken = req.cookies?.[REFRESH_COOKIE];
    if (typeof refreshToken !== 'string' || refreshToken.length === 0) {
      throw ApiError.unauthorized('Session expired. Please sign in again.');
    }
    const result = await refreshSession(refreshToken);
    setAuthCookies(res, result.accessToken, result.refreshToken);
    ok(res, { authenticated: true });
  } catch (error) {
    clearAuthCookies(res);
    next(error);
  }
});

authRouter.get('/me', requireAuth, async (req, res, next) => {
  try {
    if (!req.auth) {
      throw ApiError.unauthorized();
    }
    const user = await loadUserContext(req.auth.userId, req.auth.email);
    const active = user.memberships.find((membership) => membership.status === 'active');
    ok(res, {
      user,
      activePharmacy: active
        ? { pharmacyId: active.pharmacyId, pharmacyName: active.pharmacyName, role: active.role }
        : null,
      permissions: active ? getPermissionsForRole(active.role) : [],
      permissionKeys: PERMISSIONS,
    });
  } catch (error) {
    next(error);
  }
});
