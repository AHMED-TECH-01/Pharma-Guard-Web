import { Router, type Request, type Response } from 'express';
import type { ReportType } from '@pharmaguard/types';
import { REPORT_TYPES, reportQuerySchema } from '@pharmaguard/validation';
import { PERMISSIONS, requirePermission } from '../../middleware/authorize.js';
import { getValidatedQuery, validateQuery } from '../../middleware/validate.js';
import { ApiError } from '../../utils/api-error.js';
import { ok } from '../../utils/respond.js';
import { renderReportPdf } from './reports.pdf.js';
import { buildReport, getReportPreview, renderReportCsv, reportFileName } from './reports.service.js';

/**
 * Report endpoints (PRD §10.20, build-plan Phase 11). One parameterised GET:
 * format=json (default) returns a capped preview, format=csv|pdf streams a
 * download. OWNER/MANAGER via reports.read.
 */

export const reportsRouter = Router();

reportsRouter.get(
  '/:type',
  requirePermission(PERMISSIONS.reportsRead),
  validateQuery(reportQuerySchema),
  async (req: Request, res: Response, next) => {
    try {
      if (!req.pharmacyId) throw ApiError.forbidden('No pharmacy context on request');
      const type = String(req.params.type) as ReportType;
      if (!REPORT_TYPES.includes(type)) {
        throw ApiError.notFound(`Unknown report "${type ?? ''}"`);
      }
      const query = getValidatedQuery(req, reportQuerySchema);

      if (query.format === 'csv') {
        const report = await buildReport(req.pharmacyId, type, query);
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${reportFileName(report, 'csv')}"`);
        res.send(renderReportCsv(report));
        return;
      }
      if (query.format === 'pdf') {
        const report = await buildReport(req.pharmacyId, type, query);
        await renderReportPdf(res, report);
        return;
      }
      ok(res, await getReportPreview(req.pharmacyId, type, query));
    } catch (error) {
      next(error);
    }
  },
);
