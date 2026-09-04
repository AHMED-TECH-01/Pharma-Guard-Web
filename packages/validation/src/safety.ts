import { z } from 'zod';
import { optionalTrimmedString, paginationSchema, uuidSchema } from './common';

/**
 * Safety module validation (PRD §10.9/§10.15/§10.16/§10.18).
 * Every status-changing action carries a reason so the audit trail (PRD
 * §10.19) can explain why stock was removed, returned, or quarantined.
 */

const alertStatusFilters = ['active', 'NEW', 'READ', 'SNOOZED', 'RESOLVED'] as const;
const alertSeverities = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as const;
const alertTypes = [
  'EXPIRED',
  'EXPIRING',
  'LOW_STOCK',
  'STOCKOUT_RISK',
  'DEAD_STOCK',
  'OVERSTOCK',
  'RECALL',
  'QUARANTINE',
  'OCR_REVIEW',
] as const;

export const listAlertsQuerySchema = paginationSchema.extend({
  /** "active" = NEW + READ + snoozed alerts whose snooze has expired. */
  status: z.enum(alertStatusFilters).default('active'),
  severity: z.enum(alertSeverities).optional(),
  type: z.enum(alertTypes).optional(),
});

export const snoozeAlertSchema = z.object({
  days: z.coerce
    .number()
    .int('Snooze must be a whole number of days')
    .min(1, 'Snooze at least 1 day')
    .max(30, 'Snooze at most 30 days'),
});

export const listExpiryBatchesQuerySchema = paginationSchema.extend({
  bucket: z.enum(['ALL', 'EXPIRED', 'CRITICAL', 'WARNING', 'SAFE']).default('ALL'),
});

export const expiryBulkActionSchema = z.object({
  batchIds: z
    .array(uuidSchema)
    .min(1, 'Select at least one batch')
    .max(100, 'At most 100 batches per action'),
  action: z.enum(['REMOVE', 'RETURN', 'QUARANTINE']),
  reason: z.string().trim().min(3, 'Reason must be at least 3 characters').max(500),
});

export const listQuarantineQuerySchema = paginationSchema.extend({
  status: z.enum(['ALL', 'QUARANTINED', 'RELEASED', 'RETURNED', 'REMOVED']).default('ALL'),
});

export const createQuarantineSchema = z.object({
  batchId: uuidSchema,
  reason: z.string().trim().min(3, 'Reason must be at least 3 characters').max(500),
});

export const resolveQuarantineSchema = z.object({
  resolution: z.enum(['RELEASE', 'RETURN', 'REMOVE']),
  reason: optionalTrimmedString(500),
});

export const listRecallsQuerySchema = paginationSchema.extend({
  status: z.enum(['ALL', 'OPEN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']).default('ALL'),
});

export const createRecallSchema = z
  .object({
    medicineId: uuidSchema.optional(),
    batchNo: optionalTrimmedString(100),
    manufacturer: optionalTrimmedString(255),
    reason: optionalTrimmedString(1000),
  })
  .refine(
    (input) => Boolean(input.medicineId ?? input.batchNo),
    'Select a medicine or provide a batch number so affected stock can be matched',
  );

export const updateRecallSchema = z.object({
  status: z.enum(['OPEN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']),
});

export type ListAlertsQuery = z.infer<typeof listAlertsQuerySchema>;
export type SnoozeAlertInput = z.infer<typeof snoozeAlertSchema>;
export type ListExpiryBatchesQuery = z.infer<typeof listExpiryBatchesQuerySchema>;
export type ExpiryBulkActionInput = z.infer<typeof expiryBulkActionSchema>;
export type ListQuarantineQuery = z.infer<typeof listQuarantineQuerySchema>;
export type CreateQuarantineInput = z.infer<typeof createQuarantineSchema>;
export type ResolveQuarantineInput = z.infer<typeof resolveQuarantineSchema>;
export type ListRecallsQuery = z.infer<typeof listRecallsQuerySchema>;
export type CreateRecallInput = z.infer<typeof createRecallSchema>;
export type UpdateRecallInput = z.infer<typeof updateRecallSchema>;
