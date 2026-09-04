import { z } from 'zod';

/**
 * AI OCR validation schemas (TRD §8, PRD §10.6, TRD §33).
 *
 * The review form always submits every corrected field (empty string means
 * "cleared"), so the confirmation endpoint can distinguish an intentional
 * correction from a missing value - user corrections win over AI output
 * (TRD §33: never override pharmacist corrections).
 */

const correctedText = (max: number) => z.string().max(max);

const correctedDate = z.union([
  z.literal(''),
  z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Dates must use the YYYY-MM-DD format'),
]);

/** Body of POST /ocr/scans/:id/confirm - the user-reviewed field values. */
export const confirmScanSchema = z.object({
  correctedExtraction: z
    .object({
      medicineName: correctedText(255),
      genericName: correctedText(255),
      strength: correctedText(100),
      dosageForm: correctedText(100),
      manufacturer: correctedText(255),
      batchNumber: correctedText(100),
      manufacturingDate: correctedDate,
      expiryDate: correctedDate,
    })
    .optional(),
});

export type ConfirmScanInput = z.infer<typeof confirmScanSchema>;
export type OcrCorrection = NonNullable<ConfirmScanInput['correctedExtraction']>;
