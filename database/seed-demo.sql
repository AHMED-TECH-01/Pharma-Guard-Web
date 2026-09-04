-- =============================================================================
-- PharmaGuard demo seed (build-plan Phase 15).
--
-- Purpose: after the schema migrations (0001-0007) have run and at least one
-- user has signed up, this script fills the workspace with a realistic demo
-- dataset: suppliers, medicines covering every stock-health scenario, batches
-- spread across the expiry spectrum, one quarantined batch, a purchase, a
-- handful of sales for trend/fast-mover views, and matching alerts.
--
-- Run order:
--   1. Apply migrations 0001-0007 (Supabase SQL editor or CLI).
--   2. Sign up a user in the app (this creates the auth user; the seed links
--      the pharmacy to that user).
--   3. Set DEMO_OWNER_EMAIL below and run this script in the SQL editor.
--
-- The script is idempotent: re-running adds nothing twice. Rows marked by
-- the demo batch numbers / names are skipped if they already exist. Sales
-- go through public.create_sale so stock decrements stay consistent with
-- the app's own transaction path.
-- =============================================================================

do $seed$
declare
  v_owner uuid;
  v_pharmacy uuid;
  v_medicine uuid;
  v_batch uuid;
  v_quarantined_batch uuid;
  v_supplier uuid;
  v_purchase uuid;
  v_sale_count integer;
begin
  -- ---------------------------------------------------------------------------
  -- 0. Configuration
  -- ---------------------------------------------------------------------------
  if lower('owner@example.com') = 'owner@example.com' then
    raise notice 'Update DEMO_OWNER_EMAIL in this script to the account you signed up with.';
  end if;

  select u.id into v_owner
  from auth.users u
  where lower(u.email) = lower('owner@example.com')
  limit 1;

  if v_owner is null then
    raise exception 'Demo seed: no auth user found for owner@example.com. Sign up first, then set the email here.';
  end if;

  insert into public.profiles (id, full_name)
  values (v_owner, 'Demo Owner')
  on conflict (id) do nothing;

  -- ---------------------------------------------------------------------------
  -- 1. Pharmacy: reuse the owner's existing membership, else create one
  -- ---------------------------------------------------------------------------
  select m.pharmacy_id into v_pharmacy
  from public.pharmacy_memberships m
  where m.user_id = v_owner
  limit 1;

  if v_pharmacy is null then
    insert into public.pharmacies (name, owner_name, currency)
    values ('Demo Pharmacy', 'Demo Owner', 'PKR')
    returning id into v_pharmacy;

    insert into public.pharmacy_memberships (pharmacy_id, user_id, role, status)
    values (v_pharmacy, v_owner, 'OWNER', 'active');
  end if;

  -- ---------------------------------------------------------------------------
  -- 2. Suppliers
  -- ---------------------------------------------------------------------------
  insert into public.suppliers (pharmacy_id, name, phone, email, address)
  select v_pharmacy, s.name, s.phone, s.email, s.address
  from (values
    ('MediSource Distributors', '+92 300 1112223', 'orders@medisource.example', '12 Industrial Area, Lahore'),
    ('HealthLink Traders', '+92 301 4445556', 'sales@healthlink.example', 'Block 6, Karachi'),
    ('CarePoint Supply', '+92 302 7778889', 'hello@carepoint.example', 'Main Blvd, Islamabad')
  ) as s(name, phone, email, address)
  where not exists (
    select 1 from public.suppliers d
    where d.pharmacy_id = v_pharmacy and d.name = s.name
  );

  -- ---------------------------------------------------------------------------
  -- 3. Medicines - one per stock-health scenario the analytics surface
  -- ---------------------------------------------------------------------------
  insert into public.medicines (
    pharmacy_id, name, generic_name, strength, dosage_form, manufacturer,
    category, reorder_level, safety_stock, purchase_price, selling_price
  )
  select v_pharmacy, m.name, m.generic_name, m.strength, m.dosage_form, m.manufacturer,
         m.category, m.reorder_level, m.safety_stock, m.purchase_price, m.selling_price
  from (values
    ('Panadol Extra', 'Paracetamol + Caffeine', '500mg', 'Tablet', 'GSK', 'Analgesic', 40, 15, 18.00, 25.00),
    ('Augmentin 625', 'Amoxicillin + Clavulanic Acid', '625mg', 'Tablet', 'GSK', 'Antibiotic', 20, 10, 42.00, 58.00),
    ('Brufen 400', 'Ibuprofen', '400mg', 'Tablet', 'Abbott', 'Analgesic', 30, 12, 15.50, 22.00),
    ('Ventolin Inhaler', 'Salbutamol', '100mcg', 'Inhaler', 'GSK', 'Respiratory', 10, 5, 310.00, 395.00),
    ('Metformin 500', 'Metformin HCl', '500mg', 'Tablet', 'Merck', 'Antidiabetic', 50, 20, 9.00, 14.50),
    ('Loprin 75', 'Aspirin', '75mg', 'Tablet', 'Sanofi', 'Cardiovascular', 40, 15, 3.20, 5.00),
    ('Coughex Syrup', 'Dextromethorphan', '100ml', 'Syrup', 'Hilton', 'Antitussive', 15, 8, 65.00, 90.00),
    ('Zincovit Tablets', 'Multivitamin + Zinc', 'strip', 'Tablet', 'Apex', 'Supplement', 25, 10, 95.00, 130.00)
  ) as m(name, generic_name, strength, dosage_form, manufacturer, category, reorder_level, safety_stock, purchase_price, selling_price)
  where not exists (
    select 1 from public.medicines d
    where d.pharmacy_id = v_pharmacy and d.name = m.name
  );

  -- ---------------------------------------------------------------------------
  -- 4. Batches across the expiry spectrum (dates relative to run day)
  --    expired(-10d) | critical(12d) | warning(75d) | safe(400d)
  -- ---------------------------------------------------------------------------
  select id into v_medicine from public.medicines
  where pharmacy_id = v_pharmacy and name = 'Panadol Extra' limit 1;
  if v_medicine is not null then
    insert into public.batches (medicine_id, pharmacy_id, batch_no, expiry_date, quantity, received_date, purchase_price, supplier_id, status)
    select v_pharmacy, v_medicine, b.batch_no, b.expiry_date, b.quantity, current_date - 60, b.purchase_price,
           (select id from public.suppliers where pharmacy_id = v_pharmacy and name = 'MediSource Distributors'),
           'AVAILABLE'
    from (values
      ('DEMO-PX-1001', current_date - 10, 60, 18.00),
      ('DEMO-PX-1002', current_date + 12, 90, 18.00),
      ('DEMO-PX-1003', current_date + 400, 240, 18.00)
    ) as b(batch_no, expiry_date, quantity, purchase_price)
    where not exists (
      select 1 from public.batches d
      where d.pharmacy_id = v_pharmacy and d.medicine_id = v_medicine and d.batch_no = b.batch_no
    );
  end if;

  -- Fast mover with a healthy long-dated batch (for 30d sales trend).
  select id into v_medicine from public.medicines
  where pharmacy_id = v_pharmacy and name = 'Brufen 400' limit 1;
  if v_medicine is not null then
    insert into public.batches (medicine_id, pharmacy_id, batch_no, expiry_date, quantity, received_date, purchase_price, supplier_id, status)
    select v_pharmacy, v_medicine, 'DEMO-BR-2001', current_date + 320, 300, current_date - 45, 15.50,
           (select id from public.suppliers where pharmacy_id = v_pharmacy and name = 'HealthLink Traders'),
           'AVAILABLE'
    where not exists (
      select 1 from public.batches d
      where d.pharmacy_id = v_pharmacy and d.medicine_id = v_medicine and d.batch_no = 'DEMO-BR-2001'
    );
  end if;

  select id into v_medicine from public.medicines
  where pharmacy_id = v_pharmacy and name = 'Augmentin 625' limit 1;
  if v_medicine is not null then
    insert into public.batches (medicine_id, pharmacy_id, batch_no, expiry_date, quantity, received_date, purchase_price, supplier_id, status)
    select v_pharmacy, v_medicine, 'DEMO-AG-3001', current_date + 75, 26, current_date - 30, 42.00,
           (select id from public.suppliers where pharmacy_id = v_pharmacy and name = 'CarePoint Supply'),
           'AVAILABLE'
    where not exists (
      select 1 from public.batches d
      where d.pharmacy_id = v_pharmacy and d.medicine_id = v_medicine and d.batch_no = 'DEMO-AG-3001'
    );
  end if;

  -- Low stock (below reorder level) + out of stock (zero quantity).
  select id into v_medicine from public.medicines
  where pharmacy_id = v_pharmacy and name = 'Ventolin Inhaler' limit 1;
  if v_medicine is not null then
    insert into public.batches (medicine_id, pharmacy_id, batch_no, expiry_date, quantity, received_date, purchase_price, status)
    select v_pharmacy, v_medicine, 'DEMO-VN-4001', current_date + 200, 3, current_date - 90, 310.00, 'AVAILABLE'
    where not exists (
      select 1 from public.batches d
      where d.pharmacy_id = v_pharmacy and d.medicine_id = v_medicine and d.batch_no = 'DEMO-VN-4001'
    );
  end if;

  select id into v_medicine from public.medicines
  where pharmacy_id = v_pharmacy and name = 'Coughex Syrup' limit 1;
  if v_medicine is not null then
    insert into public.batches (medicine_id, pharmacy_id, batch_no, expiry_date, quantity, received_date, purchase_price, status)
    select v_pharmacy, v_medicine, 'DEMO-CS-5001', current_date + 150, 0, current_date - 120, 65.00, 'AVAILABLE'
    where not exists (
      select 1 from public.batches d
      where d.pharmacy_id = v_pharmacy and d.medicine_id = v_medicine and d.batch_no = 'DEMO-CS-5001'
    );
  end if;

  -- Overstock: far above 2x reorder level, slow moving.
  select id into v_medicine from public.medicines
  where pharmacy_id = v_pharmacy and name = 'Zincovit Tablets' limit 1;
  if v_medicine is not null then
    insert into public.batches (medicine_id, pharmacy_id, batch_no, expiry_date, quantity, received_date, purchase_price, status)
    select v_pharmacy, v_medicine, 'DEMO-ZV-6001', current_date + 420, 260, current_date - 75, 95.00, 'AVAILABLE'
    where not exists (
      select 1 from public.batches d
      where d.pharmacy_id = v_pharmacy and d.medicine_id = v_medicine and d.batch_no = 'DEMO-ZV-6001'
    );
  end if;

  -- Quarantined batch (damaged carton) + its quarantine item.
  select id into v_medicine from public.medicines
  where pharmacy_id = v_pharmacy and name = 'Metformin 500' limit 1;
  if v_medicine is not null then
    insert into public.batches (medicine_id, pharmacy_id, batch_no, expiry_date, quantity, received_date, purchase_price, status)
    select v_pharmacy, v_medicine, 'DEMO-MF-7001', current_date + 250, 80, current_date - 20, 9.00, 'QUARANTINED'
    where not exists (
      select 1 from public.batches d
      where d.pharmacy_id = v_pharmacy and d.medicine_id = v_medicine and d.batch_no = 'DEMO-MF-7001'
    );

    select id into v_quarantined_batch from public.batches
    where pharmacy_id = v_pharmacy and medicine_id = v_medicine and batch_no = 'DEMO-MF-7001' limit 1;
    if v_quarantined_batch is not null then
      insert into public.quarantine_items (batch_id, quantity, reason, status, created_by)
      select v_quarantined_batch, 80, 'Damaged carton received; holding pending supplier response', 'QUARANTINED', v_owner
      where not exists (
        select 1 from public.quarantine_items q
        where q.batch_id = v_quarantined_batch and q.status = 'QUARANTINED'
      );
    end if;
  end if;

  -- ---------------------------------------------------------------------------
  -- 5. Purchase record for the Panadol receipt (guards on invoice number)
  -- ---------------------------------------------------------------------------
  select id into v_supplier from public.suppliers
  where pharmacy_id = v_pharmacy and name = 'MediSource Distributors' limit 1;
  if v_supplier is not null and not exists (
    select 1 from public.purchases p
    where p.pharmacy_id = v_pharmacy and p.invoice_no = 'DEMO-INV-0001'
  ) then
    insert into public.purchases (pharmacy_id, supplier_id, invoice_no, received_at, created_by, note)
    values (v_pharmacy, v_supplier, 'DEMO-INV-0001', now() - interval '60 days', v_owner, 'Demo opening stock')
    returning id into v_purchase;

    insert into public.purchase_items (purchase_id, medicine_id, batch_id, quantity, unit_cost)
    select v_purchase, b.medicine_id, b.id, b.quantity, b.purchase_price
    from public.batches b
    where b.pharmacy_id = v_pharmacy and b.batch_no like 'DEMO-PX-%';
  end if;

  -- ---------------------------------------------------------------------------
  -- 6. Sales through the app's own transaction function (stock stays true).
  --    Only when this pharmacy has no sales yet, so re-runs stay idempotent.
  -- ---------------------------------------------------------------------------
  select count(*) into v_sale_count from public.sales where pharmacy_id = v_pharmacy;
  if v_sale_count = 0 then
    -- Brufen 400: strong mover across the 30d window.
    select id into v_batch from public.batches
    where pharmacy_id = v_pharmacy and batch_no = 'DEMO-BR-2001' limit 1;
    if v_batch is not null then
      perform public.create_sale(v_pharmacy, v_owner, v_batch, 4, 22.00, 'Demo sale', now() - interval '26 days');
      perform public.create_sale(v_pharmacy, v_owner, v_batch, 6, 22.00, 'Demo sale', now() - interval '21 days');
      perform public.create_sale(v_pharmacy, v_owner, v_batch, 3, 22.00, 'Demo sale', now() - interval '17 days');
      perform public.create_sale(v_pharmacy, v_owner, v_batch, 8, 22.00, 'Demo sale', now() - interval '12 days');
      perform public.create_sale(v_pharmacy, v_owner, v_batch, 5, 22.00, 'Demo sale', now() - interval '8 days');
      perform public.create_sale(v_pharmacy, v_owner, v_batch, 7, 22.00, 'Demo sale', now() - interval '3 days');
      perform public.create_sale(v_pharmacy, v_owner, v_batch, 4, 22.00, 'Demo sale', now() - interval '1 day');
    end if;

    -- Panadol Extra: moderate mover on the safe batch.
    select id into v_batch from public.batches
    where pharmacy_id = v_pharmacy and batch_no = 'DEMO-PX-1003' limit 1;
    if v_batch is not null then
      perform public.create_sale(v_pharmacy, v_owner, v_batch, 10, 25.00, 'Demo sale', now() - interval '14 days');
      perform public.create_sale(v_pharmacy, v_owner, v_batch, 6, 25.00, 'Demo sale', now() - interval '6 days');
      perform public.create_sale(v_pharmacy, v_owner, v_batch, 9, 25.00, 'Demo sale', now() - interval '2 days');
    end if;

    -- Augmentin: occasional sales inside the warning window batch.
    select id into v_batch from public.batches
    where pharmacy_id = v_pharmacy and batch_no = 'DEMO-AG-3001' limit 1;
    if v_batch is not null then
      perform public.create_sale(v_pharmacy, v_owner, v_batch, 2, 58.00, 'Demo sale', now() - interval '9 days');
      perform public.create_sale(v_pharmacy, v_owner, v_batch, 3, 58.00, 'Demo sale', now() - interval '4 days');
    end if;
  end if;

  -- ---------------------------------------------------------------------------
  -- 7. Alerts matching the seeded conditions (the engine will keep them
  --    fresh as the app runs; these make the dashboard useful immediately).
  -- ---------------------------------------------------------------------------
  insert into public.alerts (pharmacy_id, medicine_id, batch_id, type, severity, title, message)
  select v_pharmacy, b.medicine_id, b.id, a.type, a.severity, a.title, a.message
  from public.batches b
  join (values
    ('EXPIRED', 'CRITICAL', 'Expired stock on shelf', 'A demo batch has passed its expiry date. Remove and record it.'),
    ('EXPIRING', 'HIGH', 'Expiry inside 30 days', 'A demo batch expires within the critical window. Plan removal or returns.')
  ) as a(type, severity, title, message)
  on (a.type = 'EXPIRED' and b.batch_no = 'DEMO-PX-1001')
  or (a.type = 'EXPIRING' and b.batch_no = 'DEMO-PX-1002')
  where b.pharmacy_id = v_pharmacy
  and not exists (
    select 1 from public.alerts x
    where x.pharmacy_id = v_pharmacy and x.type = a.type and x.title = a.title
  );

  insert into public.alerts (pharmacy_id, medicine_id, type, severity, title, message)
  select v_pharmacy, m.id, a.type, a.severity, a.title, a.message
  from (values
    ('Ventolin Inhaler', 'LOW_STOCK', 'HIGH', 'Stock below reorder level', 'Ventolin Inhaler is below its reorder level.'),
    ('Coughex Syrup', 'LOW_STOCK', 'MEDIUM', 'Out of stock', 'Coughex Syrup has zero stock across all batches.')
  ) as a(medicine_name, type, severity, title, message)
  join public.medicines m on m.pharmacy_id = v_pharmacy and m.name = a.medicine_name
  where not exists (
    select 1 from public.alerts x
    where x.pharmacy_id = v_pharmacy and x.type = a.type and x.title = a.title
  );

  raise notice 'Demo seed complete for pharmacy %', v_pharmacy;
end
$seed$;
