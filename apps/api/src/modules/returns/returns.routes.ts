import { Router, type Request } from 'express';
import type { ReturnListItem, ReturnListResponse } from '@pharmaguard/types';
import { createReturnSchema, listReturnsQuerySchema } from '@pharmaguard/validation';
import { PERMISSIONS, requirePermission } from '../../middleware/authorize.js';
import { getValidatedBody, getValidatedQuery, validateBody, validateQuery } from '../../middleware/validate.js';
import { ApiError } from '../../utils/api-error.js';
import { ok } from '../../utils/respond.js';
import {
  approveReturn,
  completeReturn,
  createReturn,
  listReturns,
  rejectReturn,
} from './returns.service.js';

/**
 * Returns endpoints (PRD §10.14). Approval decrements stock atomically in
 * migration 0006's RPCs; this router owns capabilities and context.
 */

function requireContext(req: Request): { pharmacyId: string; userId: string } {
  if (!req.pharmacyId) throw ApiError.forbidden('No pharmacy context on request');
  if (!req.auth) throw ApiError.unauthorized('Authentication required');
  return { pharmacyId: req.pharmacyId, userId: req.auth.userId };
}

export const returnsRouter = Router();

returnsRouter.post(
  '/',
  requirePermission(PERMISSIONS.returnsWrite),
  validateBody(createReturnSchema),
  async (req, res, next) => {
    try {
      const { pharmacyId, userId } = requireContext(req);
      const input = getValidatedBody(req, createReturnSchema);
      const returnItem: ReturnListItem = await createReturn(pharmacyId, userId, input, req);
      ok(res, { return: returnItem }, 201);
    } catch (error) {
      next(error);
    }
  },
);

returnsRouter.get(
  '/',
  requirePermission(PERMISSIONS.returnsRead),
  validateQuery(listReturnsQuerySchema),
  async (req, res, next) => {
    try {
      const response: ReturnListResponse = await listReturns(
        requireContext(req).pharmacyId,
        getValidatedQuery(req, listReturnsQuerySchema),
      );
      ok(res, response);
    } catch (error) {
      next(error);
    }
  },
);

returnsRouter.post(
  '/:id/approve',
  requirePermission(PERMISSIONS.returnsWrite),
  async (req, res, next) => {
    try {
      const { pharmacyId, userId } = requireContext(req);
      const returnItem: ReturnListItem = await approveReturn(
        pharmacyId,
        userId,
        String(req.params.id),
        req,
      );
      ok(res, { return: returnItem });
    } catch (error) {
      next(error);
    }
  },
);

returnsRouter.post(
  '/:id/complete',
  requirePermission(PERMISSIONS.returnsWrite),
  async (req, res, next) => {
    try {
      const { pharmacyId, userId } = requireContext(req);
      const returnItem: ReturnListItem = await completeReturn(
        pharmacyId,
        userId,
        String(req.params.id),
        req,
      );
      ok(res, { return: returnItem });
    } catch (error) {
      next(error);
    }
  },
);

returnsRouter.post(
  '/:id/reject',
  requirePermission(PERMISSIONS.returnsWrite),
  async (req, res, next) => {
    try {
      const { pharmacyId, userId } = requireContext(req);
      const returnItem: ReturnListItem = await rejectReturn(
        pharmacyId,
        userId,
        String(req.params.id),
        req,
      );
      ok(res, { return: returnItem });
    } catch (error) {
      next(error);
    }
  },
);
