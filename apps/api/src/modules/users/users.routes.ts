import { Router, type Request } from 'express';
import type { InviteMemberResult, MemberListResponse } from '@pharmaguard/types';
import { inviteMemberSchema, updateMemberSchema } from '@pharmaguard/validation';
import { PERMISSIONS, requirePermission } from '../../middleware/authorize.js';
import { getValidatedBody, validateBody } from '../../middleware/validate.js';
import { ApiError } from '../../utils/api-error.js';
import { ok } from '../../utils/respond.js';
import { inviteMember, listMembers, removeMember, updateMember } from './users.service.js';

/**
 * Team roster routes (PRD §10.21, build-plan Phase 12):
 *   GET    /api/v1/users         - OWNER/MANAGER (users.read)
 *   POST   /api/v1/users         - OWNER only (users.manage), invite/add member
 *   PATCH  /api/v1/users/:userId - OWNER only, role/status changes
 *   DELETE /api/v1/users/:userId - OWNER only, remove member
 *
 * Self-lockout and last-owner guards live in the service so every pharmacy
 * always keeps at least one active owner.
 */

function requireContext(req: Request): { pharmacyId: string; userId: string } {
  if (!req.pharmacyId) throw ApiError.forbidden('No pharmacy context on request');
  if (!req.auth) throw ApiError.unauthorized('Authentication required');
  return { pharmacyId: req.pharmacyId, userId: req.auth.userId };
}

export const usersRouter = Router();

usersRouter.get(
  '/',
  requirePermission(PERMISSIONS.usersRead),
  async (req, res, next) => {
    try {
      const response: MemberListResponse = await listMembers(requireContext(req).pharmacyId);
      ok(res, response);
    } catch (error) {
      next(error);
    }
  },
);

usersRouter.post(
  '/',
  requirePermission(PERMISSIONS.usersManage),
  validateBody(inviteMemberSchema),
  async (req, res, next) => {
    try {
      const { pharmacyId, userId } = requireContext(req);
      const result: InviteMemberResult = await inviteMember(
        pharmacyId,
        userId,
        getValidatedBody(req, inviteMemberSchema),
        req,
      );
      ok(res, result, 201);
    } catch (error) {
      next(error);
    }
  },
);

usersRouter.patch(
  '/:userId',
  requirePermission(PERMISSIONS.usersManage),
  validateBody(updateMemberSchema),
  async (req, res, next) => {
    try {
      const { pharmacyId, userId } = requireContext(req);
      const member = await updateMember(
        pharmacyId,
        userId,
        String(req.params.userId),
        getValidatedBody(req, updateMemberSchema),
        req,
      );
      ok(res, member);
    } catch (error) {
      next(error);
    }
  },
);

usersRouter.delete(
  '/:userId',
  requirePermission(PERMISSIONS.usersManage),
  async (req, res, next) => {
    try {
      const { pharmacyId, userId } = requireContext(req);
      await removeMember(pharmacyId, userId, String(req.params.userId), req);
      ok(res, { removed: true });
    } catch (error) {
      next(error);
    }
  },
);
