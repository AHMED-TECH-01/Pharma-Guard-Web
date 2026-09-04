-- ----------------------------------------------------------------------------
-- 0007: per-user notification preferences (PRD §10.21 Settings).
-- Free-form-but-validated JSON; the API enforces the shape (zod) and the
-- default keeps existing rows valid without a backfill.
-- ----------------------------------------------------------------------------

alter table public.profiles
  add column if not exists notification_prefs jsonb not null default '{}'::jsonb;
