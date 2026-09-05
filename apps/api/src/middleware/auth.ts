import type { NextFunction, Request, Response } from 'express';
import { ACCESS_COOKIE } from '../config/cookies.js';
import { getSupabaseAdmin } from '../database/supabase.js';
import { ApiError } from '../utils/api-error.js';
import { logger } from '../utils/logger.js';
import { verifyAccessToken } from './token-verify.js';
import type { MembershipSummary, RequestAuth } from '../types/request.js';

declare module 'express-serve-static-core' {
  interface Request {
    id?: string;
    auth?: RequestAuth;
    pharmacyId?: string;
    role?: MembershipSummary['role'];
  }
}

export type { RequestAuth, MembershipSummary };

function extractToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ')) {
    return header.slice('Bearer '.length).trim() || null;
  }
  const cookieToken = req.cookies?.[ACCESS_COOKIE];
  return typeof cookieToken === 'string' && cookieToken.length > 0 ? cookieToken : null;
}

async function loadMemberships(userId: string): Promise<MembershipSummary[]> {
  const { data, error } = await getSupabaseAdmin()
    .from('pharmacy_memberships')
    .select('pharmacy_id, role, status, pharmacies(name)')
    .eq('user_id', userId);

  if (error) {
    throw ApiError.internal('Unable to resolve user memberships');
  }

  return (data ?? []).map((row) => {
    const record = row as {
      pharmacy_id: string;
      role: MembershipSummary['role'];
      status: MembershipSummary['status'];
      pharmacies: { name: string } | { name: string }[] | null;
    };
    const pharmacy = Array.isArray(record.pharmacies)
      ? record.pharmacies[0]
      : record.pharmacies;
    return {
      pharmacyId: record.pharmacy_id,
      pharmacyName: pharmacy?.name ?? null,
      role: record.role,
      status: record.status,
    };
  });
}

/**
 * Authentication middleware (master spec §11, TRD §5/§6).
 * Verifies the Supabase access token (cookie or bearer), then loads the
 * user's profile and memberships server-side. The client's claims about
 * identity or tenancy are never trusted.
 */
export async function requireAuth(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const token = extractToken(req);
    if (!token) {
      throw ApiError.unauthorized();
    }

    const payload = await verifyAccessToken(token);

    const { data: profile, error: profileError } = await getSupabaseAdmin()
      .from('profiles')
      .select('id, full_name, phone')
      .eq('id', payload.sub)
      .single();

    if (profileError) {
      // Distinguish a genuinely missing profile (PGRST116: no rows) from an
      // infrastructure fault (missing grants, RLS, network) so the client sees
      // an accurate bootstrap diagnosis instead of a blanket 401.
      if (profileError.code === 'PGRST116') {
        throw ApiError.unauthorized('Account profile not found');
      }
      logger.error('profile_lookup_failed', {
        code: profileError.code,
        message: profileError.message,
      });
      throw ApiError.externalService('Profile service is unavailable');
    }
    if (!profile) {
      throw ApiError.unauthorized('Account profile not found');
    }

    const memberships = await loadMemberships(profile.id);

    req.auth = {
      userId: profile.id,
      email: payload.email ?? '',
      fullName: profile.full_name ?? '',
      phone: profile.phone ?? null,
      memberships,
    };

    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Tenant-context middleware (master spec §11, architecture.md §6).
 * Resolves which pharmacy the request operates on. A client-supplied
 * X-Pharmacy-Id is only honored after it is verified against the user's
 * ACTIVE memberships; otherwise the first active membership is used.
 */
export function resolvePharmacyContext(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  try {
    const auth = req.auth;
    if (!auth) {
      throw ApiError.unauthorized();
    }

    const active = auth.memberships.filter((membership) => membership.status === 'active');
    if (active.length === 0) {
      throw ApiError.forbidden('No active pharmacy membership');
    }

    const requestedId = req.headers['x-pharmacy-id'];
    const requested =
      typeof requestedId === 'string'
        ? active.find((membership) => membership.pharmacyId === requestedId)
        : undefined;

    const context = requested ?? active[0]!;
    req.pharmacyId = context.pharmacyId;
    req.role = context.role;

    next();
  } catch (error) {
    next(error);
  }
}
