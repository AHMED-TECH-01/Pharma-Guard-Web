import { describe, expect, it } from 'vitest';
import {
  getPermissionsForRole,
  hasPermission,
  ROLE_PERMISSIONS,
} from '../src/middleware/authorize.js';

describe('role permission model (TRD §6)', () => {
  it('grants OWNER everything', () => {
    expect(hasPermission('OWNER', 'users.manage')).toBe(true);
    expect(hasPermission('OWNER', 'settings.manage')).toBe(true);
    expect(hasPermission('OWNER', 'inventory.write')).toBe(true);
  });

  it('grants MANAGER operational scope but not user/settings management', () => {
    expect(hasPermission('MANAGER', 'inventory.write')).toBe(true);
    expect(hasPermission('MANAGER', 'sales.reverse')).toBe(true);
    expect(hasPermission('MANAGER', 'reports.read')).toBe(true);
    expect(hasPermission('MANAGER', 'users.manage')).toBe(false);
    expect(hasPermission('MANAGER', 'settings.manage')).toBe(false);
  });

  it('grants PHARMACIST inventory/sales/safety scope but not purchases or admin', () => {
    expect(hasPermission('PHARMACIST', 'inventory.write')).toBe(true);
    expect(hasPermission('PHARMACIST', 'sales.create')).toBe(true);
    expect(hasPermission('PHARMACIST', 'expiry.act')).toBe(true);
    expect(hasPermission('PHARMACIST', 'ocr.use')).toBe(true);
    expect(hasPermission('PHARMACIST', 'sales.reverse')).toBe(false);
    expect(hasPermission('PHARMACIST', 'purchases.write')).toBe(false);
    expect(hasPermission('PHARMACIST', 'users.read')).toBe(false);
  });

  it('keeps STAFF read-mostly with sales creation', () => {
    expect(hasPermission('STAFF', 'inventory.read')).toBe(true);
    expect(hasPermission('STAFF', 'sales.create')).toBe(true);
    expect(hasPermission('STAFF', 'inventory.write')).toBe(false);
    expect(hasPermission('STAFF', 'reports.read')).toBe(false);
  });

  it('never matches a partial prefix without the dot boundary', () => {
    // 'sales.create' must not be granted by a hypothetical 'sales' entry,
    // and 'inventoryextra.x' must not match 'inventory.*'.
    expect(hasPermission('MANAGER', 'inventoryextra.read')).toBe(false);
  });

  it('exposes a stable permission list per role', () => {
    expect(getPermissionsForRole('OWNER')).toEqual(['*']);
    expect(ROLE_PERMISSIONS.STAFF.length).toBeGreaterThan(0);
  });
});
