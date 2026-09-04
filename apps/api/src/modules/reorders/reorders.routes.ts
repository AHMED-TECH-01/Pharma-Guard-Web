import { Router, type Request } from 'express';
import type {
  ReorderListResponse,
  ReorderRecommendationsResponse,
  ReorderRecord,
} from '@pharmaguard/types';
import {
  createReorderSchema,
  listReordersQuerySchema,
  reorderRecommendationsQuerySchema,
  updateReorderSchema,
} from '@pharmaguard/validation';
import { PERMISSIONS, requirePermission } from '../../middleware/authorize.js';
import { getValidatedBody, getValidatedQuery, validateBody, validateQuery } from '../../middleware/validate.js';
import { ApiError } from '../../utils/api-error.js';
import { ok } from '../../utils/respond.js';
import { createReorder, getRecommendations, listReorders, updateReorder } from './reorders.service.js';

/**
 * Reorders endpoints (PRD §10.12, TRD §11). GET /reorders/recommendations
 * computes live TRD §11 suggestions; records persist a snapshot.
 */

function requireContext(req: Request): { pharmacyId: string; userId: string } {
  if (!req.pharmacyId) throw ApiError.forbidden('No pharmacy context on request');
  if (!req.auth) throw ApiError.unauthorized('Authentication required');
  return { pharmacyId: req.pharmacyId, userId: req.auth.userId };
}

export const reordersRouter = Router();

reordersRouter.get(
  '/recommendations',
  requirePermission(PERMISSIONS.reordersRead),
  validateQuery(reorderRecommendationsQuerySchema),
  async (req, res, next) => {
    try {
      const response: ReorderRecommendationsResponse = await getRecommendations(
        requireContext(req).pharmacyId,
        getValidatedQuery(req, reorderRecommendationsQuerySchema),
      );
      ok(res, response);
    } catch (error) {
      next(error);
    }
  },
);

reordersRouter.post(
  '/',
  requirePermission(PERMISSIONS.reordersWrite),
  validateBody(createReorderSchema),
  async (req, res, next) => {
    try {
      const { pharmacyId, userId } = requireContext(req);
      const input = getValidatedBody(req, createReorderSchema);
      const record: ReorderRecord = await createReorder(pharmacyId, userId, input, req);
      ok(res, { reorder: record }, 201);
    } catch (error) {
      next(error);
    }
  },
);

reordersRouter.get(
  '/',
  requirePermission(PERMISSIONS.reordersRead),
  validateQuery(listReordersQuerySchema),
  async (req, res, next) => {
    try {
      const response: ReorderListResponse = await listReorders(
        requireContext(req).pharmacyId,
        getValidatedQuery(req, listReordersQuerySchema),
      );
      ok(res, response);
    } catch (error) {
      next(error);
    }
  },
);

reordersRouter.patch(
  '/:id',
  requirePermission(PERMISSIONS.reordersWrite),
  validateBody(updateReorderSchema),
  async (req, res, next) => {
    try {
      const { pharmacyId, userId } = requireContext(req);
      const input = getValidatedBody(req, updateReorderSchema);
      const record: ReorderRecord = await updateReorder(
        pharmacyId,
        userId,
        String(req.params.id),
        input,
        req,
      );
      ok(res, { reorder: record });
    } catch (error) {
      next(error);
    }
  },
);
