-- ############################################################################
-- 0010: security hardening from the Supabase database-linter report.
--
-- Findings addressed here:
--   * 0011 function_search_path_mutable
--       -> public.set_updated_at had no pinned search_path.
--   * 0028/0029 anon/authenticated_security_definer_function_executable
--       -> public.handle_new_user(), public.is_active_member(uuid),
--          public.has_any_role(uuid, text[]) were SECURITY DEFINER with the
--          default PUBLIC execute, so any client could call them via
--          /rest/v1/rpc/<name>.
--   * auth_leaked_password_protection is an Auth project setting, not SQL --
--     enabled out-of-band via the Management API
--     (PATCH /v1/projects/{ref}/config/auth { "password_hibp_enabled": true }).
--
-- Why revoking EXECUTE from anon/authenticated is safe here:
--   * anon/authenticated hold NO table-level grants (0008): every PostgREST
--     request from those roles fails the table ACL check before any RLS
--     policy is evaluated, so policies that call these helpers can never run
--     under them. The only live DML path is the API's service_role key
--     (BYPASSRLS), which keeps explicit EXECUTE below.
--   * If end-user roles are ever granted table access, that change must
--     re-grant EXECUTE on these helpers to authenticated.
-- ############################################################################

-- 1. set_updated_at (lint 0011) ------------------------------------------------
-- Body only touches NEW.updated_at and now() (pg_catalog is always searched
-- first), so an empty search_path is safe. The live body is left untouched;
-- 0006 now carries the canonical definition for fresh setups.
alter function public.set_updated_at() set search_path = '';

-- 2. RLS membership helpers (lints 0028/0029) ----------------------------------
alter function public.is_active_member(uuid) set search_path = '';
alter function public.has_any_role(uuid, text[]) set search_path = '';

revoke execute on function public.is_active_member(uuid)
  from public, anon, authenticated;
revoke execute on function public.has_any_role(uuid, text[])
  from public, anon, authenticated;

grant execute on function public.is_active_member(uuid) to service_role;
grant execute on function public.has_any_role(uuid, text[]) to service_role;

-- 3. handle_new_user signup trigger (lints 0028/0029) ---------------------------
-- Only supabase_auth_admin fires this trigger (auth.users INSERT during
-- signup); no client may invoke it via /rest/v1/rpc.
alter function public.handle_new_user() set search_path = '';

revoke execute on function public.handle_new_user()
  from public, anon, authenticated;
grant execute on function public.handle_new_user()
  to supabase_auth_admin, service_role;
