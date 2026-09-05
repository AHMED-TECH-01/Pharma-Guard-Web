-- ############################################################################
-- 0008: service_role privileges + onboarding RPC restoration.
--
-- Root-cause fix for the post-verification "Account profile not found" 401:
-- the API server authenticates to PostgREST with the service-role key, but no
-- migration ever granted it table privileges (every table showed only the
-- schema-inherited REFERENCES/TRIGGER/TRUNCATE), so every profiles /
-- pharmacy_memberships lookup failed with 42501 "permission denied for table"
-- and was surfaced to clients as a misleading 401 "Account profile not found".
--
-- It also restores the canonical 0003 definition of create_pharmacy_with_membership
-- after live drift to a 5-arg variant that resolved auth.uid() internally -
-- always NULL under the service key, so onboarding could never succeed - and
-- locks the RPC back to the backend role only (0003's documented intent).
--
-- Grants here follow the standard Supabase pattern: the API's service_role
-- needs DML privileges, while end-user roles (anon/authenticated) keep none
-- at table level; RLS stays enabled on every table as the real security gate.
-- ############################################################################

-- 1. service_role (API server key) ------------------------------------------------
grant usage on schema public to service_role;

grant select, insert, update, delete on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;
grant execute on all functions in schema public to service_role;

-- Future objects created by postgres inherit the same privileges.
alter default privileges in schema public grant select, insert, update, delete on tables to service_role;
alter default privileges in schema public grant usage, select on sequences to service_role;
alter default privileges in schema public grant execute on functions to service_role;

-- 2. canonical onboarding RPC (0003) ----------------------------------------------
-- The backend passes the authenticated user id explicitly (p_user_id) because
-- it calls with the service-role key; auth.uid() cannot resolve there.
drop function if exists public.create_pharmacy_with_membership(text, text, text, text, text);

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

-- Backend-only execution: SECURITY DEFINER RPC with an explicit p_user_id
-- must never be callable by anon/authenticated clients.
revoke all on function public.create_pharmacy_with_membership(uuid, text, text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.create_pharmacy_with_membership(uuid, text, text, text, text, text)
  to service_role;

-- NOTE: RLS helper functions (is_active_member, has_any_role) and
-- handle_new_user keep their default PUBLIC execute - RLS policies evaluated
-- for anon/authenticated depend on it. Do not blanket-revoke functions.

-- 3. safety net: backfill profiles for any auth.users the trigger missed ----------
insert into public.profiles (id, full_name, phone, avatar_url)
select u.id,
       coalesce(u.raw_user_meta_data ->> 'full_name', u.raw_user_meta_data ->> 'name', ''),
       nullif(u.raw_user_meta_data ->> 'phone', ''),
       nullif(u.raw_user_meta_data ->> 'avatar_url', '')
from auth.users u
on conflict (id) do nothing;
