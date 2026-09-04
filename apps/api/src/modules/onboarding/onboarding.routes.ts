import { Router } from 'express';
import type { Pharmacy } from '@pharmaguard/types';
import { createPharmacySchema } from '@pharmaguard/validation';
import { requireAuth } from '../../middleware/auth.js';
import { getValidatedBody, validateBody } from '../../middleware/validate.js';
import { getSupabaseAdmin } from '../../database/supabase.js';
import { ApiError } from '../../utils/api-error.js';
import { writeAudit } from '../../utils/audit.js';
import { ok } from '../../utils/respond.js';

/**
 * Onboarding (PRD §7 - New Pharmacy journey, TRD §22 Onboarding).
 * Creates the pharmacy and the OWNER membership atomically through the
 * create_pharmacy_with_membership SECURITY DEFINER RPC.
 *
 * POST /api/v1/onboarding/pharmacy
 */
export const onboardingRouter = Router();

onboardingRouter.post(
  '/pharmacy',
  requireAuth,
  validateBody(createPharmacySchema),
  async (req, res, next) => {
    try {
      if (!req.auth) {
        throw ApiError.unauthorized();
      }
      const input = getValidatedBody(req, createPharmacySchema);

      const { data: pharmacyId, error } = await getSupabaseAdmin()
        .rpc('create_pharmacy_with_membership', {
          // Backend calls with the service-role key, so the RPC cannot resolve
          // auth.uid() itself - the authenticated user id is passed explicitly.
          p_user_id: req.auth.userId,
          p_name: input.name,
          p_owner_name: input.ownerName ?? null,
          p_phone: input.phone ?? null,
          p_email: input.email ?? null,
          p_address: input.address ?? null,
        })
        .single();

      if (error || !pharmacyId) {
        throw ApiError.externalService('Unable to create pharmacy right now');
      }

      const { data: pharmacy, error: fetchError } = await getSupabaseAdmin()
        .from('pharmacies')
        .select('*')
        .eq('id', (pharmacyId as unknown as { id?: string }).id ?? pharmacyId)
        .single();

      if (fetchError || !pharmacy) {
        throw ApiError.internal('Pharmacy created but could not be loaded');
      }

      await writeAudit({
        pharmacyId: pharmacy.id,
        userId: req.auth.userId,
        action: 'pharmacy.created',
        entityType: 'pharmacy',
        entityId: pharmacy.id,
        after: { name: pharmacy.name },
        request: req,
      });

      ok(
        res,
        {
          pharmacy: {
            id: pharmacy.id,
            name: pharmacy.name,
            ownerName: pharmacy.owner_name,
            phone: pharmacy.phone,
            email: pharmacy.email,
            address: pharmacy.address,
            currency: pharmacy.currency,
            createdAt: pharmacy.created_at,
            updatedAt: pharmacy.updated_at,
          } satisfies Pharmacy,
        },
        201,
      );
    } catch (error) {
      next(error);
    }
  },
);
