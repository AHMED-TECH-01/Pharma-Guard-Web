import { getEnv } from '../../config/env.js';
import type { PaymentMethodId, PaymentMethodInstruction } from '@pharmaguard/types';

/**
 * Manual payment receiving accounts (spec §3/§4).
 *
 * The account numbers live exclusively in API-only environment variables —
 * never in the client bundle, never in git (apps/api/.env is gitignored; the
 * production values are Vercel env vars on pharma-guard-api). Signed-in users
 * receive the details through GET /billing/payment-methods so they can send
 * the money; anonymous visitors and the JS bundle never see them.
 */

const METHOD_LABELS: Record<PaymentMethodId, string> = {
  EASYPAISA: 'Easypaisa',
  JAZZCASH: 'JazzCash',
  BANK_TRANSFER: 'Bank Transfer',
};

/** Only methods whose account details are configured are offered. */
export function listPaymentMethods(): PaymentMethodInstruction[] {
  const env = getEnv();
  const methods: PaymentMethodInstruction[] = [];

  if (env.EASYPAISA_ACCOUNT_NAME && env.EASYPAISA_ACCOUNT_NUMBER) {
    methods.push({
      method: 'EASYPAISA',
      label: METHOD_LABELS.EASYPAISA,
      accountName: env.EASYPAISA_ACCOUNT_NAME,
      accountNumber: env.EASYPAISA_ACCOUNT_NUMBER,
      bankName: null,
      instructions:
        'Send the exact plan amount to the Easypaisa account, then submit the transaction ID (TID) shown in your confirmation SMS as the payment reference.',
    });
  }

  if (env.JAZZCASH_ACCOUNT_NAME && env.JAZZCASH_ACCOUNT_NUMBER) {
    methods.push({
      method: 'JAZZCASH',
      label: METHOD_LABELS.JAZZCASH,
      accountName: env.JAZZCASH_ACCOUNT_NAME,
      accountNumber: env.JAZZCASH_ACCOUNT_NUMBER,
      bankName: null,
      instructions:
        'Send the exact plan amount to the JazzCash account, then submit the TID from your confirmation SMS as the payment reference.',
    });
  }

  if (env.BANK_ACCOUNT_NAME && env.BANK_NAME && env.BANK_ACCOUNT_NUMBER) {
    methods.push({
      method: 'BANK_TRANSFER',
      label: METHOD_LABELS.BANK_TRANSFER,
      accountName: env.BANK_ACCOUNT_NAME,
      accountNumber: env.BANK_ACCOUNT_NUMBER,
      bankName: env.BANK_NAME,
      instructions:
        'Transfer the exact plan amount to the bank account, then submit the funds-transfer reference number from your receipt as the payment reference.',
    });
  }

  return methods;
}
