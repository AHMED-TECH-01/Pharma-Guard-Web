-- ############################################################################
-- 0009: authenticated-member access model RLS alignment.
--
-- Product decision: every authenticated user with an ACTIVE pharmacy
-- membership has full access to normal PharmaGuard features; roles no longer
-- gate normal feature READ/CREATE/UPDATE. The API permission layer
-- (apps/api/src/middleware/authorize.ts) was updated to the same model, so
-- these policies only realign the RLS defense-in-depth layer with it.
--
-- What changes here (normal operations, still tenant-isolated):
--   * sales reversal UPDATE: was OWNER/MANAGER/PHARMACIST, now any active
--     member. Reversal is an audited status update (reversed_at/reversed_by)
--     that keeps the sale row - it is not a destructive operation.
--   * pharmacies UPDATE: was OWNER-only, now any active member. Editing the
--     pharmacy profile (name/contact) is a normal settings feature.
--
-- What deliberately does NOT change:
--   * Every table stays RLS-enabled and pharmacy_id-scoped
--     (public.is_active_member) - cross-tenant access remains impossible.
--   * DELETE policies stay OWNER/MANAGER-only (destructive operations).
--   * pharmacy_memberships insert/update/delete stay OWNER-only (managing
--     other people's accounts is administrative).
--   * audit_logs stays append-only (no update/delete policies).
--   * anon/authenticated still hold no table-level grants (0008); the API's
--     service_role remains the only DML path. RLS is the safety net.
-- ############################################################################

-- 1. sales reversal: any active member may record a reversal ------------------
drop policy if exists "sales_update_reversal" on public.sales;
create policy "sales_update_reversal" on public.sales for update
  using (public.is_active_member(pharmacy_id))
  with check (public.is_active_member(pharmacy_id));

-- 2. pharmacy profile: any active member may update pharmacy details ----------
drop policy if exists "pharmacies_update_owner" on public.pharmacies;
create policy "pharmacies_update_members"
  on public.pharmacies for update
  using (public.is_active_member(id))
  with check (public.is_active_member(id));
