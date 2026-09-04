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
