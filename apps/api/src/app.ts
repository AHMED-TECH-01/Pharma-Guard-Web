import { Router } from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { getCorsOptions } from './config/cors.js';
import { requireAuth, resolvePharmacyContext } from './middleware/auth.js';
import { errorHandler, notFoundHandler } from './middleware/error.js';
import { generalLimiter } from './middleware/rate-limit.js';
import { requestContext } from './middleware/request-context.js';
import { analyticsRouter } from './modules/analytics/analytics.routes.js';
import { auditRouter, complianceRouter } from './modules/audit/audit.routes.js';
import { authRouter } from './modules/auth/auth.routes.js';
import { dashboardRouter } from './modules/dashboard/dashboard.routes.js';
import { mountHealth } from './modules/health/health.routes.js';
import { inventoryRouter } from './modules/inventory/inventory.routes.js';
import { ocrRouter } from './modules/ocr/ocr.routes.js';
import { onboardingRouter } from './modules/onboarding/onboarding.routes.js';
import {
  alertsRouter,
  expiryRouter,
  quarantineRouter,
  recallsRouter,
} from './modules/safety/safety.routes.js';
import { salesRouter } from './modules/sales/sales.routes.js';
import { purchasesRouter } from './modules/purchases/purchases.routes.js';
import { suppliersRouter } from './modules/suppliers/suppliers.routes.js';
import { returnsRouter } from './modules/returns/returns.routes.js';
import { reordersRouter } from './modules/reorders/reorders.routes.js';
import { reportsRouter } from './modules/reports/reports.routes.js';
import { usersRouter } from './modules/users/users.routes.js';
import { settingsRouter } from './modules/settings/settings.routes.js';

/**
 * Express application assembly (architecture.md §3/§5).
 * Order matters: security headers -> CORS -> body parsing -> request context
 * -> public routes (own limiters) -> authenticated area (auth + tenant
 * context + general limiter) -> 404 -> error envelope.
 */
export function createApp(): express.Express {
  const app = express();

  app.disable('x-powered-by');
  // Behind a reverse proxy in deployment; proxies reviewed again in Phase 13.
  app.set('trust proxy', 1);

  app.use(helmet());
  app.use(cors(getCorsOptions()));
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());
  app.use(requestContext);

  const api = Router();
  mountHealth(api);

  // Public auth endpoints carry their own stricter limiters.
  api.use('/auth', authRouter);

  // Authenticated area: session -> tenant context -> per-user rate limit.
  const protectedArea = Router();
  protectedArea.use(requireAuth, resolvePharmacyContext, generalLimiter);
  protectedArea.use('/onboarding', onboardingRouter);
  protectedArea.use('/dashboard', dashboardRouter);
  protectedArea.use('/medicines', inventoryRouter);
  protectedArea.use('/batches', inventoryRouter);
  protectedArea.use('/ocr', ocrRouter);
  protectedArea.use('/expiry', expiryRouter);
  protectedArea.use('/alerts', alertsRouter);
  protectedArea.use('/quarantine', quarantineRouter);
  protectedArea.use('/recalls', recallsRouter);
  protectedArea.use('/sales', salesRouter);
  protectedArea.use('/purchases', purchasesRouter);
  protectedArea.use('/suppliers', suppliersRouter);
  protectedArea.use('/returns', returnsRouter);
  protectedArea.use('/reorders', reordersRouter);
  protectedArea.use('/analytics', analyticsRouter);
  protectedArea.use('/reports', reportsRouter);
  protectedArea.use('/audit', auditRouter);
  protectedArea.use('/compliance', complianceRouter);
  protectedArea.use('/users', usersRouter);
  protectedArea.use('/settings', settingsRouter);
  api.use(protectedArea);

  app.use('/api/v1', api);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
