import { getPlan } from '@pharmaguard/types';
import { getSupabaseAdmin } from '../database/supabase.js';
import { ApiError } from './api-error.js';

/**
 * Plan-limit enforcement (subscriptions spec §19, TRD §32).
 *
 * Limits come from the shared plan definition (packages/types billing.ts) —
 * never from the client. Enforcement is write-only: existing data always
 * remains fully readable and operable, so a downgrade never locks a pharmacy
 * out of its own history; only NEW creations beyond the cap are refused.
 */

export type LimitedResource = 'medicines' | 'users' | 'ocrScans';

interface PlanRow {
  plan: string;
}

/** The pharmacy's active plan definition; a missing row means the FREE tier. */
export async function activePlanFor(pharmacyId: string) {
  const { data, error } = await getSupabaseAdmin()
    .from('subscriptions')
    .select('plan')
    .eq('pharmacy_id', pharmacyId)
    .maybeSingle();
  if (error) {
    throw ApiError.internal('Unable to verify the current subscription.');
  }
  const row = data as PlanRow | null;
  if (!row) return getPlan('FREE')!;
  const plan = getPlan(row.plan);
  if (!plan) {
    throw ApiError.internal('The subscription references an unknown plan.');
  }
  return plan;
}

function limitError(message: string): ApiError {
  return new ApiError(
    'PLAN_LIMIT_REACHED',
    403,
    message,
    { upgrade: true },
  );
}

function startOfMonthUtc(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}

/** Counts the pharmacy's current usage of a limited resource. */
async function usageOf(pharmacyId: string, resource: LimitedResource): Promise<number> {
  const supabase = getSupabaseAdmin();
  let query = supabase.from(
    resource === 'medicines' ? 'medicines' : resource === 'users' ? 'pharmacy_memberships' : 'ocr_scans',
  ).select('id', { count: 'exact', head: true }).eq('pharmacy_id', pharmacyId);

  if (resource === 'medicines') {
    query = query.eq('is_archived', false);
  } else if (resource === 'users') {
    query = query.eq('status', 'active');
  } else {
    query = query.gte('created_at', startOfMonthUtc());
  }

  const { count, error } = await query;
  if (error) {
    throw ApiError.internal('Unable to verify plan usage.');
  }
  return count ?? 0;
}

/**
 * Throws PLAN_LIMIT_REACHED when the pharmacy already used its allowance.
 * Resource-specific wording keeps the 403 actionable in the UI.
 */
export async function assertWithinPlanLimit(
  pharmacyId: string,
  resource: LimitedResource,
): Promise<void> {
  const plan = await activePlanFor(pharmacyId);
  const limit =
    resource === 'medicines'
      ? plan.limits.medicines
      : resource === 'users'
        ? plan.limits.users
        : plan.limits.ocrScansPerMonth;
  if (limit === null) return;

  const used = await usageOf(pharmacyId, resource);
  if (used >= limit) {
    const subject =
      resource === 'medicines'
        ? 'medicines'
        : resource === 'users'
          ? 'team members'
          : 'AI scans this month';
    throw limitError(
      `The ${plan.name} plan allows ${limit.toLocaleString('en-US')} ${subject}. Upgrade your subscription to add more.`,
    );
  }
}
