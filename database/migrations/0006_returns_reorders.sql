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
