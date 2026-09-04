import type { NextFunction, Request, Response } from 'express';
import type { UserRole } from '@pharmaguard/types';
import { ApiError } from '../utils/api-error.js';

/**
 * Capability-based authorization (code-standards.md §12, TRD §6).
 * Permissions use `resource.action` form; roles may hold `resource.*` or
 * the global `*` wildcard. Authorization is always enforced server-side.
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

const MANAGER_PERMISSIONS: string[] = [
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
];

const PHARMACIST_PERMISSIONS: string[] = [
  'dashboard.read',
  'inventory.read',
  'inventory.write',
  'sales.read',
  'sales.create',
  'expiry.*',
  'alerts.*',
  'quarantine.*',
  'returns.read',
  'returns.write',
  'reorders.read',
  'ocr.use',
];

const STAFF_PERMISSIONS: string[] = [
  'dashboard.read',
  'inventory.read',
  'sales.create',
  'alerts.read',
];

export const ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  OWNER: ['*'],
  MANAGER: MANAGER_PERMISSIONS,
  PHARMACIST: PHARMACIST_PERMISSIONS,
  STAFF: STAFF_PERMISSIONS,
};

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

export function getPermissionsForRole(role: UserRole): string[] {
  if (role === 'OWNER') return ['*'];
  return [...(ROLE_PERMISSIONS[role] ?? [])];
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
