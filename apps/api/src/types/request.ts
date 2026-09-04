import type { MembershipStatus, UserRole } from '@pharmaguard/types';

/** Request-scoped auth context built by the auth middleware. */

export interface MembershipSummary {
  pharmacyId: string;
  pharmacyName: string | null;
  role: UserRole;
  status: MembershipStatus;
}

export interface RequestAuth {
  userId: string;
  email: string;
  fullName: string;
  phone: string | null;
  memberships: MembershipSummary[];
}
