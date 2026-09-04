import { Router, type Request } from 'express';
import type { SaleListItem, SaleListResponse } from '@pharmaguard/types';
import { createSaleSchema, listSalesQuerySchema } from '@pharmaguard/validation';
import { PERMISSIONS, requirePermission } from '../../middleware/authorize.js';
import { getValidatedBody, getValidatedQuery, validateBody, validateQuery } from '../../middleware/validate.js';
import { ApiError } from '../../utils/api-error.js';
import { ok } from '../../utils/respond.js';
import { createSale, listSales, reverseSale } from './sales.service.js';

/**
 * Sales endpoints (TRD §7 Sales, PRD §10.10). Stock movement is atomic in
 * migration 0004's RPCs (row lock -> verify -> decrement -> insert); this
 * router owns capabilities and the request context.
 */

function requireContext(req: Request): { pharmacyId: string; userId: string } {
  if (!req.pharmacyId) throw ApiError.forbidden('No pharmacy context on request');
  if (!req.auth) throw ApiError.unauthorized('Authentication required');
  return { pharmacyId: req.pharmacyId, userId: req.auth.userId };
}

export const salesRouter = Router();

salesRouter.post(
  '/',
  requirePermission(PERMISSIONS.salesCreate),
  validateBody(createSaleSchema),
  async (req, res, next) => {
    try {
      const { pharmacyId, userId } = requireContext(req);
      const input = getValidatedBody(req, createSaleSchema);
      const sale: SaleListItem = await createSale(pharmacyId, userId, input, req);
      ok(res, { sale }, 201);
    } catch (error) {
      next(error);
    }
  },
);

salesRouter.get(
  '/',
  requirePermission(PERMISSIONS.salesRead),
  validateQuery(listSalesQuerySchema),
  async (req, res, next) => {
    try {
      const response: SaleListResponse = await listSales(
        requireContext(req).pharmacyId,
        getValidatedQuery(req, listSalesQuerySchema),
      );
      ok(res, response);
    } catch (error) {
      next(error);
    }
  },
);

salesRouter.post(
  '/:id/reverse',
  requirePermission(PERMISSIONS.salesReverse),
  async (req, res, next) => {
    try {
      const { pharmacyId, userId } = requireContext(req);
      const sale: SaleListItem = await reverseSale(
        pharmacyId,
        userId,
        String(req.params.id),
        req,
      );
      ok(res, { sale });
    } catch (error) {
      next(error);
    }
  },
);
