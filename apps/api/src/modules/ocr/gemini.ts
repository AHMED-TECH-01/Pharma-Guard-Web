import { GoogleGenAI, Type } from '@google/genai';
import { z } from 'zod';
import { getEnv } from '../../config/env.js';
import { logger } from '../../utils/logger.js';
import { ApiError } from '../../utils/api-error.js';
import { OCR_FIELD_KEYS, type OcrExtraction, type OcrFieldKey } from '@pharmaguard/types';

/**
 * Gemini Vision integration (TRD §8, library-docs.md §4).
 *
 * - Backend-controlled only: the key never leaves apps/api.
 * - Structured output is forced with a response schema; the model must return
 *   null for fields it cannot read - it never invents values (TRD §33).
 * - Output is re-validated and normalized server-side before it is ever
 *   stored or shown to the user (pipeline step: "Validation / Normalization").
 */

/**
 * Default vision model. gemini-2.5-flash stopped accepting new generateContent
 * callers (404 "no longer available to new users"); gemini-3.6-flash is the
 * supported replacement (verified against the live model catalog).
 * GEMINI_MODEL can still override it (apps/api/.env).
 */
export const DEFAULT_MODEL = 'gemini-3.6-flash';

/** Single user-facing message for any Gemini failure (task rule: calm, actionable). */
export const OCR_UNAVAILABLE_MESSAGE =
  'AI scanning is temporarily unavailable. Please try again or enter the medicine manually.';

/**
 * Safe retry for TRANSIENT model/API problems only (429/500/503, UNAVAILABLE,
 * RESOURCE_EXHAUSTED). Never switches models and never retries permanent
 * errors (400/403/404) - those fail fast so the user can retry or fall back
 * to manual entry.
 */
const TRANSIENT_CODES = new Set([429, 500, 503]);
const MAX_ATTEMPTS = 3;
const RETRY_BASE_DELAY_MS = 1200;

function isTransientFailure(cause: unknown): boolean {
  const message = cause instanceof Error ? cause.message : String(cause);
  try {
    const parsed = JSON.parse(message) as { error?: { code?: number; status?: string } };
    if (parsed.error?.code !== undefined && TRANSIENT_CODES.has(parsed.error.code)) return true;
    if (parsed.error?.status === 'UNAVAILABLE' || parsed.error?.status === 'RESOURCE_EXHAUSTED') {
      return true;
    }
  } catch {
    // Not a JSON body - fall through to the code-pattern check.
  }
  return /\b(429|500|503)\b/.test(message);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const EXTRACTION_PROMPT = `You are a pharmacy assistant extracting medicine details from a photo of a medicine package (box, strip, or bottle).

Read the image and return JSON with the following fields:
- medicineName: the brand/product name exactly as printed (e.g. "Panadol").
- genericName: the active ingredient/generic name if printed (e.g. "Paracetamol").
- strength: the dosage strength as printed (e.g. "500mg", "5mg/ml").
- dosageForm: form of the medicine (e.g. "Tablet", "Syrup", "Injection", "Capsule").
- manufacturer: the manufacturing company name if printed.
- batchNumber: the batch/lot number as printed.
- manufacturingDate: manufacturing date if printed, formatted exactly as YYYY-MM-DD.
- expiryDate: expiry date if printed, formatted exactly as YYYY-MM-DD.
- confidence: an object with a number between 0 and 1 for each field above, reflecting how certain you are that the value was read correctly. Include a key only for fields you returned a value for.

Rules:
- Use null for any field that is not visible or not legible. NEVER guess or invent a value.
- If text is blurry, partially covered, or you cannot read every character clearly, return null for that field - NEVER reconstruct or infer a value (a date, a batch number) from partial visibility.
- Dates must be real calendar dates; if only month/year is printed, use the last day of that month.
- Do not add any text outside the JSON object.`;

/** Response schema forcing the structured shape (OpenAPI subset). */
const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: Object.fromEntries([
    ...['medicineName', 'genericName', 'strength', 'dosageForm', 'manufacturer', 'batchNumber', 'manufacturingDate', 'expiryDate'].map(
      (field) => [field, { type: Type.STRING, nullable: true }],
    ),
    [
      'confidence',
      {
        type: Type.OBJECT,
        properties: Object.fromEntries(
          OCR_FIELD_KEYS.map((field) => [field, { type: Type.NUMBER }]),
        ),
        required: [] as string[],
      },
    ],
  ]),
  required: ['medicineName', 'confidence'],
} as const;

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function normalizeText(value: unknown, maxLength: number): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.toLowerCase() === 'null' || trimmed.toLowerCase() === 'n/a') return null;
  return trimmed.slice(0, maxLength);
}

function normalizeDate(value: unknown): string | null {
  const text = normalizeText(value, 10);
  if (!text || !ISO_DATE_PATTERN.test(text)) return null;
  const parsed = new Date(`${text}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== text) return null;
  return text;
}

function normalizeConfidence(value: unknown): OcrExtraction['confidence'] {
  if (typeof value !== 'object' || value === null) return {};
  const confidence: OcrExtraction['confidence'] = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (!OCR_FIELD_KEYS.includes(key as OcrFieldKey)) continue;
    if (typeof raw !== 'number' || Number.isNaN(raw)) continue;
    confidence[key as OcrFieldKey] = Math.min(1, Math.max(0, raw));
  }
  return confidence;
}

/** Zod schema describing the raw model JSON; normalization happens after. */
const rawExtractionSchema = z.object({
  medicineName: z.string().nullable().optional(),
  genericName: z.string().nullable().optional(),
  strength: z.string().nullable().optional(),
  dosageForm: z.string().nullable().optional(),
  manufacturer: z.string().nullable().optional(),
  batchNumber: z.string().nullable().optional(),
  manufacturingDate: z.string().nullable().optional(),
  expiryDate: z.string().nullable().optional(),
  confidence: z.record(z.string(), z.number()).optional(),
});

/** Normalizes raw model JSON into the stored/reviewed OcrExtraction. */
export function normalizeExtraction(raw: unknown): OcrExtraction {
  const parsed = rawExtractionSchema.parse(raw);
  return {
    medicineName: normalizeText(parsed.medicineName, 255),
    genericName: normalizeText(parsed.genericName, 255),
    strength: normalizeText(parsed.strength, 100),
    dosageForm: normalizeText(parsed.dosageForm, 100),
    manufacturer: normalizeText(parsed.manufacturer, 255),
    batchNumber: normalizeText(parsed.batchNumber, 100),
    manufacturingDate: normalizeDate(parsed.manufacturingDate),
    expiryDate: normalizeDate(parsed.expiryDate),
    confidence: normalizeConfidence(parsed.confidence),
  };
}

let client: GoogleGenAI | null = null;

function getClient(): GoogleGenAI {
  if (client) return client;
  const { GEMINI_API_KEY } = getEnv();
  if (!GEMINI_API_KEY) {
    throw ApiError.externalService(
      'AI OCR is not configured. Ask the administrator to set GEMINI_API_KEY.',
    );
  }
  client = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
  return client;
}

/**
 * Sends one image to Gemini Vision and returns the normalized extraction.
 * Throws ApiError.ocrFailed when the model fails or returns unusable output;
 * the caller records the failed scan row.
 */
export async function extractMedicine(
  image: { mimeType: string; data: Buffer },
): Promise<OcrExtraction> {
  const env = getEnv();
  const model = env.GEMINI_MODEL || DEFAULT_MODEL;

  let response;
  try {
    // Bounded same-model retry for transient failures only (see
    // isTransientFailure); permanent errors rethrow immediately.
    for (let attempt = 1; ; attempt += 1) {
      try {
        response = await getClient().models.generateContent({
          model,
          contents: [
            {
              role: 'user',
              parts: [
                { text: EXTRACTION_PROMPT },
                { inlineData: { mimeType: image.mimeType, data: image.data.toString('base64') } },
              ],
            },
          ],
          config: {
            temperature: 0,
            responseMimeType: 'application/json',
            responseSchema: RESPONSE_SCHEMA,
          },
        });
        break;
      } catch (cause) {
        if (attempt >= MAX_ATTEMPTS || !isTransientFailure(cause)) throw cause;
        logger.warn('gemini_retry', {
          model,
          attempt,
          nextDelayMs: RETRY_BASE_DELAY_MS * attempt,
        });
        await delay(RETRY_BASE_DELAY_MS * attempt);
      }
    }
  } catch (cause) {
    // Raw provider details (status, Google error text) stay server-side only;
    // the client receives the calm actionable message without any of them.
    logger.error('gemini_request_failed', {
      model,
      message: cause instanceof Error ? cause.message : String(cause),
    });
    throw ApiError.ocrFailed(OCR_UNAVAILABLE_MESSAGE);
  }

  const text = response.text ?? '';
  let rawJson: unknown;
  try {
    rawJson = JSON.parse(text);
  } catch {
    logger.warn('gemini_unparseable_output', { model, length: text.length });
    throw ApiError.ocrFailed(OCR_UNAVAILABLE_MESSAGE);
  }

  try {
    return normalizeExtraction(rawJson);
  } catch {
    logger.warn('gemini_invalid_shape', { model });
    throw ApiError.ocrFailed(OCR_UNAVAILABLE_MESSAGE);
  }
}
