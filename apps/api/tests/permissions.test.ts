import { describe, expect, it } from 'vitest';
import {
  ADMINISTRATIVE_PERMISSIONS,
  getPermissionsForRole,
  hasPermission,
  OPERATIONAL_PERMISSIONS,
  ROLE_PERMISSIONS,
} from '../src/middleware/authorize.js';

describe('role permission model (access model: operational access for every member)', () => {
  it('grants OWNER everything', () => {
    expect(hasPermission('OWNER', 'users.manage')).toBe(true);
    expect(hasPermission('OWNER', 'settings.manage')).toBe(true);
    expect(hasPermission('OWNER', 'inventory.write')).toBe(true);
  });

  it('grants every non-OWNER role the full operational permission set', () => {
    for (const role of ['MANAGER', 'PHARMACIST', 'STAFF'] as const) {
      expect(hasPermission(role, 'inventory.write')).toBe(true);
      expect(hasPermission(role, 'sales.create')).toBe(true);
      expect(hasPermission(role, 'sales.reverse')).toBe(true);
      expect(hasPermission(role, 'purchases.write')).toBe(true);
      expect(hasPermission(role, 'suppliers.write')).toBe(true);
      expect(hasPermission(role, 'returns.write')).toBe(true);
      expect(hasPermission(role, 'reorders.write')).toBe(true);
      expect(hasPermission(role, 'expiry.act')).toBe(true);
      expect(hasPermission(role, 'alerts.act')).toBe(true);
      expect(hasPermission(role, 'quarantine.act')).toBe(true);
      expect(hasPermission(role, 'recalls.write')).toBe(true);
      expect(hasPermission(role, 'ocr.use')).toBe(true);
      expect(hasPermission(role, 'analytics.read')).toBe(true);
      expect(hasPermission(role, 'reports.read')).toBe(true);
      expect(hasPermission(role, 'audit.read')).toBe(true);
      expect(hasPermission(role, 'users.read')).toBe(true);
      expect(hasPermission(role, 'settings.manage')).toBe(true);
    }
  });

  it('keeps user management (users.manage) OWNER-only', () => {
    expect(hasPermission('MANAGER', 'users.manage')).toBe(false);
    expect(hasPermission('PHARMACIST', 'users.manage')).toBe(false);
    expect(hasPermission('STAFF', 'users.manage')).toBe(false);
    expect(ADMINISTRATIVE_PERMISSIONS).toEqual(['users.manage']);
  });

  it('never matches a partial prefix without the dot boundary', () => {
    // 'sales.create' must not be granted by a hypothetical 'sales' entry,
    // and 'inventoryextra.x' must not match 'inventory.*'.
    expect(hasPermission('STAFF', 'inventoryextra.read')).toBe(false);
  });

  it('exposes a concrete permission list per role the frontend can match exactly', () => {
    const ownerPermissions = getPermissionsForRole('OWNER');
    // Wildcards are expanded: the client checks `permissions.includes(...)`.
    expect(ownerPermissions).not.toContain('*');
    expect(ownerPermissions).toContain('users.manage');
    expect(ownerPermissions).toContain('settings.manage');
    expect(ownerPermissions).toContain('inventory.write');

    for (const role of ['MANAGER', 'PHARMACIST', 'STAFF'] as const) {
      const permissions = getPermissionsForRole(role);
      expect(permissions).not.toContain('*');
      expect(permissions).toContain('inventory.write');
      expect(permissions).toContain('users.read');
      expect(permissions).not.toContain('users.manage');
    }
    expect(ROLE_PERMISSIONS.STAFF.length).toBeGreaterThan(0);
  });

  it('keeps the operational set free of administrative capabilities', () => {
    expect(OPERATIONAL_PERMISSIONS).not.toContain('users.manage');
  });
});
