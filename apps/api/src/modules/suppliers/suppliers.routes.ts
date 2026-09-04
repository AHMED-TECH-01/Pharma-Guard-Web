import { Router, type Request } from 'express';
import type { SupplierDetail, SupplierListItem, SupplierListResponse } from '@pharmaguard/types';
import { createSupplierSchema, updateSupplierSchema } from '@pharmaguard/validation';
import { PERMISSIONS, requirePermission } from '../../middleware/authorize.js';
import { getValidatedBody, validateBody } from '../../middleware/validate.js';
import { ApiError } from '../../utils/api-error.js';
import { ok } from '../../utils/respond.js';
import { createSupplier, getSupplier, listSuppliers, updateSupplier } from './suppliers.service.js';

/**
 * Suppliers endpoints (PRD §10.13). Endpoint set extends TRD §7 - see the
 * tracker deviation note. Read = suppliers.read, writes = suppliers.write.
 */

function requireContext(req: Request): { pharmacyId: string; userId: string } {
  if (!req.pharmacyId) throw ApiError.forbidden('No pharmacy context on request');
  if (!req.auth) throw ApiError.unauthorized('Authentication required');
  return { pharmacyId: req.pharmacyId, userId: req.auth.userId };
}

export const suppliersRouter = Router();

suppliersRouter.get(
  '/',
  requirePermission(PERMISSIONS.suppliersRead),
  async (req, res, next) => {
    try {
      const includeArchived = req.query.archived === 'true';
      const response: SupplierListResponse = await listSuppliers(
        requireContext(req).pharmacyId,
        includeArchived,
      );
      ok(res, response);
    } catch (error) {
      next(error);
    }
  },
);

suppliersRouter.get(
  '/:id',
  requirePermission(PERMISSIONS.suppliersRead),
  async (req, res, next) => {
    try {
      const supplier: SupplierDetail = await getSupplier(
        requireContext(req).pharmacyId,
        String(req.params.id),
      );
      ok(res, { supplier });
    } catch (error) {
      next(error);
    }
  },
);

suppliersRouter.post(
  '/',
  requirePermission(PERMISSIONS.suppliersWrite),
  validateBody(createSupplierSchema),
  async (req, res, next) => {
    try {
      const { pharmacyId, userId } = requireContext(req);
      const input = getValidatedBody(req, createSupplierSchema);
      const supplier: SupplierListItem = await createSupplier(pharmacyId, userId, input, req);
      ok(res, { supplier }, 201);
    } catch (error) {
      next(error);
    }
  },
);

suppliersRouter.patch(
  '/:id',
  requirePermission(PERMISSIONS.suppliersWrite),
  validateBody(updateSupplierSchema),
  async (req, res, next) => {
    try {
      const { pharmacyId, userId } = requireContext(req);
      const input = getValidatedBody(req, updateSupplierSchema);
      const supplier: SupplierListItem = await updateSupplier(
        pharmacyId,
        userId,
        String(req.params.id),
        input,
        req,
      );
      ok(res, { supplier });
    } catch (error) {
      next(error);
    }
  },
);
