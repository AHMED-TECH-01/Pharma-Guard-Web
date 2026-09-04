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
