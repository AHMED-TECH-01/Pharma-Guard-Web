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
