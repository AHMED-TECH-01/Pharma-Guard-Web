import { z } from 'zod';
import { optionalTrimmedString, paginationSchema, uuidSchema } from './common';

/**
 * Returns + reorders validation (PRD §10.12/§10.14). Return reasons and
 * statuses mirror the returns table check constraints; reorder windows are
 * bounded so the TRD §11 math stays meaningful.
 */

export const RETURN_REASONS = ['EXPIRED', 'DAMAGED', 'RECALL', 'INCORRECT_SHIPMENT', 'OTHER'] as const;
export const RETURN_STATUSES = ['PENDING', 'APPROVED', 'COMPLETED', 'REJECTED'] as const;
export const REORDER_STATUSES = ['SUGGESTED', 'ORDERED', 'RECEIVED', 'DISMISSED'] as const;

export const createReturnSchema = z.object({
  batchId: uuidSchema,
  supplierId: uuidSchema.optional(),
  quantity: z.coerce
    .number()
    .int('Quantity must be a whole number')
    .min(1, 'Quantity must be at least 1')
    .max(100000, 'Quantity is unreasonably large'),
  reason: z.enum(RETURN_REASONS),
  notes: optionalTrimmedString(500),
});

export const listReturnsQuerySchema = paginationSchema.extend({
  status: z.enum(RETURN_STATUSES).optional(),
  supplierId: uuidSchema.optional(),
  search: optionalTrimmedString(120).optional(),
});

export const reorderRecommendationsQuerySchema = z.object({
  observationDays: z.coerce.number().int().min(1).max(180).default(30),
  leadTimeDays: z.coerce.number().int().min(1).max(90).default(7),
});

export const createReorderSchema = z.object({
  medicineId: uuidSchema,
  supplierId: uuidSchema.optional(),
  observationDays: z.coerce.number().int().min(1).max(180).default(30),
  leadTimeDays: z.coerce.number().int().min(1).max(90).default(7),
});

export const listReordersQuerySchema = paginationSchema.extend({
  status: z.enum(REORDER_STATUSES).optional(),
});

export const updateReorderSchema = z.object({
  status: z.enum(['ORDERED', 'RECEIVED', 'DISMISSED']),
});

export type CreateReturnInput = z.infer<typeof createReturnSchema>;
export type ListReturnsQuery = z.infer<typeof listReturnsQuerySchema>;
export type ReorderRecommendationsQuery = z.infer<typeof reorderRecommendationsQuerySchema>;
export type CreateReorderInput = z.infer<typeof createReorderSchema>;
export type ListReordersQuery = z.infer<typeof listReordersQuerySchema>;
export type UpdateReorderInput = z.infer<typeof updateReorderSchema>;
