import { z } from 'zod';
import { optionalTrimmedString, paginationSchema, uuidSchema } from './common';

/**
 * Purchases + suppliers validation (PRD §10.11/§10.13). Receiving items
 * either target an existing batch (stock increment) or create one (batch
 * number + expiry required in that case) - mirrored in the 0005 RPC.
 */

const supplierBase = {
  name: z.string().trim().min(2, 'Supplier name must be at least 2 characters').max(255),
  phone: optionalTrimmedString(40),
  email: z
    .string()
    .trim()
    .email('Enter a valid email address')
    .max(255)
    .optional()
    .or(z.literal('').transform(() => undefined)),
  address: optionalTrimmedString(500),
};

export const createSupplierSchema = z.object(supplierBase);

export const updateSupplierSchema = z
  .object({ ...supplierBase, isArchived: z.boolean().optional() })
  .partial();

const purchaseItemSchema = z
  .object({
    medicineId: uuidSchema,
    batchId: uuidSchema.optional(),
    batchNo: optionalTrimmedString(100),
    expiryDate: z.string().date().optional(),
    quantity: z.coerce
      .number()
      .int('Quantity must be a whole number')
      .min(1, 'Quantity must be at least 1')
      .max(100000, 'Quantity is unreasonably large'),
    unitCost: z.coerce
      .number()
      .min(0, 'Unit cost cannot be negative')
      .max(10000000),
  })
  .refine(
    (item) => item.batchId !== undefined || (item.batchNo !== undefined && item.expiryDate !== undefined),
    { message: 'New batches need a batch number and expiry date' },
  );

export const createPurchaseSchema = z.object({
  supplierId: uuidSchema.optional(),
  invoiceNo: optionalTrimmedString(120),
  note: optionalTrimmedString(500),
  items: z.array(purchaseItemSchema).min(1, 'Add at least one item').max(50, 'At most 50 items per purchase'),
});

export const listPurchasesQuerySchema = paginationSchema;

export type CreateSupplierInput = z.infer<typeof createSupplierSchema>;
export type UpdateSupplierInput = z.infer<typeof updateSupplierSchema>;
export type CreatePurchaseInput = z.infer<typeof createPurchaseSchema>;
export type ListPurchasesQuery = z.infer<typeof listPurchasesQuerySchema>;
