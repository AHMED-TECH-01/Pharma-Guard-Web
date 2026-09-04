import { Router, type Request } from 'express';
import type { PurchaseListItem, PurchaseListResponse } from '@pharmaguard/types';
import { createPurchaseSchema, listPurchasesQuerySchema } from '@pharmaguard/validation';
import { PERMISSIONS, requirePermission } from '../../middleware/authorize.js';
import { getValidatedBody, getValidatedQuery, validateBody, validateQuery } from '../../middleware/validate.js';
import { ApiError } from '../../utils/api-error.js';
import { ok } from '../../utils/respond.js';
import { createPurchase, getPurchase, listPurchases } from './purchases.service.js';

/**
 * Purchases endpoints (TRD §7 Purchases, PRD §10.11). Stock increment is
 * atomic in migration 0005's RPC; this router owns capabilities + context.
 */

function requireContext(req: Request): { pharmacyId: string; userId: string } {
  if (!req.pharmacyId) throw ApiError.forbidden('No pharmacy context on request');
  if (!req.auth) throw ApiError.unauthorized('Authentication required');
  return { pharmacyId: req.pharmacyId, userId: req.auth.userId };
}

export const purchasesRouter = Router();

purchasesRouter.post(
  '/',
  requirePermission(PERMISSIONS.purchasesWrite),
  validateBody(createPurchaseSchema),
  async (req, res, next) => {
    try {
      const { pharmacyId, userId } = requireContext(req);
      const input = getValidatedBody(req, createPurchaseSchema);
      const purchase: PurchaseListItem = await createPurchase(pharmacyId, userId, input, req);
      ok(res, { purchase }, 201);
    } catch (error) {
      next(error);
    }
  },
);

purchasesRouter.get(
  '/',
  requirePermission(PERMISSIONS.purchasesRead),
  validateQuery(listPurchasesQuerySchema),
  async (req, res, next) => {
    try {
      const response: PurchaseListResponse = await listPurchases(
        requireContext(req).pharmacyId,
        getValidatedQuery(req, listPurchasesQuerySchema),
      );
      ok(res, response);
    } catch (error) {
      next(error);
    }
  },
);

purchasesRouter.get(
  '/:id',
  requirePermission(PERMISSIONS.purchasesRead),
  async (req, res, next) => {
    try {
      const purchase = await getPurchase(requireContext(req).pharmacyId, String(req.params.id));
      ok(res, { purchase });
    } catch (error) {
      next(error);
    }
  },
);
