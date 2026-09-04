import { Router } from 'express';
import { publicLimiter } from '../../middleware/rate-limit.js';
import { ok } from '../../utils/respond.js';

/** GET /api/v1/health - public liveness probe. */
export const healthRouter = Router();

healthRouter.get('/', (_req, res) => {
  ok(res, { status: 'ok', service: 'pharmaguard-api' });
});

export function mountHealth(router: Router): void {
  router.use('/health', publicLimiter, healthRouter);
}
