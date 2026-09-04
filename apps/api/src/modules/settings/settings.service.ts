import type { NotificationPrefs, PharmacySettings } from '@pharmaguard/types';
import { getSupabaseAdmin, getSupabaseAuth } from '../../database/supabase.js';
import { ApiError } from '../../utils/api-error.js';
import { writeAudit } from '../../utils/audit.js';

/**
 * Settings services (PRD §10.21, build-plan Phase 12). Pharmacy details are
 * OWNER-editable (settings.manage); profile, notification preferences and
 * the password are self-service. Appearance is a browser preference and
 * never reaches the API.
 *
 * Self-service writes may run without an active pharmacy context, so audits
 * are written only when one exists (writeAudit is tenant-scoped).
 */

type AuditRequest = Parameters<typeof writeAudit>[0]['request'];

interface PharmacyRow {
  name: string;
  owner_name: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  currency: string;
}

function toSettings(row: PharmacyRow): PharmacySettings {
  return {
    name: row.name,
    ownerName: row.owner_name,
    phone: row.phone,
    email: row.email,
    address: row.address,
    currency: row.currency,
  };
}

/** Schema trims values; empty strings mean "clear the field" -> null. */
function emptyToNull(value: string | undefined): string | null {
  return value !== undefined && value.length > 0 ? value : null;
}

export async function getPharmacySettings(pharmacyId: string): Promise<PharmacySettings> {
  const { data, error } = await getSupabaseAdmin()
    .from('pharmacies')
    .select('name, owner_name, phone, email, address, currency')
    .eq('id', pharmacyId)
    .maybeSingle();
  if (error) {
    throw ApiError.internal(`Unable to load pharmacy settings: ${error.message}`);
  }
  if (!data) {
    throw ApiError.notFound('Pharmacy not found.');
  }
  return toSettings(data as unknown as PharmacyRow);
}

export async function updatePharmacySettings(
  pharmacyId: string,
  actorId: string,
  input: {
    name: string;
    ownerName?: string;
    phone?: string;
    email?: string;
    address?: string;
  },
  request: AuditRequest,
): Promise<PharmacySettings> {
  const before = await getPharmacySettings(pharmacyId);

  const { error } = await getSupabaseAdmin()
    .from('pharmacies')
    .update({
      name: input.name,
      owner_name: emptyToNull(input.ownerName),
      phone: emptyToNull(input.phone),
      email: emptyToNull(input.email),
      address: emptyToNull(input.address),
    })
    .eq('id', pharmacyId);
  if (error) {
    throw ApiError.internal(`Unable to update pharmacy settings: ${error.message}`);
  }

  await writeAudit({
    pharmacyId,
    userId: actorId,
    action: 'pharmacy.updated',
    entityType: 'pharmacy',
    entityId: pharmacyId,
    before,
    after: input,
    request,
  });

  return getPharmacySettings(pharmacyId);
}

export async function updateOwnProfile(
  userId: string,
  pharmacyId: string | null,
  input: { fullName: string; phone?: string },
  request: AuditRequest,
): Promise<{ fullName: string; phone: string | null }> {
  const supabase = getSupabaseAdmin();
  const phone = emptyToNull(input.phone);

  const { data: currentRow, error: fetchError } = await supabase
    .from('profiles')
    .select('full_name, phone')
    .eq('id', userId)
    .maybeSingle();
  if (fetchError) {
    throw ApiError.internal(`Unable to load your profile: ${fetchError.message}`);
  }
  const before = currentRow as unknown as { full_name: string | null; phone: string | null } | null;

  const { error } = await supabase
    .from('profiles')
    .upsert({ id: userId, full_name: input.fullName, phone }, { onConflict: 'id' });
  if (error) {
    throw ApiError.internal(`Unable to update your profile: ${error.message}`);
  }

  if (pharmacyId) {
    await writeAudit({
      pharmacyId,
      userId,
      action: 'profile.updated',
      entityType: 'profile',
      entityId: userId,
      before: { fullName: before?.full_name ?? null, phone: before?.phone ?? null },
      after: { fullName: input.fullName, phone },
      request,
    });
  }

  return { fullName: input.fullName, phone };
}

const DEFAULT_PREFS: NotificationPrefs = {
  emailCritical: true,
  emailWarnings: true,
  weeklyDigest: false,
};

/** Missing or malformed stored values fall back to safe defaults. */
function mergePrefs(raw: unknown): NotificationPrefs {
  const record = (raw ?? {}) as Record<string, unknown>;
  return {
    emailCritical:
      typeof record.emailCritical === 'boolean' ? record.emailCritical : DEFAULT_PREFS.emailCritical,
    emailWarnings:
      typeof record.emailWarnings === 'boolean' ? record.emailWarnings : DEFAULT_PREFS.emailWarnings,
    weeklyDigest:
      typeof record.weeklyDigest === 'boolean' ? record.weeklyDigest : DEFAULT_PREFS.weeklyDigest,
  };
}

export async function getNotificationPrefs(userId: string): Promise<NotificationPrefs> {
  const { data, error } = await getSupabaseAdmin()
    .from('profiles')
    .select('notification_prefs')
    .eq('id', userId)
    .maybeSingle();
  if (error) {
    throw ApiError.internal(`Unable to load notification preferences: ${error.message}`);
  }
  const row = data as unknown as { notification_prefs: unknown } | null;
  return mergePrefs(row?.notification_prefs);
}

export async function updateNotificationPrefs(
  userId: string,
  pharmacyId: string | null,
  prefs: NotificationPrefs,
  request: AuditRequest,
): Promise<NotificationPrefs> {
  const { error } = await getSupabaseAdmin()
    .from('profiles')
    .upsert({ id: userId, notification_prefs: prefs }, { onConflict: 'id' });
  if (error) {
    throw ApiError.internal(`Unable to save notification preferences: ${error.message}`);
  }

  if (pharmacyId) {
    await writeAudit({
      pharmacyId,
      userId,
      action: 'notifications.updated',
      entityType: 'profile',
      entityId: userId,
      after: prefs,
      request,
    });
  }

  return prefs;
}

/**
 * Password change requires re-authentication: the current password is
 * verified with the publishable client before the admin API applies the
 * new one. The change is audited for the security timeline.
 */
export async function changePassword(
  userId: string,
  email: string,
  pharmacyId: string | null,
  input: { currentPassword: string; newPassword: string },
  request: AuditRequest,
): Promise<void> {
  const { error: verifyError } = await getSupabaseAuth().auth.signInWithPassword({
    email,
    password: input.currentPassword,
  });
  if (verifyError) {
    throw ApiError.badRequest('Your current password is incorrect.');
  }

  const { error } = await getSupabaseAdmin().auth.admin.updateUserById(userId, {
    password: input.newPassword,
  });
  if (error) {
    throw ApiError.externalService(`Could not update the password: ${error.message}`);
  }

  if (pharmacyId) {
    await writeAudit({
      pharmacyId,
      userId,
      action: 'security.password_changed',
      entityType: 'user',
      entityId: userId,
      request,
    });
  }
}
