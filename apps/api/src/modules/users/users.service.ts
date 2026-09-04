import type { InviteMemberResult, MemberListItem, MemberListResponse, UserRole } from '@pharmaguard/types';
import { getSupabaseAdmin } from '../../database/supabase.js';
import { ApiError } from '../../utils/api-error.js';
import { writeAudit } from '../../utils/audit.js';

/**
 * Team management (PRD §10.21, build-plan Phase 12). Roster reads are for
 * OWNER/MANAGER (users.read); writes are OWNER-only (users.manage), matching
 * the memberships RLS in migration 0002. Self-lockout and last-owner guards
 * keep every pharmacy reachable.
 *
 * Invites are SMTP-independent: an existing platform user is added directly
 * (status active); a brand-new email is created via the auth admin generate
 * link API and the one-time invite link is returned for the owner to share.
 */

const EMAIL_LOOKUP_PAGES = 5;
const EMAIL_LOOKUP_PAGE_SIZE = 200;

interface AuthUserEmail {
  id: string;
  email: string | null;
}

async function fetchEmails(userIds: string[]): Promise<Map<string, string>> {
  const emails = new Map<string, string>();
  await Promise.allSettled(
    userIds.map(async (userId) => {
      const { data, error } = await getSupabaseAdmin().auth.admin.getUserById(userId);
      if (!error && data.user?.email) {
        emails.set(userId, data.user.email);
      }
    }),
  );
  return emails;
}

async function findAuthUserByEmail(email: string): Promise<AuthUserEmail | null> {
  const admin = getSupabaseAdmin().auth.admin;
  const target = email.toLowerCase();
  for (let page = 1; page <= EMAIL_LOOKUP_PAGES; page += 1) {
    const { data, error } = await admin.listUsers({ page, perPage: EMAIL_LOOKUP_PAGE_SIZE });
    if (error) {
      throw ApiError.externalService('Unable to verify the email with the auth service');
    }
    const match = data.users.find((user) => (user.email ?? '').toLowerCase() === target);
    if (match) return { id: match.id, email: match.email ?? null };
    if (data.users.length < EMAIL_LOOKUP_PAGE_SIZE) break;
  }
  return null;
}

async function assertNotLastOwner(pharmacyId: string, targetUserId: string): Promise<void> {
  const { data, error } = await getSupabaseAdmin()
    .from('pharmacy_memberships')
    .select('user_id')
    .eq('pharmacy_id', pharmacyId)
    .eq('role', 'OWNER')
    .eq('status', 'active');
  if (error) {
    throw ApiError.internal(`Unable to verify owner count: ${error.message}`);
  }
  const owners = (data ?? []) as unknown as { user_id: string }[];
  if (owners.length === 1 && owners[0]?.user_id === targetUserId) {
    throw ApiError.conflict(
      'This member is the last active owner. Promote another owner first.',
    );
  }
}

async function buildMemberItem(
  membership: { user_id: string; role: string; status: string; created_at: string },
  profiles: Map<string, { full_name: string | null; phone: string | null }>,
  emails: Map<string, string>,
): Promise<MemberListItem> {
  const profile = profiles.get(membership.user_id);
  return {
    userId: membership.user_id,
    email: emails.get(membership.user_id) ?? null,
    fullName: profile?.full_name ?? null,
    phone: profile?.phone ?? null,
    role: membership.role as MemberListItem['role'],
    status: membership.status as MemberListItem['status'],
    joinedAt: membership.created_at,
  };
}

export async function listMembers(pharmacyId: string): Promise<MemberListResponse> {
  const supabase = getSupabaseAdmin();
  const [memberships, profiles] = await Promise.all([
    supabase
      .from('pharmacy_memberships')
      .select('user_id, role, status, created_at')
      .eq('pharmacy_id', pharmacyId)
      .order('created_at', { ascending: true }),
    supabase.from('profiles').select('id, full_name, phone'),
  ]);

  if (memberships.error || profiles.error) {
    const firstError = memberships.error ?? profiles.error;
    throw ApiError.internal(`Unable to load the team roster: ${firstError?.message ?? 'unknown'}`);
  }

  const profileMap = new Map<string, { full_name: string | null; phone: string | null }>();
  for (const row of profiles.data ?? []) {
    const record = row as { id: string; full_name: string | null; phone: string | null };
    profileMap.set(record.id, { full_name: record.full_name, phone: record.phone });
  }

  const rows = (memberships.data ?? []) as unknown as {
    user_id: string;
    role: string;
    status: string;
    created_at: string;
  }[];
  const emails = await fetchEmails(rows.map((row) => row.user_id));

  const members = await Promise.all(
    rows.map((row) => buildMemberItem(row, profileMap, emails)),
  );
  return { members };
}

export async function inviteMember(
  pharmacyId: string,
  actorId: string,
  input: { email: string; role: UserRole },
  request: Parameters<typeof writeAudit>[0]['request'],
): Promise<InviteMemberResult> {
  if (input.role === 'OWNER') {
    throw ApiError.badRequest('New members cannot be invited as OWNER');
  }

  const supabase = getSupabaseAdmin();

  const existing = await findAuthUserByEmail(input.email);
  let userId: string;
  let status: 'active' | 'invited';
  let inviteLink: string | null = null;

  if (existing) {
    const { data: existingMembership, error: membershipError } = await supabase
      .from('pharmacy_memberships')
      .select('id')
      .eq('pharmacy_id', pharmacyId)
      .eq('user_id', existing.id)
      .maybeSingle();
    if (membershipError) {
      throw ApiError.internal(`Unable to verify membership: ${membershipError.message}`);
    }
    if (existingMembership) {
      throw ApiError.conflict('This user is already a member of the pharmacy.');
    }
    userId = existing.id;
    status = 'active';
  } else {
    const { data, error } = await supabase.auth.admin.generateLink({
      type: 'invite',
      email: input.email,
    });
    if (error || !data.user) {
      throw ApiError.externalService(
        `Could not create the invited user: ${error?.message ?? 'unknown auth error'}`,
      );
    }
    userId = data.user.id;
    status = 'invited';
    inviteLink = data.properties.action_link ?? null;
  }

  const { data: membership, error: insertError } = await supabase
    .from('pharmacy_memberships')
    .insert({ pharmacy_id: pharmacyId, user_id: userId, role: input.role, status })
    .select('user_id, role, status, created_at')
    .single();
  if (insertError) {
    throw ApiError.internal(`Unable to add the member: ${insertError.message}`);
  }

  const emails = await fetchEmails([userId]);
  const { data: profileRow } = await supabase
    .from('profiles')
    .select('id, full_name, phone')
    .eq('id', userId)
    .maybeSingle();
  const profileMap = new Map<string, { full_name: string | null; phone: string | null }>();
  if (profileRow) {
    const record = profileRow as { id: string; full_name: string | null; phone: string | null };
    profileMap.set(record.id, { full_name: record.full_name, phone: record.phone });
  }

  await writeAudit({
    pharmacyId,
    userId: actorId,
    action: existing ? 'member.added' : 'member.invited',
    entityType: 'member',
    entityId: userId,
    after: { role: input.role, status },
    request,
  });

  const member = await buildMemberItem(
    (membership as unknown as { user_id: string; role: string; status: string; created_at: string }),
    profileMap,
    emails,
  );
  return { member, inviteLink };
}

export async function updateMember(
  pharmacyId: string,
  actorId: string,
  targetUserId: string,
  input: { role?: string; status?: string },
  request: Parameters<typeof writeAudit>[0]['request'],
): Promise<MemberListItem> {
  const supabase = getSupabaseAdmin();

  if (targetUserId === actorId) {
    throw ApiError.badRequest('You cannot change your own role or status.');
  }

  const { data: current, error: fetchError } = await supabase
    .from('pharmacy_memberships')
    .select('user_id, role, status, created_at')
    .eq('pharmacy_id', pharmacyId)
    .eq('user_id', targetUserId)
    .maybeSingle();
  if (fetchError) {
    throw ApiError.internal(`Unable to load the member: ${fetchError.message}`);
  }
  if (!current) {
    throw ApiError.notFound('Member not found in this pharmacy.');
  }
  const before = current as unknown as { user_id: string; role: string; status: string; created_at: string };

  if (before.role === 'OWNER' && ((input.role && input.role !== 'OWNER') || input.status === 'suspended')) {
    await assertNotLastOwner(pharmacyId, targetUserId);
  }

  const { data: updated, error: updateError } = await supabase
    .from('pharmacy_memberships')
    .update({
      ...(input.role !== undefined ? { role: input.role } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
    })
    .eq('pharmacy_id', pharmacyId)
    .eq('user_id', targetUserId)
    .select('user_id, role, status, created_at')
    .single();
  if (updateError) {
    throw ApiError.internal(`Unable to update the member: ${updateError.message}`);
  }

  await writeAudit({
    pharmacyId,
    userId: actorId,
    action: input.role !== undefined ? 'member.role_changed' : 'member.status_changed',
    entityType: 'member',
    entityId: targetUserId,
    before: { role: before.role, status: before.status },
    after: { role: input.role ?? before.role, status: input.status ?? before.status },
    request,
  });

  const emails = await fetchEmails([targetUserId]);
  const { data: profileRow } = await supabase
    .from('profiles')
    .select('id, full_name, phone')
    .eq('id', targetUserId)
    .maybeSingle();
  const profileMap = new Map<string, { full_name: string | null; phone: string | null }>();
  if (profileRow) {
    const record = profileRow as { id: string; full_name: string | null; phone: string | null };
    profileMap.set(record.id, { full_name: record.full_name, phone: record.phone });
  }

  return buildMemberItem(
    updated as unknown as { user_id: string; role: string; status: string; created_at: string },
    profileMap,
    emails,
  );
}

export async function removeMember(
  pharmacyId: string,
  actorId: string,
  targetUserId: string,
  request: Parameters<typeof writeAudit>[0]['request'],
): Promise<void> {
  const supabase = getSupabaseAdmin();

  if (targetUserId === actorId) {
    throw ApiError.badRequest('You cannot remove yourself from the pharmacy.');
  }

  const { data: current, error: fetchError } = await supabase
    .from('pharmacy_memberships')
    .select('role, status')
    .eq('pharmacy_id', pharmacyId)
    .eq('user_id', targetUserId)
    .maybeSingle();
  if (fetchError) {
    throw ApiError.internal(`Unable to load the member: ${fetchError.message}`);
  }
  if (!current) {
    throw ApiError.notFound('Member not found in this pharmacy.');
  }
  const before = current as unknown as { role: string; status: string };

  if (before.role === 'OWNER' && before.status === 'active') {
    await assertNotLastOwner(pharmacyId, targetUserId);
  }

  const { error: deleteError } = await supabase
    .from('pharmacy_memberships')
    .delete()
    .eq('pharmacy_id', pharmacyId)
    .eq('user_id', targetUserId);
  if (deleteError) {
    throw ApiError.internal(`Unable to remove the member: ${deleteError.message}`);
  }

  await writeAudit({
    pharmacyId,
    userId: actorId,
    action: 'member.removed',
    entityType: 'member',
    entityId: targetUserId,
    before,
    request,
  });
}
