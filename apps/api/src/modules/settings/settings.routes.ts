import { Router, type Request } from 'express';
import type { NotificationPrefs, PharmacySettings } from '@pharmaguard/types';
import {
  changePasswordSchema,
  notificationPrefsSchema,
  updatePharmacySchema,
  updateProfileSchema,
} from '@pharmaguard/validation';
import { PERMISSIONS, requirePermission } from '../../middleware/authorize.js';
import { getValidatedBody, validateBody } from '../../middleware/validate.js';
import { ApiError } from '../../utils/api-error.js';
import { ok } from '../../utils/respond.js';
import {
  changePassword,
  getNotificationPrefs,
  getPharmacySettings,
  updateNotificationPrefs,
  updateOwnProfile,
  updatePharmacySettings,
} from './settings.service.js';

/**
 * Settings routes (PRD §10.21, build-plan Phase 12):
 *   GET   /api/v1/settings/pharmacy            - any member (dashboard.read)
 *   PATCH /api/v1/settings/pharmacy            - OWNER only (settings.manage)
 *   PATCH /api/v1/settings/profile             - self-service
 *   GET   /api/v1/settings/notifications       - self-service
 *   PATCH /api/v1/settings/notifications       - self-service
 *   PATCH /api/v1/settings/security/password   - self-service, re-auth required
 *
 * Appearance settings are browser-local (localStorage) and have no API.
 */

function requireContext(req: Request): { pharmacyId: string; userId: string } {
  if (!req.pharmacyId) throw ApiError.forbidden('No pharmacy context on request');
  if (!req.auth) throw ApiError.unauthorized('Authentication required');
  return { pharmacyId: req.pharmacyId, userId: req.auth.userId };
}

/** Self-service routes: the user is authenticated but may have no pharmacy. */
function requireUser(req: Request): { userId: string; email: string; pharmacyId: string | null } {
  if (!req.auth) throw ApiError.unauthorized('Authentication required');
  return { userId: req.auth.userId, email: req.auth.email, pharmacyId: req.pharmacyId ?? null };
}

export const settingsRouter = Router();

settingsRouter.get(
  '/pharmacy',
  requirePermission(PERMISSIONS.dashboardRead),
  async (req, res, next) => {
    try {
      const settings: PharmacySettings = await getPharmacySettings(requireContext(req).pharmacyId);
      ok(res, settings);
    } catch (error) {
      next(error);
    }
  },
);

settingsRouter.patch(
  '/pharmacy',
  requirePermission(PERMISSIONS.settingsManage),
  validateBody(updatePharmacySchema),
  async (req, res, next) => {
    try {
      const { pharmacyId, userId } = requireContext(req);
      const settings: PharmacySettings = await updatePharmacySettings(
        pharmacyId,
        userId,
        getValidatedBody(req, updatePharmacySchema),
        req,
      );
      ok(res, settings);
    } catch (error) {
      next(error);
    }
  },
);

settingsRouter.patch('/profile', validateBody(updateProfileSchema), async (req, res, next) => {
  try {
    const user = requireUser(req);
    const profile = await updateOwnProfile(
      user.userId,
      user.pharmacyId,
      getValidatedBody(req, updateProfileSchema),
      req,
    );
    ok(res, profile);
  } catch (error) {
    next(error);
  }
});

settingsRouter.get('/notifications', async (req, res, next) => {
  try {
    const prefs: NotificationPrefs = await getNotificationPrefs(requireUser(req).userId);
    ok(res, prefs);
  } catch (error) {
    next(error);
  }
});

settingsRouter.patch(
  '/notifications',
  validateBody(notificationPrefsSchema),
  async (req, res, next) => {
    try {
      const user = requireUser(req);
      const prefs: NotificationPrefs = await updateNotificationPrefs(
        user.userId,
        user.pharmacyId,
        getValidatedBody(req, notificationPrefsSchema),
        req,
      );
      ok(res, prefs);
    } catch (error) {
      next(error);
    }
  },
);

settingsRouter.patch(
  '/security/password',
  validateBody(changePasswordSchema),
  async (req, res, next) => {
    try {
      const user = requireUser(req);
      await changePassword(
        user.userId,
        user.email,
        user.pharmacyId,
        getValidatedBody(req, changePasswordSchema),
        req,
      );
      ok(res, { updated: true });
    } catch (error) {
      next(error);
    }
  },
);
