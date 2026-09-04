import { Router, type Request } from 'express';
import type { AuditListResponse, AuditUsersResponse, ComplianceSummary } from '@pharmaguard/types';
import { auditListQuerySchema } from '@pharmaguard/validation';
import { PERMISSIONS, requirePermission } from '../../middleware/authorize.js';
import { getValidatedQuery, validateQuery } from '../../middleware/validate.js';
import { ApiError } from '../../utils/api-error.js';
import { ok } from '../../utils/respond.js';
import { getComplianceSummary, listAuditEntries, listAuditUsers } from './audit.service.js';

/**
 * Audit timeline + user activity endpoints and the compliance summary
 * (PRD §10.19, build-plan Phase 11). Read-only; OWNER/MANAGER via
 * audit.read. audit_logs is append-only - there are no write routes.
 */

function requirePharmacy(req: Request): string {
  if (!req.pharmacyId) throw ApiError.forbidden('No pharmacy context on request');
  return req.pharmacyId;
}

export const auditRouter = Router();

auditRouter.get(
  '/',
  requirePermission(PERMISSIONS.auditRead),
  validateQuery(auditListQuerySchema),
  async (req, res, next) => {
    try {
      const response: AuditListResponse = await listAuditEntries(
        requirePharmacy(req),
        getValidatedQuery(req, auditListQuerySchema),
      );
      ok(res, response);
    } catch (error) {
      next(error);
    }
  },
);

auditRouter.get(
  '/users',
  requirePermission(PERMISSIONS.auditRead),
  async (req, res, next) => {
    try {
      const response: AuditUsersResponse = await listAuditUsers(requirePharmacy(req));
      ok(res, response);
    } catch (error) {
      next(error);
    }
  },
);

export const complianceRouter = Router();

complianceRouter.get(
  '/summary',
  requirePermission(PERMISSIONS.auditRead),
  async (req, res, next) => {
    try {
      const summary: ComplianceSummary = await getComplianceSummary(requirePharmacy(req));
      ok(res, summary);
    } catch (error) {
      next(error);
    }
  },
);
