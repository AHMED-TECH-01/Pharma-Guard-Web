import { describe, expect, it } from 'vitest';
import {
  auditListQuerySchema,
  changePasswordSchema,
  inviteMemberSchema,
  listInventoryBatchesQuerySchema,
  listReturnsQuerySchema,
  notificationPrefsSchema,
  reportQuerySchema,
  updateMemberSchema,
  updatePharmacySchema,
} from '@pharmaguard/validation';

/**
 * Validation contract tests (build-plan Phase 14). These pin the exact
 * server-side rules the UI mirrors, including the Phase 12 admin schemas
 * and the report window bounds from Phase 11.
 */

describe('reportQuerySchema', () => {
  it('defaults to a json preview with no window', () => {
    const result = reportQuerySchema.parse({});
    expect(result.format).toBe('json');
    expect(result.from).toBeUndefined();
    expect(result.to).toBeUndefined();
  });

  it('accepts csv/pdf formats and bounded date windows', () => {
    expect(reportQuerySchema.parse({ format: 'csv' }).format).toBe('csv');
    expect(reportQuerySchema.parse({ format: 'pdf' }).format).toBe('pdf');
    const window = reportQuerySchema.parse({ from: '2026-01-01', to: '2026-01-31' });
    expect(window.from).toBe('2026-01-01');
  });

  it('rejects an inverted window and unknown formats', () => {
    expect(() =>
      reportQuerySchema.parse({ from: '2026-02-01', to: '2026-01-01' }),
    ).toThrow();
    expect(() => reportQuerySchema.parse({ format: 'xlsx' })).toThrow();
    expect(() => reportQuerySchema.parse({ from: '01-2026', to: '02-2026' })).toThrow();
  });
});

describe('inviteMemberSchema', () => {
  it('lowercases the email and accepts non-owner roles', () => {
    const result = inviteMemberSchema.parse({ email: ' Staff@Pharmacy.COM ', role: 'STAFF' });
    expect(result.email).toBe('staff@pharmacy.com');
    expect(result.role).toBe('STAFF');
  });

  it('never allows creating an owner', () => {
    expect(() => inviteMemberSchema.parse({ email: 'a@b.com', role: 'OWNER' })).toThrow();
  });

  it('rejects malformed emails and unknown roles', () => {
    expect(() => inviteMemberSchema.parse({ email: 'not-an-email', role: 'STAFF' })).toThrow();
    expect(() => inviteMemberSchema.parse({ email: 'a@b.com', role: 'ADMIN' })).toThrow();
  });
});

describe('updateMemberSchema', () => {
  it('requires at least one field', () => {
    expect(() => updateMemberSchema.parse({})).toThrow(/Nothing to update/);
  });

  it('accepts role and status changes within the allowed sets', () => {
    expect(updateMemberSchema.parse({ role: 'MANAGER' }).role).toBe('MANAGER');
    expect(updateMemberSchema.parse({ status: 'suspended' }).status).toBe('suspended');
  });

  it('rejects unknown roles and statuses', () => {
    expect(() => updateMemberSchema.parse({ role: 'OWNER ' })).toThrow();
    expect(() => updateMemberSchema.parse({ status: 'blocked' })).toThrow();
  });
});

describe('updatePharmacySchema', () => {
  it('requires a name and allows clearing optional fields with empty strings', () => {
    expect(() => updatePharmacySchema.parse({ name: '' })).toThrow();
    const result = updatePharmacySchema.parse({ name: 'Green Cross', email: '' });
    expect(result.name).toBe('Green Cross');
    expect(result.email).toBe('');
  });

  it('rejects invalid emails', () => {
    expect(() => updatePharmacySchema.parse({ name: 'Green Cross', email: 'nope' })).toThrow();
  });
});

describe('notificationPrefsSchema', () => {
  it('requires all three boolean switches', () => {
    expect(
      notificationPrefsSchema.parse({ emailCritical: true, emailWarnings: false, weeklyDigest: true }),
    ).toEqual({ emailCritical: true, emailWarnings: false, weeklyDigest: true });
    expect(() =>
      notificationPrefsSchema.parse({ emailCritical: true, emailWarnings: false }),
    ).toThrow();
    expect(() =>
      notificationPrefsSchema.parse({ emailCritical: 'yes', emailWarnings: false, weeklyDigest: true }),
    ).toThrow();
  });
});

describe('changePasswordSchema', () => {
  it('enforces length and character classes', () => {
    expect(() => changePasswordSchema.parse({ currentPassword: 'x', newPassword: 'short' })).toThrow();
    expect(() =>
      changePasswordSchema.parse({ currentPassword: 'x', newPassword: 'alllowercase123' }),
    ).toThrow();
    expect(() =>
      changePasswordSchema.parse({ currentPassword: 'x', newPassword: 'NOLOWERCASE123' }),
    ).toThrow();
    expect(() =>
      changePasswordSchema.parse({ currentPassword: 'x', newPassword: 'NoDigitsHere' }),
    ).toThrow();
    expect(
      changePasswordSchema.parse({ currentPassword: 'old', newPassword: 'GoodPass123' }).newPassword,
    ).toBe('GoodPass123');
  });
});

describe('auditListQuerySchema', () => {
  it('caps the page size and rejects bad pages', () => {
    expect(() => auditListQuerySchema.parse({ pageSize: '51' })).toThrow();
    expect(auditListQuerySchema.parse({ pageSize: '50' }).pageSize).toBe(50);
    expect(() => auditListQuerySchema.parse({ page: '0' })).toThrow();
  });
});

describe('listInventoryBatchesQuerySchema', () => {
  it('defaults to every batch sorted by nearest expiry ascending', () => {
    const result = listInventoryBatchesQuerySchema.parse({});
    expect(result.status).toBe('all');
    expect(result.sort).toBe('expiry');
    expect(result.order).toBe('asc');
    expect(result.page).toBe(1);
  });

  it('accepts the reference status filters and sort keys', () => {
    const result = listInventoryBatchesQuerySchema.parse({
      status: 'critical',
      sort: 'quantity',
      order: 'desc',
      search: '  Panadol  ',
    });
    expect(result.status).toBe('critical');
    expect(result.sort).toBe('quantity');
    expect(result.order).toBe('desc');
    expect(result.search).toBe('Panadol');
  });

  it('rejects unknown statuses, sort keys and orders', () => {
    expect(() => listInventoryBatchesQuerySchema.parse({ status: 'quarantined' })).toThrow();
    expect(() => listInventoryBatchesQuerySchema.parse({ sort: 'strength' })).toThrow();
    expect(() => listInventoryBatchesQuerySchema.parse({ order: 'up' })).toThrow();
  });
});

describe('listReturnsQuerySchema', () => {
  it('accepts the reference search box value and trims it', () => {
    const result = listReturnsQuerySchema.parse({ search: '  Amoxicillin  ' });
    expect(result.search).toBe('Amoxicillin');
    expect(result.status).toBeUndefined();
  });

  it('rejects oversized search terms', () => {
    expect(() => listReturnsQuerySchema.parse({ search: 'x'.repeat(121) })).toThrow();
  });
});
