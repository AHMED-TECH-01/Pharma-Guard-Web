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
