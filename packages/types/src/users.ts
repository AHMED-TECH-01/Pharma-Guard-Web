import type { UserRole } from './enums.js';

/**
 * Team management contracts (PRD §10.21 Settings > Roles, build-plan Phase
 * 12). Roster rows join pharmacy_memberships with basic profile data; emails
 * resolve through the auth admin API and may be unavailable.
 */

export type MemberStatus = 'active' | 'invited' | 'suspended';

export interface MemberListItem {
  userId: string;
  email: string | null;
  fullName: string | null;
  phone: string | null;
  role: UserRole;
  status: MemberStatus;
  joinedAt: string | null;
}

export interface MemberListResponse {
  members: MemberListItem[];
}

export interface InviteMemberResult {
  member: MemberListItem;
  /** Set for brand-new users: a one-time invite link to share manually (no SMTP dependency). */
  inviteLink: string | null;
}

export interface ActivityUserItem {
  userId: string;
  fullName: string;
}
