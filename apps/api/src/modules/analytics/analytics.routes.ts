import { Router, type Request } from 'express';
import type {
  AnalyticsInventory,
  AnalyticsOverview,
  AnalyticsReorders,
  AnalyticsSales,
  ExpirySummary,
} from '@pharmaguard/types';
import { analyticsSalesQuerySchema } from '@pharmaguard/validation';
import { PERMISSIONS, requirePermission } from '../../middleware/authorize.js';
import { getValidatedQuery, validateQuery } from '../../middleware/validate.js';
import { ApiError } from '../../utils/api-error.js';
import { ok } from '../../utils/respond.js';
import {
  getExpiryAnalytics,
  getInventoryAnalytics,
  getOverview,
  getReordersAnalytics,
  getSalesAnalytics,
} from './analytics.service.js';

/**
 * Analytics endpoints (TRD §7 Analytics, PRD §10.17). Read-only aggregates,
 * OWNER/MANAGER only via analytics.read; the /sales window is validated and
 * bounded to 90 days.
 */

function requirePharmacy(req: Request): string {
  if (!req.pharmacyId) throw ApiError.forbidden('No pharmacy context on request');
  return req.pharmacyId;
}

export const analyticsRouter = Router();

analyticsRouter.get(
  '/overview',
  requirePermission(PERMISSIONS.analyticsRead),
  async (req, res, next) => {
    try {
      const overview: AnalyticsOverview = await getOverview(requirePharmacy(req));
      ok(res, overview);
    } catch (error) {
      next(error);
    }
  },
);

analyticsRouter.get(
  '/sales',
  requirePermission(PERMISSIONS.analyticsRead),
  validateQuery(analyticsSalesQuerySchema),
  async (req, res, next) => {
    try {
      const response: AnalyticsSales = await getSalesAnalytics(
        requirePharmacy(req),
        getValidatedQuery(req, analyticsSalesQuerySchema),
      );
      ok(res, response);
    } catch (error) {
      next(error);
    }
  },
);

analyticsRouter.get(
  '/inventory',
  requirePermission(PERMISSIONS.analyticsRead),
  async (req, res, next) => {
    try {
      const response: AnalyticsInventory = await getInventoryAnalytics(requirePharmacy(req));
      ok(res, response);
    } catch (error) {
      next(error);
    }
  },
);

analyticsRouter.get(
  '/expiry',
  requirePermission(PERMISSIONS.analyticsRead),
  async (req, res, next) => {
    try {
      const response: ExpirySummary = await getExpiryAnalytics(requirePharmacy(req));
      ok(res, response);
    } catch (error) {
      next(error);
    }
  },
);

analyticsRouter.get(
  '/reorders',
  requirePermission(PERMISSIONS.analyticsRead),
  async (req, res, next) => {
    try {
      const response: AnalyticsReorders = await getReordersAnalytics(requirePharmacy(req));
      ok(res, response);
    } catch (error) {
      next(error);
    }
  },
);
