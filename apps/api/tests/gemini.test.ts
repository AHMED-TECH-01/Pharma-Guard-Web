import { describe, expect, it } from 'vitest';
import {
  DEFAULT_MODEL,
  OCR_UNAVAILABLE_MESSAGE,
  normalizeExtraction,
} from '../src/modules/ocr/gemini.js';

describe('gemini OCR model configuration', () => {
  it('targets gemini-3.6-flash (gemini-2.5-flash rejects new callers with 404)', () => {
    expect(DEFAULT_MODEL).toBe('gemini-3.6-flash');
  });

  it('uses one calm, actionable user-facing failure message', () => {
    expect(OCR_UNAVAILABLE_MESSAGE).toContain('temporarily unavailable');
    expect(OCR_UNAVAILABLE_MESSAGE).toContain('manually');
    expect(OCR_UNAVAILABLE_MESSAGE).not.toMatch(/api|key|google|stack/i);
  });
});

describe('normalizeExtraction (structured-output robustness)', () => {
  it('keeps a fully valid extraction, including valid ISO dates', () => {
    const extraction = normalizeExtraction({
      medicineName: 'Panadol',
      genericName: 'Paracetamol',
      strength: '500mg',
      dosageForm: 'Tablet',
      manufacturer: 'GSK',
      batchNumber: 'A1234',
      manufacturingDate: '2026-01-31',
      expiryDate: '2028-01-31',
      confidence: { medicineName: 0.97, expiryDate: 0.8 },
    });
    expect(extraction.medicineName).toBe('Panadol');
    expect(extraction.expiryDate).toBe('2028-01-31');
    expect(extraction.confidence.medicineName).toBe(0.97);
  });

  it('maps placeholder text and empty strings to null (never invents values)', () => {
    const extraction = normalizeExtraction({
      medicineName: 'Panadol',
      genericName: 'null',
      strength: 'n/a',
      dosageForm: '',
      manufacturer: '  ',
    });
    expect(extraction.medicineName).toBe('Panadol');
    expect(extraction.genericName).toBeNull();
    expect(extraction.strength).toBeNull();
    expect(extraction.dosageForm).toBeNull();
    expect(extraction.manufacturer).toBeNull();
    expect(extraction.confidence).toEqual({});
  });

  it('rejects non-ISO and impossible dates by nulling them', () => {
    const extraction = normalizeExtraction({
      medicineName: 'Panadol',
      expiryDate: '13/2026',
      manufacturingDate: '2026-13-01',
    });
    expect(extraction.expiryDate).toBeNull();
    expect(extraction.manufacturingDate).toBeNull();
  });

  it('drops unknown confidence keys and clamps values into [0, 1]', () => {
    const extraction = normalizeExtraction({
      medicineName: 'Panadol',
      confidence: {
        medicineName: 1.7,
        expiryDate: -0.2,
        notAField: 0.9,
      },
    });
    expect(extraction.confidence.medicineName).toBe(1);
    expect(extraction.confidence.expiryDate).toBe(0);
    expect(extraction.confidence).not.toHaveProperty('notAField');
    expect(extraction.confidence).not.toHaveProperty('bogus');
  });

  it('truncates over-long values instead of storing them', () => {
    const extraction = normalizeExtraction({
      medicineName: 'x'.repeat(300),
      strength: 'y'.repeat(150),
    });
    expect(extraction.medicineName).toHaveLength(255);
    expect(extraction.strength).toHaveLength(100);
  });

  it('throws on a wrong-typed field so the caller records a controlled failure', () => {
    expect(() => normalizeExtraction({ medicineName: 42 })).toThrow();
    expect(() => normalizeExtraction(null)).toThrow();
  });
});
