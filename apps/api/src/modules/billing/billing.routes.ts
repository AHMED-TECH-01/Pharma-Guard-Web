import { Router, type NextFunction, type Request, type Response } from 'express';
import multer from 'multer';
import type { PaymentMethodId } from '@pharmaguard/types';
import { submitPaymentSchema, subscribeFreeSchema } from '@pharmaguard/validation';
import { getValidatedBody, validateBody } from '../../middleware/validate.js';
import { PERMISSIONS, requirePermission } from '../../middleware/authorize.js';
import { ApiError } from '../../utils/api-error.js';
import { ok } from '../../utils/respond.js';
import {
  getSubscriptionOverview,
  submitPayment,
  subscribeToFree,
} from './billing.service.js';
import { listPaymentMethods } from './payment-methods.js';

/**
 * Billing endpoints (subscriptions spec §7, TRD §7; access model §23).
 * Every member of an active pharmacy can read the subscription and payment
 * history and SUBMIT a payment - a normal feature; the amount is derived
 * server-side from the plan definition and the submitter is captured from
 * the verified session, never from the client. Switching to the FREE plan
 * stays OWNER-only (billing.manage) - a pharmacy-wide business decision -
 * and approvals live under /admin behind the platform-admin gate.
 */

export const billingRouter = Router();

/** Narrows the middleware-guaranteed context for the handlers below. */
function requireContext(req: Request): { pharmacyId: string; userId: string } {
  if (!req.pharmacyId) throw ApiError.forbidden('No pharmacy context on request');
  if (!req.auth) throw ApiError.unauthorized('Authentication required');
  return { pharmacyId: req.pharmacyId, userId: req.auth.userId };
}

const MAX_PROOF_BYTES = 5 * 1024 * 1024;
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_PROOF_BYTES, files: 1 },
});

function uploadOptionalProof(req: Request, res: Response, next: NextFunction): void {
  upload.single('proof')(req, res, (error) => {
    if (!error) {
      next();
      return;
    }
    if (error instanceof multer.MulterError) {
      next(
        error.code === 'LIMIT_FILE_SIZE'
          ? ApiError.badRequest('Payment proof exceeds the 5 MB size limit')
          : ApiError.badRequest('Could not read the uploaded file'),
      );
      return;
    }
    next(error);
  });
}

billingRouter.get('/overview', async (req, res, next) => {
  try {
    const { pharmacyId, userId } = requireContext(req);
    const overview = await getSubscriptionOverview(pharmacyId, userId, req);
    ok(res, overview);
  } catch (error) {
    next(error);
  }
});

// Signed-in users only: the receiving account numbers must never be public.
billingRouter.get('/payment-methods', async (_req, res, next) => {
  try {
    ok(res, { methods: listPaymentMethods() });
  } catch (error) {
    next(error);
  }
});

// Any active member may submit a payment on the pharmacy's behalf (spec §23
// normal-access model); the route's requireContext below enforces the
// verified membership, and approval remains platform-admin only.
billingRouter.post(
  '/payments',
  uploadOptionalProof,
  async (req, res, next) => {
    try {
      const { pharmacyId, userId } = requireContext(req);
      // Multipart fields arrive as strings; validate them explicitly.
      const parsed = submitPaymentSchema.safeParse({
        planId: req.body?.planId,
        method: req.body?.method,
        reference: req.body?.reference,
      });
      if (!parsed.success) {
        throw ApiError.validation('Invalid payment submission', parsed.error.flatten().fieldErrors);
      }
      const file = req.file;
      const payment = await submitPayment(
        pharmacyId,
        userId,
        {
          planId: parsed.data.planId,
          method: parsed.data.method as PaymentMethodId,
          reference: parsed.data.reference,
          proof: file ? { data: file.buffer, declaredMimeType: file.mimetype } : null,
        },
        req,
      );
      ok(res, { payment }, 201);
    } catch (error) {
      next(error);
    }
  },
);

billingRouter.post(
  '/subscribe/free',
  requirePermission(PERMISSIONS.billingManage),
  validateBody(subscribeFreeSchema),
  async (req, res, next) => {
    try {
      const { pharmacyId, userId } = requireContext(req);
      getValidatedBody(req, subscribeFreeSchema);
      const subscription = await subscribeToFree(pharmacyId, userId, req);
      ok(res, { subscription });
    } catch (error) {
      next(error);
    }
  },
);
