import { GoogleGenAI, Type } from '@google/genai';
import { z } from 'zod';
import { getEnv } from '../../config/env.js';
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

const DEFAULT_MODEL = 'gemini-2.5-flash';

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
  } catch (cause) {
    throw ApiError.ocrFailed(`Vision model request failed: ${(cause as Error).message}`);
  }

  const text = response.text ?? '';
  let rawJson: unknown;
  try {
    rawJson = JSON.parse(text);
  } catch {
    throw ApiError.ocrFailed('Vision model returned unparseable output');
  }

  try {
    return normalizeExtraction(rawJson);
  } catch {
    throw ApiError.ocrFailed('Vision model output did not match the expected shape');
  }
}
