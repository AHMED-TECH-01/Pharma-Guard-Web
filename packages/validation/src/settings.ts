import { z } from 'zod';

/** Settings validation (PRD §10.21). Shapes mirror the type contracts. */

export const updateProfileSchema = z.object({
  fullName: z.string().trim().min(1, 'Name is required').max(120),
  phone: z.string().trim().max(40).optional().or(z.literal('')),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

export const updatePharmacySchema = z.object({
  name: z.string().trim().min(2).max(255),
  ownerName: z.string().trim().max(255).optional().or(z.literal('')),
  phone: z.string().trim().max(40).optional().or(z.literal('')),
  email: z.string().trim().email('A valid email is required').optional().or(z.literal('')),
  address: z.string().trim().max(500).optional().or(z.literal('')),
});

export type UpdatePharmacyInput = z.infer<typeof updatePharmacySchema>;

export const notificationPrefsSchema = z.object({
  emailCritical: z.boolean(),
  emailWarnings: z.boolean(),
  weeklyDigest: z.boolean(),
});

export type NotificationPrefsInput = z.infer<typeof notificationPrefsSchema>;

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z
    .string()
    .min(10, 'Use at least 10 characters')
    .max(128)
    .regex(/[a-z]/, 'Include a lowercase letter')
    .regex(/[A-Z]/, 'Include an uppercase letter')
    .regex(/[0-9]/, 'Include a number'),
});

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
