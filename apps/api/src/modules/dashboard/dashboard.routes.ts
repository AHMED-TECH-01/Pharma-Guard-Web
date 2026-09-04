import { Router } from 'express';
import type { DashboardSummary } from '@pharmaguard/types';
import { requirePermission, PERMISSIONS } from '../../middleware/authorize.js';
import { ok } from '../../utils/respond.js';
import { getDashboardSummary } from './dashboard.service.js';

/**
 * Dashboard aggregate endpoint (TRD §14/§22 - "Data should be fetched from
 * aggregated dashboard endpoints where possible").
 *
 * GET /api/v1/dashboard/summary
 * Tenancy comes from resolvePharmacyContext (verified membership), and the
 * capability check enforces `dashboard.read` server-side.
 */
export const dashboardRouter = Router();

dashboardRouter.get(
  '/summary',
  requirePermission(PERMISSIONS.dashboardRead),
  async (req, res, next) => {
    try {
      if (!req.pharmacyId) {
        next(new Error('Dashboard route requires pharmacy context'));
        return;
      }
      const summary: DashboardSummary = await getDashboardSummary(req.pharmacyId);
      ok(res, { summary });
    } catch (error) {
      next(error);
    }
  },
);
