import { createHash } from 'node:crypto';
import type { Request } from 'express';
import { getEnv } from '../config/env.js';
import { getSupabaseAdmin } from '../database/supabase.js';
import { logger } from './logger.js';

/**
 * Audit logging (FR-031, master spec §27).
 *
 * Audit events are tenant-scoped and protected by RLS; the backend writes
 * them with the service role. Audit failures are logged loudly but do not
 * abort the business operation - audit reliability is revisited with a
 * durable queue in Phase 13 (security hardening).
 */

export interface AuditEntry {
  pharmacyId: string;
  userId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
  request?: Request;
}

/** IPs are hashed (never stored raw) before entering audit metadata. */
export function hashIp(ip: string | undefined): string | null {
  if (!ip) return null;
  const { AUDIT_IP_SALT } = getEnv();
  return createHash('sha256').update(`${ip}:${AUDIT_IP_SALT}`).digest('hex').slice(0, 32);
}

export async function writeAudit(entry: AuditEntry): Promise<void> {
  try {
    const metadata: Record<string, unknown> = {};
    const ipHash = hashIp(entry.request?.ip);
    if (ipHash) metadata.ipHash = ipHash;

    const { error } = await getSupabaseAdmin()
      .from('audit_logs')
      .insert({
        pharmacy_id: entry.pharmacyId,
        user_id: entry.userId ?? null,
        action: entry.action,
        entity_type: entry.entityType,
        entity_id: entry.entityId ?? null,
        before_data: entry.before ?? null,
        after_data: entry.after ?? null,
        metadata,
      });

    if (error) {
      logger.error('audit_write_failed', {
        action: entry.action,
        entityType: entry.entityType,
        supabaseCode: error.code,
      });
    }
  } catch (cause) {
    logger.error('audit_write_exception', {
      action: entry.action,
      entityType: entry.entityType,
      message: cause instanceof Error ? cause.message : 'unknown',
    });
  }
}
