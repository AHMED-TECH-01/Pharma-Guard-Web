import type { SubscriptionPlan, SubscriptionStatus } from './enums';

/**
 * Subscription plans and manual payment types (PRD §10.22, TRD §32,
 * subscriptions spec §1/§2).
 *
 * This module is the SINGLE SOURCE OF TRUTH for plans: the pricing page, the
 * subscription page, the API and the database checks all derive from it, so
 * a price or limit can never diverge between surfaces. It is deliberately
 * client-safe (no server imports) so the web bundle can import it directly.
 *
 * Account numbers for Easypaisa/JazzCash/bank transfer are NOT defined here —
 * they live in server-only env vars (apps/api/src/modules/billing/
 * payment-methods.ts) and are served to signed-in users through the API.
 */

/** Manually settled payment channels. No gateway integration exists yet. */
export type PaymentMethodId = 'EASYPAISA' | 'JAZZCASH' | 'BANK_TRANSFER';

export type PaymentStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

/** Hard caps enforced server-side on writes; null means unlimited. */
export interface PlanLimits {
  medicines: number;
  users: number;
  ocrScansPerMonth: number | null;
}

export interface PlanDefinition {
  id: SubscriptionPlan;
  name: string;
  /** Monthly price in PKR. 0 = free tier. */
  pricePkr: number;
  /** Display form used on cards and the subscription page. */
  priceLabel: string;
  period: string;
  description: string;
  features: string[];
  recommended?: boolean;
  limits: PlanLimits;
}

export const PLANS: PlanDefinition[] = [
  {
    id: 'FREE',
    name: 'Free',
    pricePkr: 0,
    priceLabel: 'Free',
    period: 'forever',
    description: 'For trying PharmaGuard with a single counter.',
    features: [
      'Up to 500 medicines',
      '1 user',
      '50 AI scans / month',
      'Expiry alerts',
      'Basic reports',
    ],
    limits: { medicines: 500, users: 1, ocrScansPerMonth: 50 },
  },
  {
    id: 'STARTER',
    name: 'Starter',
    pricePkr: 500,
    priceLabel: 'Rs. 500',
    period: '/month',
    description: 'For single-counter pharmacies getting started.',
    features: [
      'Up to 2,000 medicines',
      '3 users',
      '200 AI scans / month',
      'Expiry alerts',
      'Basic reports',
      'Smart reorder suggestions',
    ],
    limits: { medicines: 2000, users: 3, ocrScansPerMonth: 200 },
  },
  {
    id: 'PROFESSIONAL',
    name: 'Professional',
    pricePkr: 1500,
    priceLabel: 'Rs. 1,500',
    period: '/month',
    description: 'For busy pharmacies that need automation.',
    features: [
      'Up to 10,000 medicines',
      '8 users',
      '1,000 AI scans / month',
      'Advanced reports',
      'Smart reorder suggestions',
      'Expanded alerts',
    ],
    recommended: true,
    limits: { medicines: 10000, users: 8, ocrScansPerMonth: 1000 },
  },
  {
    id: 'PREMIUM',
    name: 'Premium',
    pricePkr: 3500,
    priceLabel: 'Rs. 3,500',
    period: '/month',
    description: 'For pharmacies that run on data.',
    features: [
      'Up to 50,000 medicines',
      '25 users',
      'Unlimited AI scans',
      'Advanced analytics',
      'Expanded alerts',
      'Priority support',
    ],
    limits: { medicines: 50000, users: 25, ocrScansPerMonth: null },
  },
];

/** Lookup by plan id; unknown ids (e.g. legacy rows) resolve to null. */
export const PLAN_MAP: Readonly<Record<string, PlanDefinition>> = Object.fromEntries(
  PLANS.map((plan) => [plan.id, plan]),
);

export function getPlan(id: string): PlanDefinition | null {
  return PLAN_MAP[id] ?? null;
}

/** Plans that require a manual payment before activation. */
export const PAID_PLAN_IDS: SubscriptionPlan[] = PLANS.filter(
  (plan) => plan.pricePkr > 0,
).map((plan) => plan.id);

/** Display metadata shared by the subscription and payment UIs. The
 *  receiving account details themselves stay server-side. */
export const PAYMENT_METHOD_LABELS: Readonly<Record<PaymentMethodId, string>> = {
  EASYPAISA: 'Easypaisa',
  JAZZCASH: 'JazzCash',
  BANK_TRANSFER: 'Bank Transfer',
};

export const PAYMENT_METHOD_IDS: PaymentMethodId[] = [
  'EASYPAISA',
  'JAZZCASH',
  'BANK_TRANSFER',
];

/** GET /billing/payment-methods item; account details are server-configured. */
export interface PaymentMethodInstruction {
  method: PaymentMethodId;
  label: string;
  accountName: string;
  accountNumber: string;
  /** Only set for bank transfers. */
  bankName: string | null;
  instructions: string;
}

/** Public shape of a payment row (owner of the pharmacy view). */
export interface PaymentListItem {
  id: string;
  plan: SubscriptionPlan;
  method: PaymentMethodId;
  amountPkr: number;
  reference: string;
  status: PaymentStatus;
  rejectionReason: string | null;
  submittedAt: string;
  reviewedAt: string | null;
}

/** Cross-pharmacy shape for the platform-admin review queue. */
export interface AdminPaymentListItem extends PaymentListItem {
  pharmacyId: string;
  pharmacyName: string | null;
  userEmail: string | null;
  /** Signed storage URL for the uploaded proof, if any (short-lived). */
  proofUrl: string | null;
}

export interface SubscriptionState {
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
}

export interface PlanUsage {
  medicines: number;
  users: number;
  ocrScansThisMonth: number;
}

/** GET /billing/overview payload. */
export interface SubscriptionOverview {
  subscription: SubscriptionState;
  plan: PlanDefinition;
  usage: PlanUsage;
  payments: PaymentListItem[];
}
