import type { NextFunction, Request, Response } from 'express';
import type { UserRole } from '@pharmaguard/types';
import { ApiError } from '../utils/api-error.js';

/**
 * Capability-based authorization (code-standards.md §12, TRD §6).
 * Permissions use `resource.action` form; roles may hold `resource.*` or
 * the global `*` wildcard. Authorization is always enforced server-side.
 *
 * Access model (product decision): every authenticated user with an ACTIVE
 * pharmacy membership receives the full operational permission set regardless
 * of role. Roles remain in the data model only for administrative
 * capabilities (`users.manage` stays OWNER-only) and future administrative
 * features; they no longer gate normal pharmacy features. Tenant isolation
 * (per-pharmacy membership) is enforced independently in auth.ts.
 */
export const PERMISSIONS = {
  inventoryRead: 'inventory.read',
  inventoryWrite: 'inventory.write',
  salesRead: 'sales.read',
  salesCreate: 'sales.create',
  salesReverse: 'sales.reverse',
  purchasesRead: 'purchases.read',
  purchasesWrite: 'purchases.write',
  suppliersRead: 'suppliers.read',
  suppliersWrite: 'suppliers.write',
  returnsRead: 'returns.read',
  returnsWrite: 'returns.write',
  reordersRead: 'reorders.read',
  reordersWrite: 'reorders.write',
  expiryRead: 'expiry.read',
  expiryAct: 'expiry.act',
  alertsRead: 'alerts.read',
  alertsAct: 'alerts.act',
  quarantineRead: 'quarantine.read',
  quarantineAct: 'quarantine.act',
  recallsRead: 'recalls.read',
  recallsWrite: 'recalls.write',
  ocrUse: 'ocr.use',
  analyticsRead: 'analytics.read',
  reportsRead: 'reports.read',
  auditRead: 'audit.read',
  dashboardRead: 'dashboard.read',
  usersRead: 'users.read',
  usersManage: 'users.manage',
  settingsManage: 'settings.manage',
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

/**
 * Normal pharmacy operations granted to EVERY role with an active membership:
 * full read/create/update across all application features plus self-service
 * pharmacy settings. Destructive/system-level capabilities are NOT part of
 * this set.
 */
export const OPERATIONAL_PERMISSIONS: string[] = [
  'dashboard.*',
  'inventory.*',
  'sales.*',
  'purchases.*',
  'suppliers.*',
  'returns.*',
  'reorders.*',
  'expiry.*',
  'alerts.*',
  'quarantine.*',
  'recalls.*',
  'ocr.*',
  'analytics.*',
  'reports.*',
  'audit.read',
  'users.read',
  'settings.manage',
];

/**
 * Administrative capabilities that stay role-restricted. `users.manage`
 * covers actions that affect other people's accounts (invite, role changes,
 * suspension, removal) and therefore is not part of the operational set.
 */
export const ADMINISTRATIVE_PERMISSIONS: string[] = ['users.manage'];

export const ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  OWNER: ['*'],
  MANAGER: [...OPERATIONAL_PERMISSIONS],
  PHARMACIST: [...OPERATIONAL_PERMISSIONS],
  STAFF: [...OPERATIONAL_PERMISSIONS],
};

/** Every concrete permission (used to expand wildcards for the client). */
const ALL_PERMISSIONS: string[] = Object.values(PERMISSIONS);

/** True when the role's permission list grants `permission` (wildcard-aware). */
export function hasPermission(role: UserRole, permission: string): boolean {
  const granted = ROLE_PERMISSIONS[role] ?? [];
  return granted.some((entry) => {
    if (entry === '*') return true;
    if (entry.endsWith('.*')) {
      const prefix = entry.slice(0, -1); // keep trailing dot: 'inventory.'
      return permission.startsWith(prefix);
    }
    return entry === permission;
  });
}

/**
 * Concrete permission list sent to the client (GET /auth/me). Wildcards are
 * expanded to exact `resource.action` strings for EVERY role because the
 * frontend matches exact permission strings - an OWNER holding ['*'] and a
 * STAFF holding ['inventory.*', ...] must both surface `includes(...)`
 * results that mirror what the API will actually authorize.
 */
export function getPermissionsForRole(role: UserRole): string[] {
  const expanded = new Set<string>();
  for (const entry of ROLE_PERMISSIONS[role] ?? []) {
    if (entry === '*') {
      for (const permission of ALL_PERMISSIONS) expanded.add(permission);
      continue;
    }
    if (entry.endsWith('.*')) {
      const prefix = entry.slice(0, -1); // keep trailing dot: 'inventory.'
      for (const permission of ALL_PERMISSIONS) {
        if (permission.startsWith(prefix)) expanded.add(permission);
      }
      continue;
    }
    expanded.add(entry);
  }
  return [...expanded];
}

/**
 * Route-level authorization factory. Must run after requireAuth +
 * resolvePharmacyContext so req.role reflects the verified membership role.
 */
export function requirePermission(permission: Permission) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      if (!req.role) {
        throw ApiError.forbidden('No pharmacy context on request');
      }
      if (!hasPermission(req.role, permission)) {
        throw ApiError.forbidden('You do not have permission to perform this action');
      }
      next();
    } catch (error) {
      next(error);
    }
  };
}
