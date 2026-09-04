import { z } from 'zod';

/** Team management validation (PRD §10.21, build-plan Phase 12). */

export const MEMBER_ROLES = ['OWNER', 'MANAGER', 'PHARMACIST', 'STAFF'] as const;
export const MEMBER_STATUSES = ['active', 'suspended'] as const;

export const inviteMemberSchema = z.object({
  email: z.string().trim().toLowerCase().email('A valid email is required'),
  role: z.enum(MEMBER_ROLES).refine((role) => role !== 'OWNER', {
    message: 'New members cannot be invited as OWNER',
  }),
});

export type InviteMemberInput = z.infer<typeof inviteMemberSchema>;

export const updateMemberSchema = z
  .object({
    role: z.enum(MEMBER_ROLES).optional(),
    status: z.enum(MEMBER_STATUSES).optional(),
  })
  .refine((input) => input.role !== undefined || input.status !== undefined, {
    message: 'Nothing to update',
  });

export type UpdateMemberInput = z.infer<typeof updateMemberSchema>;
