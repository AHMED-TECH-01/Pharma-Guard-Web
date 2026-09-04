import { Router, type Request } from 'express';
import type {
  AlertListItem,
  ExpiryActionResult,
  ExpiryBatchListResponse,
  ExpirySummary,
  QuarantineListItem,
  QuarantineListResponse,
  RecallDetail,
  RecallListResponse,
} from '@pharmaguard/types';
import {
  createQuarantineSchema,
  createRecallSchema,
  expiryBulkActionSchema,
  listAlertsQuerySchema,
  listExpiryBatchesQuerySchema,
  listQuarantineQuerySchema,
  listRecallsQuerySchema,
  resolveQuarantineSchema,
  snoozeAlertSchema,
  updateRecallSchema,
} from '@pharmaguard/validation';
import { hasPermission, PERMISSIONS, requirePermission } from '../../middleware/authorize.js';
import { getValidatedBody, getValidatedQuery, validateBody, validateQuery } from '../../middleware/validate.js';
import { ApiError } from '../../utils/api-error.js';
import { ok } from '../../utils/respond.js';
import { runAlertEngine } from './alert-engine.service.js';
import {
  listAlerts,
  markAlertRead,
  resolveAlert,
  snoozeAlert,
} from './alerts.service.js';
import { applyBatchActions, getExpirySummary, listExpiryBatches } from './expiry.service.js';
import { listQuarantineItems, quarantineBatch, resolveQuarantineItem } from './quarantine.service.js';
import {
  createRecall,
  getRecallDetail,
  listRecalls,
  quarantineFromRecall,
  updateRecallStatus,
} from './recalls.service.js';

/**
 * Safety endpoints (TRD §7 Alerts; PRD §10.9 Expiry Center, §10.15
 * Quarantine, §10.16 Recall Center, §10.18 Alerts Center).
 *
 * The alert engine runs lazily (throttled per pharmacy) when the Alerts
 * Center or Expiry Center is read; mutation endpoints follow the inventory
 * pattern: capability middleware + audit trail.
 */

/** Narrows the middleware-guaranteed context for the handlers below. */
function requireContext(req: Request): { pharmacyId: string; userId: string } {
  if (!req.pharmacyId) throw ApiError.forbidden('No pharmacy context on request');
  if (!req.auth) throw ApiError.unauthorized('Authentication required');
  return { pharmacyId: req.pharmacyId, userId: req.auth.userId };
}

// ---------------------------------------------------------------------------
// Expiry Center
// ---------------------------------------------------------------------------

export const expiryRouter = Router();

expiryRouter.get(
  '/summary',
  requirePermission(PERMISSIONS.expiryRead),
  async (req, res, next) => {
    try {
      const { pharmacyId } = requireContext(req);
      await runAlertEngine(pharmacyId); // throttled; failure is non-fatal
      const summary: ExpirySummary = await getExpirySummary(pharmacyId);
      ok(res, { summary });
    } catch (error) {
      next(error);
    }
  },
);

expiryRouter.get(
  '/batches',
  requirePermission(PERMISSIONS.expiryRead),
  validateQuery(listExpiryBatchesQuerySchema),
  async (req, res, next) => {
    try {
      const query = getValidatedQuery(req, listExpiryBatchesQuerySchema);
      const response: ExpiryBatchListResponse = await listExpiryBatches(
        requireContext(req).pharmacyId,
        query,
      );
      ok(res, response);
    } catch (error) {
      next(error);
    }
  },
);

expiryRouter.post(
  '/actions',
  validateBody(expiryBulkActionSchema),
  async (req, res, next) => {
    try {
      const { pharmacyId, userId } = requireContext(req);
      const input = getValidatedBody(req, expiryBulkActionSchema);
      // QUARANTINE is the quarantine capability; REMOVE/RETURN are expiry.
      const required =
        input.action === 'QUARANTINE' ? PERMISSIONS.quarantineAct : PERMISSIONS.expiryAct;
      if (!req.role || !hasPermission(req.role, required)) {
        throw ApiError.forbidden('You do not have permission to perform this action');
      }
      const result: ExpiryActionResult = await applyBatchActions(pharmacyId, userId, input, req);
      ok(res, result);
    } catch (error) {
      next(error);
    }
  },
);

// ---------------------------------------------------------------------------
// Alerts Center
// ---------------------------------------------------------------------------

export const alertsRouter = Router();

alertsRouter.get(
  '/',
  requirePermission(PERMISSIONS.alertsRead),
  validateQuery(listAlertsQuerySchema),
  async (req, res, next) => {
    try {
      const { pharmacyId } = requireContext(req);
      await runAlertEngine(pharmacyId); // throttled; failure is non-fatal
      const response = await listAlerts(pharmacyId, getValidatedQuery(req, listAlertsQuerySchema));
      ok(res, response);
    } catch (error) {
      next(error);
    }
  },
);

alertsRouter.post('/:id/read', requirePermission(PERMISSIONS.alertsAct), async (req, res, next) => {
  try {
    const { pharmacyId, userId } = requireContext(req);
    const alert: AlertListItem = await markAlertRead(pharmacyId, userId, String(req.params.id), req);
    ok(res, { alert });
  } catch (error) {
    next(error);
  }
});

alertsRouter.post('/:id/resolve', requirePermission(PERMISSIONS.alertsAct), async (req, res, next) => {
  try {
    const { pharmacyId, userId } = requireContext(req);
    const alert: AlertListItem = await resolveAlert(pharmacyId, userId, String(req.params.id), req);
    ok(res, { alert });
  } catch (error) {
    next(error);
  }
});

alertsRouter.post(
  '/:id/snooze',
  requirePermission(PERMISSIONS.alertsAct),
  validateBody(snoozeAlertSchema),
  async (req, res, next) => {
    try {
      const { pharmacyId, userId } = requireContext(req);
      const { days } = getValidatedBody(req, snoozeAlertSchema);
      const alert: AlertListItem = await snoozeAlert(pharmacyId, userId, String(req.params.id), days, req);
      ok(res, { alert });
    } catch (error) {
      next(error);
    }
  },
);

// ---------------------------------------------------------------------------
// Quarantine
// ---------------------------------------------------------------------------

export const quarantineRouter = Router();

quarantineRouter.get(
  '/',
  requirePermission(PERMISSIONS.quarantineRead),
  validateQuery(listQuarantineQuerySchema),
  async (req, res, next) => {
    try {
      const query = getValidatedQuery(req, listQuarantineQuerySchema);
      const response: QuarantineListResponse = await listQuarantineItems(
        requireContext(req).pharmacyId,
        query,
      );
      ok(res, response);
    } catch (error) {
      next(error);
    }
  },
);

quarantineRouter.post(
  '/',
  requirePermission(PERMISSIONS.quarantineAct),
  validateBody(createQuarantineSchema),
  async (req, res, next) => {
    try {
      const { pharmacyId, userId } = requireContext(req);
      const input = getValidatedBody(req, createQuarantineSchema);
      const item: QuarantineListItem = await quarantineBatch(pharmacyId, userId, input, req);
      ok(res, { item }, 201);
    } catch (error) {
      next(error);
    }
  },
);

quarantineRouter.post(
  '/:id/resolve',
  requirePermission(PERMISSIONS.quarantineAct),
  validateBody(resolveQuarantineSchema),
  async (req, res, next) => {
    try {
      const { pharmacyId, userId } = requireContext(req);
      const input = getValidatedBody(req, resolveQuarantineSchema);
      const item: QuarantineListItem = await resolveQuarantineItem(
        pharmacyId,
        userId,
        String(req.params.id),
        input,
        req,
      );
      ok(res, { item });
    } catch (error) {
      next(error);
    }
  },
);

// ---------------------------------------------------------------------------
// Recall Center
// ---------------------------------------------------------------------------

export const recallsRouter = Router();

recallsRouter.get(
  '/',
  requirePermission(PERMISSIONS.recallsRead),
  validateQuery(listRecallsQuerySchema),
  async (req, res, next) => {
    try {
      const query = getValidatedQuery(req, listRecallsQuerySchema);
      const response: RecallListResponse = await listRecalls(requireContext(req).pharmacyId, query);
      ok(res, response);
    } catch (error) {
      next(error);
    }
  },
);

recallsRouter.get('/:id', requirePermission(PERMISSIONS.recallsRead), async (req, res, next) => {
  try {
    const recall: RecallDetail = await getRecallDetail(requireContext(req).pharmacyId, String(req.params.id));
    ok(res, { recall });
  } catch (error) {
    next(error);
  }
});

recallsRouter.post(
  '/',
  requirePermission(PERMISSIONS.recallsWrite),
  validateBody(createRecallSchema),
  async (req, res, next) => {
    try {
      const { pharmacyId, userId } = requireContext(req);
      const input = getValidatedBody(req, createRecallSchema);
      const recall: RecallDetail = await createRecall(pharmacyId, userId, input, req);
      ok(res, { recall }, 201);
    } catch (error) {
      next(error);
    }
  },
);

recallsRouter.patch(
  '/:id',
  requirePermission(PERMISSIONS.recallsWrite),
  validateBody(updateRecallSchema),
  async (req, res, next) => {
    try {
      const { pharmacyId, userId } = requireContext(req);
      const input = getValidatedBody(req, updateRecallSchema);
      const recall: RecallDetail = await updateRecallStatus(
        pharmacyId,
        userId,
        String(req.params.id),
        input,
        req,
      );
      ok(res, { recall });
    } catch (error) {
      next(error);
    }
  },
);

recallsRouter.post(
  '/:id/quarantine',
  requirePermission(PERMISSIONS.quarantineAct),
  async (req, res, next) => {
    try {
      const { pharmacyId, userId } = requireContext(req);
      const recall: RecallDetail = await quarantineFromRecall(
        pharmacyId,
        userId,
        String(req.params.id),
        req,
      );
      ok(res, { recall });
    } catch (error) {
      next(error);
    }
  },
);
