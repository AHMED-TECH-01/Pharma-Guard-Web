/**
 * Settings contracts (PRD §10.21). Notification preferences are a small
 * validated JSON document on profiles (migration 0007); appearance stays a
 * browser preference and never leaves the device.
 */

export interface NotificationPrefs {
  /** Critical + high severity alert emails. */
  emailCritical: boolean;
  /** Medium/low severity alert emails. */
  emailWarnings: boolean;
  /** Weekly expiry + stock summary email. */
  weeklyDigest: boolean;
}

export interface PharmacySettings {
  name: string;
  ownerName: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  currency: string;
}
