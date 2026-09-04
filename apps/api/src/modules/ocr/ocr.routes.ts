import { Router, type NextFunction, type Request, type Response } from 'express';
import multer from 'multer';
import type { OcrScanDetail, OcrScanListItem } from '@pharmaguard/types';
import { confirmScanSchema } from '@pharmaguard/validation';
import { ocrLimiter } from '../../middleware/rate-limit.js';
import { PERMISSIONS, requirePermission } from '../../middleware/authorize.js';
import { getValidatedBody, validateBody } from '../../middleware/validate.js';
import { ApiError } from '../../utils/api-error.js';
import { writeAudit } from '../../utils/audit.js';
import { ok } from '../../utils/respond.js';
import {
  confirmScan,
  discardScan,
  getScan,
  listScans,
  runOcrScan,
} from './ocr.service.js';

/**
 * AI OCR endpoints (TRD §7 OCR, PRD §10.6).
 *
 * Uploads are limited to 20/hour/user (rate-limit.ts) and 10 MB per image,
 * with the MIME type sniffed from bytes, never trusted from the client
 * (TRD §9). The extraction is always returned unverified: the AI never
 * creates inventory - the user reviews, corrects, and confirms (TRD §33),
 * then the client calls POST /medicines and POST /medicines/:id/batches.
 */
export const ocrRouter = Router();

const MAX_FILE_BYTES = 10 * 1024 * 1024;

// Memory-only storage (TRD §9): the image never touches disk or object
// storage; ocr_scans.storage_path stays null.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_BYTES, files: 1 },
});

/** Wraps multer errors into the standard ApiError envelope. */
function uploadSingleImage(req: Request, res: Response, next: NextFunction): void {
  upload.single('image')(req, res, (error) => {
    if (!error) {
      next();
      return;
    }
    if (error instanceof multer.MulterError) {
      next(
        error.code === 'LIMIT_FILE_SIZE'
          ? ApiError.badRequest('Image exceeds the 10 MB size limit')
          : ApiError.badRequest('Could not read the uploaded file'),
      );
      return;
    }
    next(error);
  });
}

/** Narrows the middleware-guaranteed context for the handlers below. */
function requireContext(req: Request): { pharmacyId: string; userId: string } {
  if (!req.pharmacyId) throw ApiError.forbidden('No pharmacy context on request');
  if (!req.auth) throw ApiError.unauthorized('Authentication required');
  return { pharmacyId: req.pharmacyId, userId: req.auth.userId };
}

// Upload a medicine image and extract its details. Returns the scan with the
// unverified extraction - the user must review and confirm (TRD §33).
ocrRouter.post(
  '/scan',
  ocrLimiter,
  requirePermission(PERMISSIONS.ocrUse),
  uploadSingleImage,
  async (req, res, next) => {
    try {
      const file = req.file;
      if (!file) {
        throw ApiError.badRequest('Attach the medicine image in the "image" field');
      }
      const { pharmacyId, userId } = requireContext(req);
      const scan: OcrScanDetail = await runOcrScan(pharmacyId, userId, {
        data: file.buffer,
        declaredMimeType: file.mimetype,
      });
      await writeAudit({
        pharmacyId,
        userId,
        action: 'ocr.scan_completed',
        entityType: 'ocr_scan',
        entityId: scan.id,
        after: { status: scan.status, confidence: scan.confidence },
        request: req,
      });
      ok(res, { scan });
    } catch (error) {
      next(error);
    }
  },
);

// Recent scans for the AI Scan history (PRD §10.6).
ocrRouter.get(
  '/scans',
  requirePermission(PERMISSIONS.ocrUse),
  async (req, res, next) => {
    try {
      const scans: OcrScanListItem[] = await listScans(requireContext(req).pharmacyId);
      ok(res, { scans });
    } catch (error) {
      next(error);
    }
  },
);

ocrRouter.get(
  '/scans/:id',
  requirePermission(PERMISSIONS.ocrUse),
  async (req, res, next) => {
    try {
      const scan = await getScan(requireContext(req).pharmacyId, String(req.params.id));
      ok(res, { scan });
    } catch (error) {
      next(error);
    }
  },
);

// User confirmation of the extraction (TRD §33). Corrections submitted here
// are persisted; the inventory creation itself is done by the client through
// the regular medicine/batch endpoints with the corrected values.
ocrRouter.post(
  '/scans/:id/confirm',
  requirePermission(PERMISSIONS.ocrUse),
  validateBody(confirmScanSchema),
  async (req, res, next) => {
    try {
      const input = getValidatedBody(req, confirmScanSchema);
      const { pharmacyId, userId } = requireContext(req);
      const scan = await confirmScan(pharmacyId, userId, String(req.params.id), input.correctedExtraction);
      ok(res, { scan });
    } catch (error) {
      next(error);
    }
  },
);

ocrRouter.post(
  '/scans/:id/discard',
  requirePermission(PERMISSIONS.ocrUse),
  async (req, res, next) => {
    try {
      const { pharmacyId, userId } = requireContext(req);
      const scan = await discardScan(pharmacyId, userId, String(req.params.id));
      ok(res, { scan });
    } catch (error) {
      next(error);
    }
  },
);
