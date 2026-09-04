-- =============================================================================
-- PharmaGuard migration 0002: Row Level Security
-- (architecture.md §7 - RLS is mandatory on every application table)
--
-- Model: a row is visible/writable only when the caller has an ACTIVE
-- membership in the row's pharmacy. Role-restricted destructive operations
-- add a role check. Backend authorization remains mandatory even with RLS
-- (defense in depth, architecture.md principle 5).
--
-- audit_logs intentionally has NO update/delete policies: audit history is
-- immutable through the API paths (TRD §29 - audit data is not casually
-- deleted).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Helpers (SECURITY DEFINER so policies avoid recursive RLS on memberships)
-- -----------------------------------------------------------------------------

create or replace function public.is_active_member(p_pharmacy_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.pharmacy_memberships pm
    where pm.pharmacy_id = p_pharmacy_id
      and pm.user_id = auth.uid()
      and pm.status = 'active'
  );
$$;

create or replace function public.has_any_role(p_pharmacy_id uuid, p_roles text[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.pharmacy_memberships pm
    where pm.pharmacy_id = p_pharmacy_id
      and pm.user_id = auth.uid()
      and pm.status = 'active'
      and pm.role = any (p_roles)
  );
$$;

-- -----------------------------------------------------------------------------
-- profiles: users read/update their own profile; members of a shared pharmacy
-- can read each other's basic profile (needed for the Users page).
-- -----------------------------------------------------------------------------
alter table public.profiles enable row level security;

create policy "profiles_select_self_or_pharmacy_peers"
  on public.profiles for select
  using (
    id = auth.uid()
    or exists (
      select 1
      from public.pharmacy_memberships mine
      join public.pharmacy_memberships theirs
        on theirs.pharmacy_id = mine.pharmacy_id
      where mine.user_id = auth.uid()
        and mine.status = 'active'
        and theirs.user_id = profiles.id
    )
  );

create policy "profiles_update_self"
  on public.profiles for update
  using (id = auth.uid())
  with check (id = auth.uid());

-- profiles are inserted only by the handle_new_user trigger (security definer).

-- -----------------------------------------------------------------------------
-- pharmacies: members read; OWNER updates; creation/deletion flow through
-- the SECURITY DEFINER RPC and backend (no direct member insert/delete).
-- -----------------------------------------------------------------------------
alter table public.pharmacies enable row level security;

create policy "pharmacies_select_members"
  on public.pharmacies for select
  using (public.is_active_member(id));

create policy "pharmacies_update_owner"
  on public.pharmacies for update
  using (public.has_any_role(id, array['OWNER']::text[]))
  with check (public.has_any_role(id, array['OWNER']::text[]));

-- -----------------------------------------------------------------------------
-- pharmacy_memberships: members read rosters; OWNER manages.
-- -----------------------------------------------------------------------------
alter table public.pharmacy_memberships enable row level security;

create policy "memberships_select_members"
  on public.pharmacy_memberships for select
  using (
    user_id = auth.uid()
    or public.is_active_member(pharmacy_id)
  );

create policy "memberships_insert_owner"
  on public.pharmacy_memberships for insert
  with check (public.has_any_role(pharmacy_id, array['OWNER']::text[]));

create policy "memberships_update_owner"
  on public.pharmacy_memberships for update
  using (public.has_any_role(pharmacy_id, array['OWNER']::text[]))
  with check (public.has_any_role(pharmacy_id, array['OWNER']::text[]));

create policy "memberships_delete_owner"
  on public.pharmacy_memberships for delete
  using (public.has_any_role(pharmacy_id, array['OWNER']::text[]));

-- -----------------------------------------------------------------------------
-- Standard pharmacy-scoped tables: full CRUD for active members, with
-- destructive operations (delete) limited to OWNER/MANAGER.
-- -----------------------------------------------------------------------------
alter table public.medicines enable row level security;
create policy "medicines_select" on public.medicines for select
  using (public.is_active_member(pharmacy_id));
create policy "medicines_insert" on public.medicines for insert
  with check (public.is_active_member(pharmacy_id));
create policy "medicines_update" on public.medicines for update
  using (public.is_active_member(pharmacy_id))
  with check (public.is_active_member(pharmacy_id));
create policy "medicines_delete" on public.medicines for delete
  using (public.has_any_role(pharmacy_id, array['OWNER', 'MANAGER']::text[]));

alter table public.suppliers enable row level security;
create policy "suppliers_select" on public.suppliers for select
  using (public.is_active_member(pharmacy_id));
create policy "suppliers_insert" on public.suppliers for insert
  with check (public.is_active_member(pharmacy_id));
create policy "suppliers_update" on public.suppliers for update
  using (public.is_active_member(pharmacy_id))
  with check (public.is_active_member(pharmacy_id));
create policy "suppliers_delete" on public.suppliers for delete
  using (public.has_any_role(pharmacy_id, array['OWNER', 'MANAGER']::text[]));

alter table public.batches enable row level security;
create policy "batches_select" on public.batches for select
  using (public.is_active_member(pharmacy_id));
create policy "batches_insert" on public.batches for insert
  with check (public.is_active_member(pharmacy_id));
create policy "batches_update" on public.batches for update
  using (public.is_active_member(pharmacy_id))
  with check (public.is_active_member(pharmacy_id));
create policy "batches_delete" on public.batches for delete
  using (public.has_any_role(pharmacy_id, array['OWNER', 'MANAGER']::text[]));

-- -----------------------------------------------------------------------------
-- sales: members read/insert; reversal is an UPDATE (no delete, no direct
-- update except reversal fields - backend enforces semantics).
-- -----------------------------------------------------------------------------
alter table public.sales enable row level security;
create policy "sales_select" on public.sales for select
  using (public.is_active_member(pharmacy_id));
create policy "sales_insert" on public.sales for insert
  with check (
    public.is_active_member(pharmacy_id)
    and user_id = auth.uid()
  );
create policy "sales_update_reversal" on public.sales for update
  using (public.has_any_role(pharmacy_id, array['OWNER', 'MANAGER', 'PHARMACIST']::text[]))
  with check (public.is_active_member(pharmacy_id));

-- -----------------------------------------------------------------------------
-- purchases + purchase_items
-- -----------------------------------------------------------------------------
alter table public.purchases enable row level security;
create policy "purchases_select" on public.purchases for select
  using (public.is_active_member(pharmacy_id));
create policy "purchases_insert" on public.purchases for insert
  with check (
    public.is_active_member(pharmacy_id)
    and created_by = auth.uid()
  );
create policy "purchases_update" on public.purchases for update
  using (public.has_any_role(pharmacy_id, array['OWNER', 'MANAGER']::text[]))
  with check (public.is_active_member(pharmacy_id));
create policy "purchases_delete" on public.purchases for delete
  using (public.has_any_role(pharmacy_id, array['OWNER', 'MANAGER']::text[]));

alter table public.purchase_items enable row level security;
create policy "purchase_items_select" on public.purchase_items for select
  using (public.is_active_member((select p.pharmacy_id from public.purchases p where p.id = purchase_id)));
create policy "purchase_items_insert" on public.purchase_items for insert
  with check (public.is_active_member((select p.pharmacy_id from public.purchases p where p.id = purchase_id)));
create policy "purchase_items_delete" on public.purchase_items for delete
  using (public.has_any_role((select p.pharmacy_id from public.purchases p where p.id = purchase_id), array['OWNER', 'MANAGER']::text[]));

-- -----------------------------------------------------------------------------
-- alerts: members read; lifecycle transitions are updates; no member delete.
-- -----------------------------------------------------------------------------
alter table public.alerts enable row level security;
create policy "alerts_select" on public.alerts for select
  using (public.is_active_member(pharmacy_id));
create policy "alerts_insert" on public.alerts for insert
  with check (public.is_active_member(pharmacy_id));
create policy "alerts_update" on public.alerts for update
  using (public.is_active_member(pharmacy_id))
  with check (public.is_active_member(pharmacy_id));

-- -----------------------------------------------------------------------------
-- recalls
-- -----------------------------------------------------------------------------
alter table public.recalls enable row level security;
create policy "recalls_select" on public.recalls for select
  using (public.is_active_member(pharmacy_id));
create policy "recalls_insert" on public.recalls for insert
  with check (public.is_active_member(pharmacy_id));
create policy "recalls_update" on public.recalls for update
  using (public.is_active_member(pharmacy_id))
  with check (public.is_active_member(pharmacy_id));
create policy "recalls_delete" on public.recalls for delete
  using (public.has_any_role(pharmacy_id, array['OWNER', 'MANAGER']::text[]));

-- -----------------------------------------------------------------------------
-- quarantine_items
-- -----------------------------------------------------------------------------
alter table public.quarantine_items enable row level security;
create policy "quarantine_select" on public.quarantine_items for select
  using (public.is_active_member(pharmacy_id));
create policy "quarantine_insert" on public.quarantine_items for insert
  with check (
    public.is_active_member(pharmacy_id)
    and created_by = auth.uid()
  );
create policy "quarantine_update" on public.quarantine_items for update
  using (public.is_active_member(pharmacy_id))
  with check (public.is_active_member(pharmacy_id));
create policy "quarantine_delete" on public.quarantine_items for delete
  using (public.has_any_role(pharmacy_id, array['OWNER', 'MANAGER']::text[]));

-- -----------------------------------------------------------------------------
-- returns
-- -----------------------------------------------------------------------------
alter table public.returns enable row level security;
create policy "returns_select" on public.returns for select
  using (public.is_active_member(pharmacy_id));
create policy "returns_insert" on public.returns for insert
  with check (
    public.is_active_member(pharmacy_id)
    and created_by = auth.uid()
  );
create policy "returns_update" on public.returns for update
  using (public.is_active_member(pharmacy_id))
  with check (public.is_active_member(pharmacy_id));
create policy "returns_delete" on public.returns for delete
  using (public.has_any_role(pharmacy_id, array['OWNER', 'MANAGER']::text[]));

-- -----------------------------------------------------------------------------
-- audit_logs: read for members, insert restricted to self; immutable.
-- -----------------------------------------------------------------------------
alter table public.audit_logs enable row level security;
create policy "audit_select" on public.audit_logs for select
  using (public.is_active_member(pharmacy_id));
create policy "audit_insert" on public.audit_logs for insert
  with check (
    public.is_active_member(pharmacy_id)
    and user_id = auth.uid()
  );

-- -----------------------------------------------------------------------------
-- ocr_scans: members read; users insert their own scans; no member delete
-- (discard is a status transition).
-- -----------------------------------------------------------------------------
alter table public.ocr_scans enable row level security;
create policy "ocr_select" on public.ocr_scans for select
  using (public.is_active_member(pharmacy_id));
create policy "ocr_insert" on public.ocr_scans for insert
  with check (
    public.is_active_member(pharmacy_id)
    and user_id = auth.uid()
  );
create policy "ocr_update" on public.ocr_scans for update
  using (public.is_active_member(pharmacy_id))
  with check (public.is_active_member(pharmacy_id));

-- -----------------------------------------------------------------------------
-- subscriptions: members read; writes flow through the backend service role
-- only (TRD §32 - plan enforcement is server-side).
-- -----------------------------------------------------------------------------
alter table public.subscriptions enable row level security;
create policy "subscriptions_select" on public.subscriptions for select
  using (public.is_active_member(pharmacy_id));
