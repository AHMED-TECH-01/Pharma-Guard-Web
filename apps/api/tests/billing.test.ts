import { describe, expect, it } from 'vitest';
import {
  PAID_PLAN_IDS,
  PAYMENT_METHOD_IDS,
  PLANS,
  getPlan,
} from '@pharmaguard/types';
import {
  rejectPaymentSchema,
  subscribeFreeSchema,
  submitPaymentSchema,
} from '@pharmaguard/validation';

/**
 * Billing contract tests (subscriptions spec §1/§17). Pins the shared plan
 * ladder - the single source of truth used by the pricing page, the
 * subscription UI, the API enforcement and the DB check constraints - and
 * the payment submission rules the client mirrors.
 */

describe('PLANS single source of truth', () => {
  it('exposes the four tiers at their launch prices', () => {
    expect(PLANS.map((plan) => plan.id)).toEqual(['FREE', 'STARTER', 'PROFESSIONAL', 'PREMIUM']);
    expect(PLANS.map((plan) => plan.pricePkr)).toEqual([0, 500, 1500, 3500]);
  });

  it('scales the limits monotonically up the ladder', () => {
    for (let i = 1; i < PLANS.length; i += 1) {
      const previous = PLANS[i - 1]!;
      const current = PLANS[i]!;
      expect(current.limits.medicines).toBeGreaterThan(previous.limits.medicines);
      expect(current.limits.users).toBeGreaterThan(previous.limits.users);
    }
    expect(PLANS[0]!.limits.ocrScansPerMonth).toBe(50);
    // Premium is unlimited: null means "no cap" for the enforcement helper.
    expect(PLANS[PLANS.length - 1]!.limits.ocrScansPerMonth).toBeNull();
  });

  it('marks exactly the priced plans as paid and resolves lookups', () => {
    expect(PAID_PLAN_IDS).toEqual(['STARTER', 'PROFESSIONAL', 'PREMIUM']);
    expect(getPlan('PROFESSIONAL')?.priceLabel).toBe('Rs. 1,500');
    // Legacy plan ids no longer resolve to a purchasable definition.
    expect(getPlan('ENTERPRISE')).toBeNull();
  });
});

describe('submitPaymentSchema', () => {
  it('accepts a paid plan with a configured method and a reference', () => {
    const result = submitPaymentSchema.parse({
      planId: 'STARTER',
      method: 'EASYPAISA',
      reference: '  TID-123456789  ',
    });
    expect(result.planId).toBe('STARTER');
    expect(result.reference).toBe('TID-123456789');
  });

  it('rejects the free plan, unknown methods and short references', () => {
    expect(() =>
      submitPaymentSchema.parse({ planId: 'FREE', method: 'EASYPAISA', reference: 'TID-1' }),
    ).toThrow();
    expect(() =>
      submitPaymentSchema.parse({ planId: 'STARTER', method: 'PAYPAL', reference: 'TID-1234' }),
    ).toThrow();
    expect(() =>
      submitPaymentSchema.parse({ planId: 'STARTER', method: 'EASYPAISA', reference: 'ab' }),
    ).toThrow();
    expect(() =>
      submitPaymentSchema.parse({ planId: 'STARTER', method: 'EASYPAISA' }),
    ).toThrow();
  });
});

describe('subscribeFreeSchema', () => {
  it('accepts only the FREE plan id', () => {
    expect(subscribeFreeSchema.parse({ planId: 'FREE' }).planId).toBe('FREE');
    expect(() => subscribeFreeSchema.parse({ planId: 'STARTER' })).toThrow();
  });
});

describe('rejectPaymentSchema', () => {
  it('requires a meaningful reason and caps its length', () => {
    const result = rejectPaymentSchema.parse({ reason: '  Reference not found in statement  ' });
    expect(result.reason).toBe('Reference not found in statement');
    expect(() => rejectPaymentSchema.parse({ reason: 'no' })).toThrow();
    expect(() => rejectPaymentSchema.parse({ reason: '' })).toThrow();
    expect(() => rejectPaymentSchema.parse({ reason: 'x'.repeat(501) })).toThrow();
  });

  it('keeps every payment method id covered', () => {
    expect(PAYMENT_METHOD_IDS).toEqual(['EASYPAISA', 'JAZZCASH', 'BANK_TRANSFER']);
  });
});
