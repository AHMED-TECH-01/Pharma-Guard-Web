import { z } from 'zod';

/** Analytics query validation (PRD §10.17). Windows stay bounded. */

export const analyticsSalesQuerySchema = z.object({
  observationDays: z.coerce.number().int().min(1).max(90).default(30),
});

export type AnalyticsSalesQuery = z.infer<typeof analyticsSalesQuerySchema>;
