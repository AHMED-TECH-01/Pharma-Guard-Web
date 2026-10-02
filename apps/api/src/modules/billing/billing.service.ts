import type {
  AdminPaymentListItem,
  PaymentListItem,
  PaymentMethodId,
  PaymentStatus,
  SubscriptionOverview,
  SubscriptionState,
  SubscriptionPlan,
} from '@pharmaguard/types';
import { getPlan } from '@pharmaguard/types';
import { fileTypeFromBuffer } from 'file-type';
import { getSupabaseAdmin } from '../../database/supabase.js';
import { ApiError } from '../../utils/api-error.js';
import { writeAudit } from '../../utils/audit.js';
import { logger } from '../../utils/logger.js';
import { listPaymentMethods } from './payment-methods.js';

/**
 * Billing services (subscriptions spec §2/§4/§7, TRD §32).
 *
 * The manual payment lifecycle: submit (PENDING, amount derived from the
 * shared plan definition, optional proof image into the private
 * payment-proofs bucket) -> platform-admin APPROVED/REJECTED -> only an
 * approval writes the subscriptions row. Users can never grant themselves a
 * plan: no client-facing write path exists for subscriptions or payment
 * status, and the service role is the only writer.
 */

const PROOF_BUCKET = 'payment-proofs';
const PROOF_MAX_BYTES = 5 * 1024 * 1024;
const PROOF_ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);
const PAYMENT_LIST_LIMIT = 20;
const PROOF_URL_TTL_SECONDS = 600;

interface SubscriptionRow {
  plan: string;
  status: string;
  current_period_start: string | null;
  current_period_end: string | null;
}

interface PaymentRow {
  id: string;
  pharmacy_id: string;
  user_id: string;
  plan: string;
  method: string;
  amount_pkr: string | number;
  reference: string;
  proof_path: string | null;
  status: string;
  rejection_reason: string | null;
  submitted_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
}

function toNumber(value: string | number | null | undefined): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && value.length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function toPaymentListItem(row: PaymentRow): PaymentListItem {
  return {
    id: row.id,
    plan: row.plan as PaymentListItem['plan'],
    method: row.method as PaymentMethodId,
    amountPkr: toNumber(row.amount_pkr),
    reference: row.reference,
    status: row.status as PaymentStatus,
    rejectionReason: row.rejection_reason,
    submittedAt: row.submitted_at,
    reviewedAt: row.reviewed_at,
  };
}

/**
 * Loads the subscription row, creating the implicit FREE tier when missing
 * (e.g. pharmacies created before migration 0011's RPC change).
 */
async function ensureSubscriptionRow(pharmacyId: string): Promise<SubscriptionRow> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('subscriptions')
    .select('plan, status, current_period_start, current_period_end')
    .eq('pharmacy_id', pharmacyId)
    .maybeSingle();
  if (error) {
    throw ApiError.internal('Unable to load the subscription.');
  }
  if (data) return data as SubscriptionRow;

  const { data: created, error: insertError } = await supabase
    .from('subscriptions')
    .insert({ pharmacy_id: pharmacyId, plan: 'FREE', status: 'ACTIVE', current_period_start: new Date().toISOString() })
    .select('plan, status, current_period_start, current_period_end')
    .single();
  if (insertError || !created) {
    logger.warn('subscription_backfill_failed', {
      code: insertError?.code ?? null,
      message: insertError?.message ?? null,
    });
    throw ApiError.internal('Unable to initialise the subscription.');
  }
  return created as SubscriptionRow;
}

export async function getSubscriptionOverview(
  pharmacyId: string,
  userId: string,
  request: Parameters<typeof writeAudit>[0]['request'],
): Promise<SubscriptionOverview> {
  const subscriptionRow = await ensureSubscriptionRow(pharmacyId);
  const plan = getPlan(subscriptionRow.plan);
  if (!plan) {
    throw ApiError.internal('The subscription references an unknown plan.');
  }

  const supabase = getSupabaseAdmin();
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);

  const [medicines, members, scans, paymentsResult] = await Promise.all([
    supabase
      .from('medicines')
      .select('id', { count: 'exact', head: true })
      .eq('pharmacy_id', pharmacyId)
      .eq('is_archived', false),
    supabase
      .from('pharmacy_memberships')
      .select('id', { count: 'exact', head: true })
      .eq('pharmacy_id', pharmacyId)
      .eq('status', 'active'),
    supabase
      .from('ocr_scans')
      .select('id', { count: 'exact', head: true })
      .eq('pharmacy_id', pharmacyId)
      .gte('created_at', monthStart.toISOString()),
    supabase
      .from('payments')
      .select('*')
      .eq('pharmacy_id', pharmacyId)
      .order('submitted_at', { ascending: false })
      .limit(PAYMENT_LIST_LIMIT),
  ]);

  if (paymentsResult.error) {
    throw ApiError.internal('Unable to load the payment history.');
  }

  const subscription: SubscriptionState = {
    plan: subscriptionRow.plan as SubscriptionPlan,
    status: subscriptionRow.status as SubscriptionState['status'],
    currentPeriodStart: subscriptionRow.current_period_start,
    currentPeriodEnd: subscriptionRow.current_period_end,
  };

  void userId;
  void request;

  return {
    subscription,
    plan,
    usage: {
      medicines: medicines.count ?? 0,
      users: members.count ?? 0,
      ocrScansThisMonth: scans.count ?? 0,
    },
    payments: (paymentsResult.data ?? []).map((row) => toPaymentListItem(row as PaymentRow)),
  };
}

/** Instant switch to the free tier - no payment involved. */
export async function subscribeToFree(
  pharmacyId: string,
  userId: string,
  request: Parameters<typeof writeAudit>[0]['request'],
): Promise<SubscriptionState> {
  await ensureSubscriptionRow(pharmacyId);
  const now = new Date().toISOString();
  const { error } = await getSupabaseAdmin()
    .from('subscriptions')
    .update({ plan: 'FREE', status: 'ACTIVE', current_period_start: now, current_period_end: null })
    .eq('pharmacy_id', pharmacyId);
  if (error) {
    throw ApiError.internal('Unable to switch to the Free plan.');
  }

  await writeAudit({
    pharmacyId,
    userId,
    action: 'billing.plan_changed',
    entityType: 'subscription',
    entityId: pharmacyId,
    after: { plan: 'FREE', status: 'ACTIVE' },
    request,
  });

  return { plan: 'FREE', status: 'ACTIVE', currentPeriodStart: now, currentPeriodEnd: null };
}

export interface SubmitPaymentInput {
  planId: string;
  method: PaymentMethodId;
  reference: string;
  proof?: { data: Buffer; declaredMimeType: string | null } | null;
}

export async function submitPayment(
  pharmacyId: string,
  userId: string,
  input: SubmitPaymentInput,
  request: Parameters<typeof writeAudit>[0]['request'],
): Promise<PaymentListItem> {
  // Spec §19: the plan AND its amount are resolved server-side.
  const plan = getPlan(input.planId);
  if (!plan || plan.pricePkr <= 0) {
    throw ApiError.badRequest('Choose a paid plan to submit a payment.');
  }
  if (!listPaymentMethods().some((method) => method.method === input.method)) {
    throw ApiError.badRequest('That payment method is not available.');
  }

  const supabase = getSupabaseAdmin();

  // Only one open payment per pharmacy (also enforced by a partial unique
  // index in migration 0011).
  const { data: pending } = await supabase
    .from('payments')
    .select('id')
    .eq('pharmacy_id', pharmacyId)
    .eq('status', 'PENDING')
    .limit(1);
  if (pending && pending.length > 0) {
    throw ApiError.conflict('A payment is already awaiting verification. Wait for its review first.');
  }

  // Spec §6: sniff the proof bytes - never trust the browser-declared type.
  let proofPath: string | null = null;
  if (input.proof && input.proof.data.byteLength > 0) {
    if (input.proof.data.byteLength > PROOF_MAX_BYTES) {
      throw ApiError.badRequest('Payment proof exceeds the 5 MB size limit.');
    }
    const sniffed = await fileTypeFromBuffer(input.proof.data);
    if (!sniffed || !PROOF_ALLOWED_MIME.has(sniffed.mime)) {
      throw ApiError.badRequest('Payment proof must be a JPEG, PNG, or WebP image.');
    }
    const extension = sniffed.ext.replace(/[^a-z0-9]/g, '') || 'jpg';
    proofPath = `${pharmacyId}/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${extension}`;
    const { error: uploadError } = await supabase.storage
      .from(PROOF_BUCKET)
      .upload(proofPath, input.proof.data, { contentType: sniffed.mime, upsert: false });
    if (uploadError) {
      logger.warn('payment_proof_upload_failed', { name: uploadError.name });
      throw ApiError.externalService('Could not store the payment proof. Please try again.');
    }
  }

  const { data: inserted, error } = await supabase
    .from('payments')
    .insert({
      pharmacy_id: pharmacyId,
      user_id: userId,
      plan: plan.id,
      method: input.method,
      amount_pkr: plan.pricePkr,
      currency: 'PKR',
      reference: input.reference,
      proof_path: proofPath,
      status: 'PENDING',
    })
    .select('*')
    .single();

  if (error) {
    if (error.code === '23505') {
      throw ApiError.conflict('A payment is already awaiting verification. Wait for its review first.');
    }
    logger.warn('payment_insert_failed', { code: error.code ?? null });
    throw ApiError.internal('Unable to record the payment.');
  }

  await writeAudit({
    pharmacyId,
    userId,
    action: 'billing.payment_submitted',
    entityType: 'payment',
    entityId: (inserted as PaymentRow).id,
    after: { plan: plan.id, method: input.method, amountPkr: plan.pricePkr },
    request,
  });

  return toPaymentListItem(inserted as PaymentRow);
}

// ---------------------------------------------------------------------------
// Platform-admin review (spec §18) - cross-pharmacy reads via service role.
// ---------------------------------------------------------------------------

export async function listPaymentsForAdmin(
  status: PaymentStatus | 'ALL',
): Promise<AdminPaymentListItem[]> {
  const supabase = getSupabaseAdmin();
  let query = supabase
    .from('payments')
    .select('*, pharmacies(name)')
    .order('submitted_at', { ascending: false })
    .limit(100);
  if (status !== 'ALL') {
    query = query.eq('status', status);
  }
  const { data, error } = await query;
  if (error) {
    throw ApiError.internal('Unable to load payments for review.');
  }

  const rows = (data ?? []) as (PaymentRow & {
    pharmacies: { name: string } | { name: string }[] | null;
  })[];

  // Submitter emails + proof signed URLs are resolved in parallel; failures
  // degrade to null instead of blocking the review queue.
  const [emails, proofUrls] = await Promise.all([
    emailsOf(rows.map((row) => row.user_id)),
    Promise.all(
      rows.map((row) =>
        row.proof_path
          ? supabase.storage
              .from(PROOF_BUCKET)
              .createSignedUrl(row.proof_path, PROOF_URL_TTL_SECONDS)
              .then((result) => (result.error ? null : result.data.signedUrl))
          : Promise.resolve(null),
      ),
    ),
  ]);

  return rows.map((row, index) => {
    const pharmacy = Array.isArray(row.pharmacies) ? row.pharmacies[0] : row.pharmacies;
    return {
      ...toPaymentListItem(row),
      pharmacyId: row.pharmacy_id,
      pharmacyName: pharmacy?.name ?? null,
      userEmail: emails.get(row.user_id) ?? null,
      proofUrl: proofUrls[index] ?? null,
    };
  });
}

/** Submitter emails via the auth admin API; failures degrade to null. */
async function emailsOf(userIds: string[]): Promise<Map<string, string | null>> {
  const emails = new Map<string, string | null>();
  await Promise.allSettled(
    userIds.map(async (userId) => {
      const { data } = await getSupabaseAdmin().auth.admin.getUserById(userId);
      emails.set(userId, data.user?.email ?? null);
    }),
  );
  return emails;
}

export async function approvePayment(
  paymentId: string,
  adminUserId: string,
  request: Parameters<typeof writeAudit>[0]['request'],
): Promise<AdminPaymentListItem> {
  const supabase = getSupabaseAdmin();
  const { data: current, error: fetchError } = await supabase
    .from('payments')
    .select('*')
    .eq('id', paymentId)
    .maybeSingle();
  if (fetchError) {
    throw ApiError.internal('Unable to load the payment.');
  }
  const payment = current as PaymentRow | null;
  if (!payment) {
    throw ApiError.notFound('Payment not found.');
  }
  if (payment.status !== 'PENDING') {
    throw ApiError.conflict('This payment was already reviewed.');
  }

  const now = new Date();
  const periodEnd = new Date(now);
  periodEnd.setUTCDate(periodEnd.getUTCDate() + 30);

  const { error: updateError } = await supabase
    .from('payments')
    .update({ status: 'APPROVED', reviewed_at: now.toISOString(), reviewed_by: adminUserId })
    .eq('id', paymentId)
    .eq('status', 'PENDING');
  if (updateError) {
    throw ApiError.internal('Unable to approve the payment.');
  }

  // Only an approval writes the subscription (spec §2).
  const { error: subscriptionError } = await supabase
    .from('subscriptions')
    .upsert(
      {
        pharmacy_id: payment.pharmacy_id,
        plan: payment.plan,
        status: 'ACTIVE',
        current_period_start: now.toISOString(),
        current_period_end: periodEnd.toISOString(),
      },
      { onConflict: 'pharmacy_id' },
    );
  if (subscriptionError) {
    logger.warn('subscription_upgrade_failed', {
      code: subscriptionError.code ?? null,
      paymentId,
    });
    throw ApiError.internal('The payment was approved but the plan could not be applied.');
  }

  await writeAudit({
    pharmacyId: payment.pharmacy_id,
    userId: adminUserId,
    action: 'billing.payment_approved',
    entityType: 'payment',
    entityId: paymentId,
    before: { status: 'PENDING' },
    after: { status: 'APPROVED', plan: payment.plan },
    request,
  });

  return {
    ...toPaymentListItem({ ...payment, status: 'APPROVED', reviewed_at: now.toISOString(), reviewed_by: adminUserId }),
    pharmacyId: payment.pharmacy_id,
    pharmacyName: null,
    userEmail: null,
    proofUrl: null,
  };
}

export async function rejectPayment(
  paymentId: string,
  adminUserId: string,
  reason: string,
  request: Parameters<typeof writeAudit>[0]['request'],
): Promise<PaymentListItem> {
  const supabase = getSupabaseAdmin();
  const { data: current, error: fetchError } = await supabase
    .from('payments')
    .select('*')
    .eq('id', paymentId)
    .maybeSingle();
  if (fetchError) {
    throw ApiError.internal('Unable to load the payment.');
  }
  const payment = current as PaymentRow | null;
  if (!payment) {
    throw ApiError.notFound('Payment not found.');
  }
  if (payment.status !== 'PENDING') {
    throw ApiError.conflict('This payment was already reviewed.');
  }

  const now = new Date().toISOString();
  const { error } = await supabase
    .from('payments')
    .update({ status: 'REJECTED', rejection_reason: reason, reviewed_at: now, reviewed_by: adminUserId })
    .eq('id', paymentId)
    .eq('status', 'PENDING');
  if (error) {
    throw ApiError.internal('Unable to reject the payment.');
  }

  await writeAudit({
    pharmacyId: payment.pharmacy_id,
    userId: adminUserId,
    action: 'billing.payment_rejected',
    entityType: 'payment',
    entityId: paymentId,
    before: { status: 'PENDING' },
    after: { status: 'REJECTED', reason },
    request,
  });

  return toPaymentListItem({
    ...payment,
    status: 'REJECTED',
    rejection_reason: reason,
    reviewed_at: now,
    reviewed_by: adminUserId,
  });
}
