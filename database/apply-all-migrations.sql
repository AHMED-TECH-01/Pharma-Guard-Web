-- =============================================================================
-- PharmaGuard - combined migrations 0001-0007 (apply in one SQL Editor run).
-- Idempotent DDL; safe to re-run. Regenerated 04 Sep 2026 (restored 0003).
-- =============================================================================

-- ######################## 0001_core_schema.sql ########################
-- =============================================================================
-- PharmaGuard migration 0001: Core schema
-- Platform: Supabase PostgreSQL (TRD §3, architecture.md §6)
--
-- Tenant model: every application row is scoped by pharmacy_id and reached
-- through pharmacy_memberships (auth.users -> profiles -> memberships ->
-- pharmacy-owned tables). Credentials never live in public tables; Supabase
-- Auth owns auth.users.
--
-- Conventions:
--   * uuid primary keys (gen_random_uuid)
--   * timestamptz timestamps, default now()
--   * numeric(12,2) money columns with >= 0 checks
--   * explicit FK actions (cascade for tenant-owned children, set null for
--     optional references)
--   * status columns constrained with CHECKs matching @pharmaguard/types
-- =============================================================================

-- ----------------------------------------------------------------------------
-- profiles: application data for auth.users
-- ----------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '',
  phone text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- pharmacies: tenant root
-- ----------------------------------------------------------------------------
create table if not exists public.pharmacies (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 255),
  owner_name text,
  phone text,
  email text,
  address text,
  currency text not null default 'PKR',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- pharmacy_memberships: tenant authorization source of truth
-- ----------------------------------------------------------------------------
create table if not exists public.pharmacy_memberships (
  id uuid primary key default gen_random_uuid(),
  pharmacy_id uuid not null references public.pharmacies (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('OWNER', 'MANAGER', 'PHARMACIST', 'STAFF')),
  status text not null default 'active' check (status in ('active', 'invited', 'suspended')),
  invited_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (pharmacy_id, user_id)
);

create index if not exists idx_memberships_user
  on public.pharmacy_memberships (user_id);

create index if not exists idx_memberships_pharmacy_status
  on public.pharmacy_memberships (pharmacy_id, status);

-- ----------------------------------------------------------------------------
-- suppliers
-- ----------------------------------------------------------------------------
create table if not exists public.suppliers (
  id uuid primary key default gen_random_uuid(),
  pharmacy_id uuid not null references public.pharmacies (id) on delete cascade,
  name text not null check (char_length(name) between 2 and 255),
  phone text,
  email text,
  address text,
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_suppliers_pharmacy
  on public.suppliers (pharmacy_id);

-- ----------------------------------------------------------------------------
-- medicines
-- ----------------------------------------------------------------------------
create table if not exists public.medicines (
  id uuid primary key default gen_random_uuid(),
  pharmacy_id uuid not null references public.pharmacies (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 255),
  generic_name text,
  strength text,
  dosage_form text,
  manufacturer text,
  barcode text,
  category text,
  reorder_level numeric(12, 2) not null default 0 check (reorder_level >= 0),
  safety_stock numeric(12, 2) not null default 0 check (safety_stock >= 0),
  purchase_price numeric(12, 2) check (purchase_price >= 0),
  selling_price numeric(12, 2) check (selling_price >= 0),
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_medicines_pharmacy
  on public.medicines (pharmacy_id);

create index if not exists idx_medicines_pharmacy_name
  on public.medicines (pharmacy_id, name);

create index if not exists idx_medicines_pharmacy_barcode
  on public.medicines (pharmacy_id, barcode);

-- ----------------------------------------------------------------------------
-- batches: batch-level inventory truth
-- ----------------------------------------------------------------------------
create table if not exists public.batches (
  id uuid primary key default gen_random_uuid(),
  medicine_id uuid not null references public.medicines (id) on delete cascade,
  pharmacy_id uuid not null references public.pharmacies (id) on delete cascade,
  batch_no text not null check (char_length(batch_no) between 1 and 100),
  manufacturing_date date,
  expiry_date date not null,
  quantity integer not null default 0 check (quantity >= 0),
  received_date date,
  purchase_price numeric(12, 2) check (purchase_price >= 0),
  supplier_id uuid references public.suppliers (id) on delete set null,
  status text not null default 'AVAILABLE'
    check (status in ('AVAILABLE', 'QUARANTINED', 'RETURNED', 'REMOVED', 'ARCHIVED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (pharmacy_id, medicine_id, batch_no)
);

create index if not exists idx_batches_pharmacy_expiry
  on public.batches (pharmacy_id, expiry_date);

create index if not exists idx_batches_pharmacy_medicine
  on public.batches (pharmacy_id, medicine_id);

create index if not exists idx_batches_pharmacy_status
  on public.batches (pharmacy_id, status);

-- ----------------------------------------------------------------------------
-- sales (immutable rows; reversals are recorded via reversed_at/reversed_by)
-- ----------------------------------------------------------------------------
create table if not exists public.sales (
  id uuid primary key default gen_random_uuid(),
  pharmacy_id uuid not null references public.pharmacies (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete restrict,
  medicine_id uuid not null references public.medicines (id) on delete restrict,
  batch_id uuid not null references public.batches (id) on delete restrict,
  quantity integer not null check (quantity > 0),
  unit_price numeric(12, 2) not null check (unit_price >= 0),
  total_amount numeric(12, 2) not null check (total_amount >= 0),
  sold_at timestamptz not null default now(),
  note text,
  reversed_at timestamptz,
  reversed_by uuid references auth.users (id) on delete set null
);

create index if not exists idx_sales_pharmacy_sold_at
  on public.sales (pharmacy_id, sold_at desc);

create index if not exists idx_sales_medicine_sold_at
  on public.sales (medicine_id, sold_at desc);

-- ----------------------------------------------------------------------------
-- purchases + purchase_items
-- ----------------------------------------------------------------------------
create table if not exists public.purchases (
  id uuid primary key default gen_random_uuid(),
  pharmacy_id uuid not null references public.pharmacies (id) on delete cascade,
  supplier_id uuid references public.suppliers (id) on delete set null,
  invoice_no text,
  received_at timestamptz not null default now(),
  created_by uuid not null references auth.users (id) on delete restrict,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists idx_purchases_pharmacy_received
  on public.purchases (pharmacy_id, received_at desc);

create table if not exists public.purchase_items (
  id uuid primary key default gen_random_uuid(),
  purchase_id uuid not null references public.purchases (id) on delete cascade,
  medicine_id uuid not null references public.medicines (id) on delete restrict,
  batch_id uuid not null references public.batches (id) on delete restrict,
  quantity integer not null check (quantity > 0),
  unit_cost numeric(12, 2) not null check (unit_cost >= 0)
);

create index if not exists idx_purchase_items_purchase
  on public.purchase_items (purchase_id);

-- ----------------------------------------------------------------------------
-- alerts (FR-022/FR-023; includes OVERSTOCK per SRD superset)
-- ----------------------------------------------------------------------------
create table if not exists public.alerts (
  id uuid primary key default gen_random_uuid(),
  pharmacy_id uuid not null references public.pharmacies (id) on delete cascade,
  medicine_id uuid references public.medicines (id) on delete cascade,
  batch_id uuid references public.batches (id) on delete cascade,
  type text not null check (type in (
    'EXPIRED', 'EXPIRING', 'LOW_STOCK', 'STOCKOUT_RISK', 'DEAD_STOCK',
    'OVERSTOCK', 'RECALL', 'QUARANTINE', 'OCR_REVIEW'
  )),
  severity text not null check (severity in ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW')),
  title text not null check (char_length(title) between 1 and 255),
  message text not null,
  status text not null default 'NEW' check (status in ('NEW', 'READ', 'SNOOZED', 'RESOLVED')),
  snoozed_until timestamptz,
  resolved_at timestamptz,
  resolved_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_alerts_pharmacy_status_created
  on public.alerts (pharmacy_id, status, created_at desc);

-- ----------------------------------------------------------------------------
-- recalls (FR-024)
-- ----------------------------------------------------------------------------
create table if not exists public.recalls (
  id uuid primary key default gen_random_uuid(),
  pharmacy_id uuid not null references public.pharmacies (id) on delete cascade,
  medicine_id uuid references public.medicines (id) on delete set null,
  batch_no text,
  manufacturer text,
  reason text,
  status text not null default 'OPEN'
    check (status in ('OPEN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED')),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_recalls_pharmacy
  on public.recalls (pharmacy_id, status);

-- ----------------------------------------------------------------------------
-- quarantine_items (FR-025)
-- ----------------------------------------------------------------------------
create table if not exists public.quarantine_items (
  id uuid primary key default gen_random_uuid(),
  pharmacy_id uuid not null references public.pharmacies (id) on delete cascade,
  batch_id uuid not null references public.batches (id) on delete cascade,
  quantity integer not null check (quantity > 0),
  reason text not null,
  status text not null default 'QUARANTINED'
    check (status in ('QUARANTINED', 'RELEASED', 'RETURNED', 'REMOVED')),
  created_by uuid not null references auth.users (id) on delete restrict,
  resolved_by uuid references auth.users (id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_quarantine_pharmacy_status
  on public.quarantine_items (pharmacy_id, status);

-- ----------------------------------------------------------------------------
-- returns (FR-026; SRD §7 state machine Pending -> Approved/Rejected -> Completed)
-- ----------------------------------------------------------------------------
create table if not exists public.returns (
  id uuid primary key default gen_random_uuid(),
  pharmacy_id uuid not null references public.pharmacies (id) on delete cascade,
  supplier_id uuid references public.suppliers (id) on delete set null,
  batch_id uuid not null references public.batches (id) on delete restrict,
  quantity integer not null check (quantity > 0),
  reason text not null check (reason in ('EXPIRED', 'DAMAGED', 'RECALL', 'INCORRECT_SHIPMENT', 'OTHER')),
  status text not null default 'PENDING'
    check (status in ('PENDING', 'APPROVED', 'COMPLETED', 'REJECTED')),
  notes text,
  return_date date,
  created_by uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_returns_pharmacy_status
  on public.returns (pharmacy_id, status);

-- ----------------------------------------------------------------------------
-- audit_logs (FR-031): append-only; no UPDATE/DELETE policies exist by design
-- ----------------------------------------------------------------------------
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  pharmacy_id uuid not null references public.pharmacies (id) on delete cascade,
  user_id uuid references auth.users (id) on delete set null,
  action text not null check (char_length(action) between 1 and 100),
  entity_type text not null check (char_length(entity_type) between 1 and 100),
  entity_id uuid,
  before_data jsonb,
  after_data jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_audit_logs_pharmacy_created
  on public.audit_logs (pharmacy_id, created_at desc);

-- ----------------------------------------------------------------------------
-- ocr_scans (TRD §3; AI results are unverified until user confirmation)
-- ----------------------------------------------------------------------------
create table if not exists public.ocr_scans (
  id uuid primary key default gen_random_uuid(),
  pharmacy_id uuid not null references public.pharmacies (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete restrict,
  file_reference text,
  storage_path text,
  extracted_data jsonb,
  confidence numeric(5, 2),
  status text not null default 'PROCESSING'
    check (status in ('PROCESSING', 'COMPLETED', 'FAILED', 'CONFIRMED', 'DISCARDED')),
  error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_ocr_scans_pharmacy_created
  on public.ocr_scans (pharmacy_id, created_at desc);

-- ----------------------------------------------------------------------------
-- subscriptions: stored separately from pharmacy data, enforced server-side
-- (TRD §32). No direct member write policies - service role only.
-- ----------------------------------------------------------------------------
create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  pharmacy_id uuid not null references public.pharmacies (id) on delete cascade,
  plan text not null check (plan in ('STARTER', 'PROFESSIONAL', 'PREMIUM', 'ENTERPRISE')),
  status text not null default 'ACTIVE'
    check (status in ('TRIALING', 'ACTIVE', 'PAST_DUE', 'CANCELLED')),
  current_period_start timestamptz,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_subscriptions_pharmacy
  on public.subscriptions (pharmacy_id);


-- ######################## 0002_rls.sql ########################
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


-- ######################## 0003_functions_triggers.sql ########################
-- =============================================================================
-- PharmaGuard migration 0003: Identity trigger + onboarding RPC
-- (architecture.md §6 - auth.users -> profiles mirror; PRD §7 onboarding)
--
-- handle_new_user: every auth.users signup gets a matching public.profiles
-- row. SECURITY DEFINER because profiles intentionally have no direct insert
-- policy (0002_rls.sql) - the trigger is the only writer. Signup metadata
-- contract comes from apps/api auth.service.ts ({ full_name, phone });
-- OAuth providers are normalized by GoTrue to full_name/avatar_url.
--
-- create_pharmacy_with_membership: onboarding creates the tenant and the
-- OWNER membership in one atomic statement. The backend calls it with the
-- service-role key, so the RPC cannot resolve auth.uid() itself - the
-- authenticated user id is passed explicitly (same convention as create_sale).
-- The API layer owns permission checks and audit entries.
-- =============================================================================

-- ----------------------------------------------------------------------------
-- handle_new_user: mirror auth.users -> public.profiles
-- ----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, phone, avatar_url)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name',
      ''
    ),
    nullif(new.raw_user_meta_data ->> 'phone', ''),
    nullif(new.raw_user_meta_data ->> 'avatar_url', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute procedure public.handle_new_user();

-- ----------------------------------------------------------------------------
-- create_pharmacy_with_membership: new-pharmacy onboarding RPC
-- Called by POST /api/v1/onboarding/pharmacy (createPharmacySchema already
-- trims/validates the body). Returns the new pharmacy id.
-- ----------------------------------------------------------------------------
create or replace function public.create_pharmacy_with_membership(
  p_user_id uuid,
  p_name text,
  p_owner_name text default null,
  p_phone text default null,
  p_email text default null,
  p_address text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pharmacy_id uuid;
begin
  if p_user_id is null then
    raise exception 'AUTH_REQUIRED';
  end if;
  if p_name is null or char_length(btrim(p_name)) < 2 or char_length(btrim(p_name)) > 255 then
    raise exception 'PHARMACY_NAME_INVALID';
  end if;

  insert into public.pharmacies (name, owner_name, phone, email, address)
  values (btrim(p_name), p_owner_name, p_phone, p_email, p_address)
  returning id into v_pharmacy_id;

  insert into public.pharmacy_memberships (pharmacy_id, user_id, role, status)
  values (v_pharmacy_id, p_user_id, 'OWNER', 'active');

  return v_pharmacy_id;
end;
$$;

revoke all on function public.create_pharmacy_with_membership(uuid, text, text, text, text, text)
  from public, anon, authenticated;


-- ######################## 0004_sales_functions.sql ########################
-- =============================================================================
-- PharmaGuard migration 0004: Sales transaction functions (TRD §13)
-- Atomic sale creation (row lock -> verify -> decrement -> insert) and
-- reversal (restore stock, stamp reversed_at/by). SECURITY DEFINER so the
-- pair is atomic; the API layer owns permission checks and audit entries.
-- =============================================================================

create or replace function public.create_sale(
  p_pharmacy_id uuid,
  p_user_id uuid,
  p_batch_id uuid,
  p_quantity integer,
  p_unit_price numeric,
  p_note text default null,
  p_sold_at timestamptz default null
)
returns public.sales
language plpgsql
security definer
set search_path = public
as $$
declare
  v_batch public.batches%rowtype;
  v_sale public.sales%rowtype;
begin
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'QUANTITY_INVALID';
  end if;
  if p_unit_price is null or p_unit_price < 0 then
    raise exception 'PRICE_INVALID';
  end if;

  select * into v_batch
  from public.batches
  where id = p_batch_id and pharmacy_id = p_pharmacy_id
  for update;
  if not found then
    raise exception 'BATCH_NOT_FOUND';
  end if;
  if v_batch.status <> 'AVAILABLE' then
    raise exception 'BATCH_NOT_AVAILABLE';
  end if;
  if v_batch.quantity < p_quantity then
    raise exception 'INSUFFICIENT_STOCK';
  end if;

  update public.batches
  set quantity = quantity - p_quantity, updated_at = now()
  where id = v_batch.id;

  insert into public.sales (
    pharmacy_id, user_id, medicine_id, batch_id,
    quantity, unit_price, total_amount, sold_at, note
  )
  values (
    p_pharmacy_id, p_user_id, v_batch.medicine_id, v_batch.id,
    p_quantity, p_unit_price, round(p_unit_price * p_quantity, 2),
    coalesce(p_sold_at, now()), p_note
  )
  returning * into v_sale;

  return v_sale;
end;
$$;

create or replace function public.reverse_sale(
  p_pharmacy_id uuid,
  p_sale_id uuid,
  p_user_id uuid
)
returns public.sales
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sale public.sales%rowtype;
begin
  select * into v_sale
  from public.sales
  where id = p_sale_id and pharmacy_id = p_pharmacy_id
  for update;
  if not found then
    raise exception 'SALE_NOT_FOUND';
  end if;
  if v_sale.reversed_at is not null then
    raise exception 'SALE_ALREADY_REVERSED';
  end if;

  -- Stock returns to the batch in its current status: if the batch was
  -- quarantined after the sale, the units exist but stay unsellable.
  update public.batches
  set quantity = quantity + v_sale.quantity, updated_at = now()
  where id = v_sale.batch_id;

  update public.sales
  set reversed_at = now(), reversed_by = p_user_id
  where id = v_sale.id
  returning * into v_sale;

  return v_sale;
end;
$$;

revoke all on function public.create_sale(uuid, uuid, uuid, integer, numeric, text, timestamptz)
  from public, anon, authenticated;
revoke all on function public.reverse_sale(uuid, uuid, uuid)
  from public, anon, authenticated;


-- ######################## 0005_purchase_functions.sql ########################
-- =============================================================================
-- PharmaGuard migration 0005: Purchase receiving function (TRD §13 Purchase)
-- Atomic receiving: create purchase header, then per item either lock and
-- increment an existing batch or create a new batch, and write purchase
-- items. SECURITY DEFINER; the API layer owns capability checks + audit.
-- =============================================================================

create or replace function public.receive_purchase(
  p_pharmacy_id uuid,
  p_user_id uuid,
  p_supplier_id uuid,
  p_invoice_no text,
  p_note text,
  p_items jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_purchase_id uuid;
  v_item jsonb;
  v_batch_id uuid;
  v_medicine_id uuid;
  v_quantity integer;
  v_unit_cost numeric;
begin
  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'ITEMS_INVALID';
  end if;

  insert into public.purchases (pharmacy_id, supplier_id, invoice_no, received_at, created_by, note)
  values (
    p_pharmacy_id, p_supplier_id, nullif(p_invoice_no, ''), now(), p_user_id, nullif(p_note, '')
  )
  returning id into v_purchase_id;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_medicine_id := (v_item ->> 'medicineId')::uuid;
    v_quantity := (v_item ->> 'quantity')::integer;
    v_unit_cost := (v_item ->> 'unitCost')::numeric;

    if v_medicine_id is null or v_quantity is null or v_quantity <= 0
       or v_unit_cost is null or v_unit_cost < 0 then
      raise exception 'ITEM_INVALID';
    end if;

    -- Cross-tenant guard: the medicine must belong to this pharmacy.
    if not exists (
      select 1 from public.medicines
      where id = v_medicine_id and pharmacy_id = p_pharmacy_id
    ) then
      raise exception 'MEDICINE_NOT_FOUND';
    end if;

    if coalesce(v_item ->> 'batchId', '') <> '' then
      -- Increment an existing batch (row-locked).
      select id into v_batch_id
      from public.batches
      where id = (v_item ->> 'batchId')::uuid and pharmacy_id = p_pharmacy_id
      for update;
      if not found then
        raise exception 'BATCH_NOT_FOUND';
      end if;
      update public.batches
      set quantity = quantity + v_quantity, purchase_price = v_unit_cost, updated_at = now()
      where id = v_batch_id;
    else
      -- Create a new AVAILABLE batch; batch_no and expiry are required.
      if coalesce(v_item ->> 'batchNo', '') = '' or coalesce(v_item ->> 'expiryDate', '') = '' then
        raise exception 'BATCH_FIELDS_REQUIRED';
      end if;
      insert into public.batches (
        pharmacy_id, medicine_id, batch_no, expiry_date, quantity, status, purchase_price
      )
      values (
        p_pharmacy_id, v_medicine_id, v_item ->> 'batchNo',
        (v_item ->> 'expiryDate')::date, v_quantity, 'AVAILABLE', v_unit_cost
      )
      returning id into v_batch_id;
    end if;

    insert into public.purchase_items (purchase_id, medicine_id, batch_id, quantity, unit_cost)
    values (v_purchase_id, v_medicine_id, v_batch_id, v_quantity, v_unit_cost);
  end loop;

  return v_purchase_id;
end;
$$;

revoke all on function public.receive_purchase(uuid, uuid, uuid, text, text, jsonb)
  from public, anon, authenticated;


-- ######################## 0006_returns_reorders.sql ########################
-- =============================================================================
-- PharmaGuard migration 0006: Returns workflow (TRD §13 Return) + reorders
-- Return lifecycle RPCs move stock atomically at approval; reorders table
-- persists reorder records (history/status, PRD §10.12).
-- =============================================================================

create or replace function public.approve_return(
  p_pharmacy_id uuid,
  p_return_id uuid,
  p_user_id uuid
)
returns public.returns
language plpgsql
security definer
set search_path = public
as $$
declare
  v_return public.returns%rowtype;
begin
  select * into v_return
  from public.returns
  where id = p_return_id and pharmacy_id = p_pharmacy_id
  for update;
  if not found then
    raise exception 'RETURN_NOT_FOUND';
  end if;
  if v_return.status <> 'PENDING' then
    raise exception 'RETURN_INVALID_STATE';
  end if;

  select quantity into v_return.quantity from public.batches
  where id = v_return.batch_id for update;
  if not found or v_return.quantity is null then
    raise exception 'BATCH_NOT_FOUND';
  end if;

  -- Units leave the shelf when the return is approved (TRD §13 Return).
  update public.batches
  set quantity = quantity - v_return.quantity, updated_at = now()
  where id = v_return.batch_id
    and quantity >= v_return.quantity;
  if not found then
    raise exception 'INSUFFICIENT_STOCK';
  end if;

  update public.returns
  set status = 'APPROVED', updated_at = now()
  where id = p_return_id
  returning * into v_return;

  return v_return;
end;
$$;

create or replace function public.complete_return(
  p_pharmacy_id uuid,
  p_return_id uuid,
  p_return_date date
)
returns public.returns
language plpgsql
security definer
set search_path = public
as $$
declare
  v_return public.returns%rowtype;
begin
  select * into v_return
  from public.returns
  where id = p_return_id and pharmacy_id = p_pharmacy_id
  for update;
  if not found then
    raise exception 'RETURN_NOT_FOUND';
  end if;
  if v_return.status <> 'APPROVED' then
    raise exception 'RETURN_INVALID_STATE';
  end if;

  update public.returns
  set status = 'COMPLETED', return_date = coalesce(p_return_date, current_date), updated_at = now()
  where id = p_return_id
  returning * into v_return;

  return v_return;
end;
$$;

create or replace function public.reject_return(
  p_pharmacy_id uuid,
  p_return_id uuid
)
returns public.returns
language plpgsql
security definer
set search_path = public
as $$
declare
  v_return public.returns%rowtype;
begin
  select * into v_return
  from public.returns
  where id = p_return_id and pharmacy_id = p_pharmacy_id
  for update;
  if not found then
    raise exception 'RETURN_NOT_FOUND';
  end if;
  if v_return.status <> 'PENDING' then
    raise exception 'RETURN_INVALID_STATE';
  end if;

  update public.returns
  set status = 'REJECTED', updated_at = now()
  where id = p_return_id
  returning * into v_return;

  return v_return;
end;
$$;

revoke all on function public.approve_return(uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function public.complete_return(uuid, uuid, date) from public, anon, authenticated;
revoke all on function public.reject_return(uuid, uuid) from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- reorders (PRD §10.12): persisted reorder records with a computation snapshot
-- -----------------------------------------------------------------------------
create table if not exists public.reorders (
  id uuid primary key default gen_random_uuid(),
  pharmacy_id uuid not null references public.pharmacies (id) on delete cascade,
  medicine_id uuid not null references public.medicines (id) on delete cascade,
  supplier_id uuid references public.suppliers (id) on delete set null,
  status text not null default 'SUGGESTED'
    check (status in ('SUGGESTED', 'ORDERED', 'RECEIVED', 'DISMISSED')),
  observation_days integer not null check (observation_days between 1 and 180),
  lead_time_days integer not null check (lead_time_days between 1 and 90),
  average_daily_sales numeric(12, 4) not null check (average_daily_sales >= 0),
  current_stock integer not null check (current_stock >= 0),
  safety_stock numeric(12, 2) not null default 0 check (safety_stock >= 0),
  estimated_stockout_date date,
  recommended_quantity integer not null check (recommended_quantity >= 0),
  explanation text not null check (char_length(explanation) between 1 and 500),
  created_by uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_reorders_pharmacy_status
  on public.reorders (pharmacy_id, status, created_at desc);
create index if not exists idx_reorders_medicine
  on public.reorders (medicine_id);

alter table public.reorders enable row level security;
create policy "reorders_select" on public.reorders for select
  using (public.is_active_member(pharmacy_id));
create policy "reorders_insert" on public.reorders for insert
  with check (public.is_active_member(pharmacy_id) and created_by = auth.uid());
create policy "reorders_update" on public.reorders for update
  using (public.is_active_member(pharmacy_id))
  with check (public.is_active_member(pharmacy_id));
create policy "reorders_delete" on public.reorders for delete
  using (public.has_any_role(pharmacy_id, array['OWNER', 'MANAGER']::text[]));

drop trigger if exists trg_reorders_updated_at on public.reorders;
create trigger trg_reorders_updated_at
  before update on public.reorders
  for each row execute function public.set_updated_at();


-- ######################## 0007_notification_prefs.sql ########################
-- ----------------------------------------------------------------------------
-- 0007: per-user notification preferences (PRD §10.21 Settings).
-- Free-form-but-validated JSON; the API enforces the shape (zod) and the
-- default keeps existing rows valid without a backfill.
-- ----------------------------------------------------------------------------

alter table public.profiles
  add column if not exists notification_prefs jsonb not null default '{}'::jsonb;

