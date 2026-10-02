import { Router, type NextFunction, type Request, type Response } from 'express';
import type { PaymentStatus } from '@pharmaguard/types';
import { rejectPaymentSchema } from '@pharmaguard/validation';
import { getValidatedBody, validateBody } from '../../middleware/validate.js';
import { ApiError } from '../../utils/api-error.js';
import { ok } from '../../utils/respond.js';
import { approvePayment, listPaymentsForAdmin, rejectPayment } from './billing.service.js';

/**
 * Platform-admin payment review (spec §18). Mounted behind requireAuth +
 * requirePlatformAdmin - these endpoints cross pharmacy boundaries via the
 * service role, so the env email allowlist is the only gate. They intentionally
 * live outside the tenant-resolved area: a platform admin may belong to no
 * pharmacy at all.
 */

export const adminBillingRouter = Router();

const STATUS_FILTERS = new Set<string>(['ALL', 'PENDING', 'APPROVED', 'REJECTED']);

/** The admin area guarantees auth; this narrows the type for the handlers. */
function requireAdminId(req: Request): string {
  if (!req.auth) throw ApiError.unauthorized('Authentication required');
  return req.auth.userId;
}

adminBillingRouter.get('/payments', async (req: Request, res: Response, next: NextFunction) => {
  try {
    requireAdminId(req);
    const raw = typeof req.query.status === 'string' ? req.query.status : 'ALL';
    const status = raw.toUpperCase();
    if (!STATUS_FILTERS.has(status)) {
      throw ApiError.badRequest('Unknown payment status filter.');
    }
    const payments = await listPaymentsForAdmin(status as PaymentStatus | 'ALL');
    ok(res, { payments });
  } catch (error) {
    next(error);
  }
});

adminBillingRouter.post(
  '/payments/:id/approve',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const adminUserId = requireAdminId(req);
      const payment = await approvePayment(String(req.params.id), adminUserId, req);
      ok(res, { payment });
    } catch (error) {
      next(error);
    }
  },
);

adminBillingRouter.post(
  '/payments/:id/reject',
  validateBody(rejectPaymentSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const adminUserId = requireAdminId(req);
      const { reason } = getValidatedBody(req, rejectPaymentSchema);
      const payment = await rejectPayment(String(req.params.id), adminUserId, reason, req);
      ok(res, { payment });
    } catch (error) {
      next(error);
    }
  },
);
