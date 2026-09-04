import { z } from 'zod';
import { optionalTrimmedString, paginationSchema, uuidSchema } from './common';

/**
 * Sales validation (PRD §10.10). Price defaults to the medicine's selling
 * price server-side when omitted; sold time may be backdated but never
 * placed in the future.
 */

export const createSaleSchema = z.object({
  batchId: uuidSchema,
  quantity: z.coerce
    .number()
    .int('Quantity must be a whole number')
    .min(1, 'Quantity must be at least 1')
    .max(100000, 'Quantity is unreasonably large'),
  unitPrice: z.coerce.number().min(0, 'Price cannot be negative').max(10000000).optional(),
  note: optionalTrimmedString(500),
  soldAt: z.string().datetime({ offset: true }).optional(),
});

export const listSalesQuerySchema = paginationSchema.extend({
  medicineId: uuidSchema.optional(),
  from: z.string().date().optional(),
  to: z.string().date().optional(),
});

export type CreateSaleInput = z.infer<typeof createSaleSchema>;
export type ListSalesQuery = z.infer<typeof listSalesQuerySchema>;
