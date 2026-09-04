import { z } from 'zod';

/**
 * Report and audit query validation (PRD §10.19/§10.20). Windows stay
 * bounded and date-only; the service converts them to ISO bounds.
 */

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

export const REPORT_TYPES = [
  'inventory',
  'expired',
  'near-expiry',
  'sales',
  'purchases',
  'valuation',
  'audit',
  'returns',
] as const;

export type ReportTypeValue = (typeof REPORT_TYPES)[number];

export const reportQuerySchema = z
  .object({
    format: z.enum(['json', 'csv', 'pdf']).default('json'),
    from: z.string().regex(DATE_ONLY, 'from must be YYYY-MM-DD').optional(),
    to: z.string().regex(DATE_ONLY, 'to must be YYYY-MM-DD').optional(),
  })
  .refine((query) => !query.from || !query.to || query.from <= query.to, {
    message: 'from must be on or before to',
    path: ['from'],
  });

export type ReportQuery = z.infer<typeof reportQuerySchema>;

export const auditListQuerySchema = z
  .object({
    action: z.string().trim().min(1).max(100).optional(),
    userId: z.string().uuid().optional(),
    from: z.string().regex(DATE_ONLY, 'from must be YYYY-MM-DD').optional(),
    to: z.string().regex(DATE_ONLY, 'to must be YYYY-MM-DD').optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(50).default(20),
  })
  .refine((query) => !query.from || !query.to || query.from <= query.to, {
    message: 'from must be on or before to',
    path: ['from'],
  });

export type AuditListQuery = z.infer<typeof auditListQuerySchema>;
