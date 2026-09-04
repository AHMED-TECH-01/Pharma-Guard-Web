import { z } from 'zod';
import { optionalTrimmedString, paginationSchema, uuidSchema } from './common.js';

/**
 * Inventory schemas (TRD §7, PRD §10.7/§12, code-standards.md §13).
 * Used by the API for authoritative validation and by the web app for
 * client-side field errors - identical rules on both sides.
 */

const money = z.number().nonnegative('Must not be negative').max(99_999_999);

export const createMedicineSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Medicine name must be at least 2 characters')
    .max(255, 'Medicine name must be at most 255 characters'),
  genericName: optionalTrimmedString(255),
  strength: optionalTrimmedString(100),
  dosageForm: optionalTrimmedString(100),
  manufacturer: optionalTrimmedString(255),
  barcode: optionalTrimmedString(64),
  category: optionalTrimmedString(100),
  reorderLevel: z.number().nonnegative('Must not be negative').max(1_000_000).default(0),
  safetyStock: z.number().nonnegative('Must not be negative').max(1_000_000).default(0),
  purchasePrice: money.nullable().optional(),
  sellingPrice: money.nullable().optional(),
  /** PRD §12: duplicates require explicit user confirmation before creation. */
  confirmDuplicate: z.boolean().optional(),
});

export const updateMedicineSchema = createMedicineSchema
  .extend({ confirmDuplicate: z.boolean().optional() })
  .omit({ confirmDuplicate: true })
  .partial();

export const createBatchSchema = z.object({
  batchNo: z
    .string()
    .trim()
    .min(1, 'Batch number is required')
    .max(100, 'Batch number must be at most 100 characters'),
  manufacturingDate: z.string().date('Must be a valid date (YYYY-MM-DD)').optional(),
  expiryDate: z.string().date('Must be a valid date (YYYY-MM-DD)'),
  quantity: z
    .number()
    .int('Quantity must be a whole number')
    .min(0, 'Quantity must not be negative')
    .max(1_000_000),
  receivedDate: z.string().date('Must be a valid date (YYYY-MM-DD)').optional(),
  purchasePrice: money.nullable().optional(),
  supplierId: uuidSchema.nullable().optional(),
});

export const batchStatusSchema = z.enum([
  'AVAILABLE',
  'QUARANTINED',
  'RETURNED',
  'REMOVED',
  'ARCHIVED',
]);

export const updateBatchSchema = createBatchSchema
  .extend({ status: batchStatusSchema.optional() })
  .partial();

/** Signed stock adjustment; zero deltas are rejected upstream of the DB. */
export const adjustStockSchema = z.object({
  delta: z
    .number()
    .int('Adjustment must be a whole number')
    .refine((value) => value !== 0, 'Adjustment must not be zero'),
  reason: z
    .string()
    .trim()
    .min(3, 'Please provide a reason (at least 3 characters)')
    .max(500, 'Reason must be at most 500 characters'),
});

export const medicineSortKeys = ['name', 'stock', 'expiry', 'updated'] as const;
export const medicineStatusFilters = [
  'all',
  'in_stock',
  'low_stock',
  'out_of_stock',
  'expired',
] as const;

/** Query-string shape for GET /medicines (values arrive as strings). */
export const listMedicinesQuerySchema = paginationSchema.extend({
  search: optionalTrimmedString(100),
  status: z.enum(medicineStatusFilters).default('all'),
  category: optionalTrimmedString(100),
  sort: z.enum(medicineSortKeys).default('name'),
  order: z.enum(['asc', 'desc']).default('asc'),
  includeArchived: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
});

export type CreateMedicineInput = z.infer<typeof createMedicineSchema>;
export type UpdateMedicineInput = z.infer<typeof updateMedicineSchema>;
export type CreateBatchInput = z.infer<typeof createBatchSchema>;
export type UpdateBatchInput = z.infer<typeof updateBatchSchema>;
export type AdjustStockInput = z.infer<typeof adjustStockSchema>;
export type ListMedicinesQuery = z.infer<typeof listMedicinesQuerySchema>;

export const inventoryBatchSortKeys = ['expiry', 'medicine', 'quantity'] as const;
export const inventoryBatchStatusFilters = [
  'all',
  'expired',
  'critical',
  'warning',
  'low_stock',
  'out_of_stock',
  'in_stock',
] as const;

/** Query-string shape for GET /batches (reference inventory table). */
export const listInventoryBatchesQuerySchema = paginationSchema.extend({
  search: optionalTrimmedString(100),
  status: z.enum(inventoryBatchStatusFilters).default('all'),
  sort: z.enum(inventoryBatchSortKeys).default('expiry'),
  order: z.enum(['asc', 'desc']).default('asc'),
});

export type ListInventoryBatchesQuery = z.infer<typeof listInventoryBatchesQuerySchema>;
