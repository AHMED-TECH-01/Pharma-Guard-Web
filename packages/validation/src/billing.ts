import { z } from 'zod';

/**
 * Billing input schemas (subscriptions spec §2/§19). The client picks a plan
 * and a payment method, but the SERVER derives the amount from the plan
 * definition (packages/types/src/billing.ts) — never from the request body.
 */

export const paymentMethodSchema = z.enum(['EASYPAISA', 'JAZZCASH', 'BANK_TRANSFER']);

/** Manual payment submission for a paid plan (multipart form fields). */
export const submitPaymentSchema = z.object({
  planId: z.enum(['STARTER', 'PROFESSIONAL', 'PREMIUM']),
  method: paymentMethodSchema,
  /** Transaction id / sender number the user received after paying. */
  reference: z.string().trim().min(4, 'Reference must be at least 4 characters').max(100),
});

/** Instant switch to the free tier (no payment involved). */
export const subscribeFreeSchema = z.object({
  planId: z.literal('FREE'),
});

/** Platform-admin rejection requires a visible reason (spec §18). */
export const rejectPaymentSchema = z.object({
  reason: z.string().trim().min(3, 'Provide a short rejection reason').max(500),
});
