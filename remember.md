# remember.md — PharmaGuard project memory

Last updated: 06 Sep 2026 — Web deployed to Vercel production (project pharma-guard-web, https://pharma-guard-web.vercel.app) and visually verified. See the Vercel deployment section below.
This file is a working memory of the auth implementation: architecture, parameters, routes, env NAMES only.
No secrets, keys, or credentials are ever stored here.

## Vercel deployment (Web)

- Project: `ahmed-tech-01s-projects/pharma-guard-web` (prj_g0o7XbdCLdcelQsvHV69Zu0A7Ox6), connected to GitHub AHMED-TECH-01/Pharma-Guard-Web — pushes to main auto-deploy production.
- Production URL: https://pharma-guard-web.vercel.app (aliased at deploy time; older per-deployment URLs like pharma-guard-web-api-fphb.vercel.app belong to the deleted broken projects and 404 with DEPLOYMENT_NOT_FOUND).
- Required project settings: Root Directory = apps/web (dashboard-only setting), framework Next.js (auto-detected). With Root Directory set, Vercel installs ONLY the apps/web workspace tree (~101 packages), which lacks root-level devDependencies — fixed via `apps/web/vercel.json` `"installCommand": "cd ../.. && npm install"` (full root workspace install, ~611 packages incl. typescript/eslint/@types/node). Do not remove this override.
- Environment variables (NAMES only): NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (Production set via CLI; Preview pending). NEXT_PUBLIC_API_URL is referenced by apps/web but intentionally NOT yet set — Phase 14 sets it to the deployed API URL after the API project exists, then Web redeploys.
- Verification performed 06 Sep 2026: all routes 200 (/, /login, /signup, /dashboard, /inventory, /verify-email, /suppliers); CSS asset 200 (43,338 bytes, byte-identical to the local production build, Tailwind v4 tokens present); browser-verified /login and / visually styled with zero console errors/warnings and the stylesheet request 200.
- CLI workflow that works: `npx vercel --prod --yes` from the REPO ROOT (uploads the whole monorepo; the project's Root Directory handles the rest). Deploying from apps/web alone uploads only that directory and breaks workspace install; vercel build --prebuilt fails on Windows (EPERM symlink for dynamic-route .func outputs — Windows needs Developer Mode for symlinks).
- The three pre-existing broken projects (pharma-guard-web-api-fphb, pharma-guard-web, pharma-guard-web-web) were deleted from Vercel before 06 Sep; their GitHub deployment records remain on the repo but the deployments 404.

## Authentication architecture

- Backend-authoritative cookie sessions: Express sets HttpOnly `pg_access` (1h) / `pg_refresh` (7d) cookies; the browser never persists Supabase sessions.
- Existing password flows (signup, login, logout, password reset/recovery) are unchanged and remain the default paths.
- Email OTP verification is owned by Supabase Auth (GoTrue): 6-digit code, hashed at rest, single-use, 10-minute expiry (dashboard OTP expiry 600s), attempt-limited, resend rate-limited. No custom OTP table, no application-side email provider (same precedent as users-module invites). The app never stores, logs, or displays OTP values.
- Signup sequence: `admin.createUser` (email_confirm:false, does NOT email) then `auth.resend({ type: 'signup', email })` delivers the branded OTP email. Resend failures are warn-logged only — anti-enumeration.
- Session exchange gate: `POST /api/v1/auth/session` accepts `{accessToken, refreshToken}` from the browser after OAuth PKCE or `verifyOtp`, re-validates the access token server-side via `supabase.auth.getUser()`, loads user context, then issues the existing HttpOnly cookies. The server never trusts client claims. OAuth and OTP funnel through this one gate.
- Approved browser Supabase operations (persistSession:false client only): recovery PKCE (pre-existing), OAuth `signInWithOAuth`, PKCE `exchangeCodeForSession`, signup `verifyOtp`. Everything else stays server-side.
- Login gating: with "Confirm email" enabled, GoTrue blocks unconfirmed logins (`email_not_confirmed` → existing friendly message); the login page shows a "Verify your email" link to `/verify-email?email=…`.

## Providers

- Google + Microsoft (Azure) OAuth via `signInWithOAuth({ provider: 'google' | 'azure', options: { redirectTo: origin + '/auth/callback' } })` in `apps/web/src/components/auth/oauth-buttons.tsx`.
- Provider client IDs/secrets live ONLY in the Supabase dashboard — never in the repo or env files. No new env vars were added by this upgrade.
- OAuth users arrive provider-verified (no OTP step for them).

## Routes

- API: `POST /api/v1/auth/resend-verification` (verificationLimiter: 5/hour per IP+email, anti-enumeration `{sent:true}` response) and `POST /api/v1/auth/session` (sessionExchangeLimiter: 10/15min per IP; sets cookies; returns the same shape as `/auth/me`).
- Web: `/verify-email` (masked email heading, 6-box OTPInput, verifying/invalid/expired/too-many-attempts/resend cooldown/network states, 60s resend cooldown, "Change Email" → `/signup` as a fresh signup — no silent identity mutation) and `/auth/callback` (PKCE code exchange, provider `error`/`access_denied`/missing-param friendly states, then session exchange).
- Post-session routing: `/onboarding` if the user has no pharmacy yet, else `/dashboard`.
- Rate limiters follow the existing `makeLimiter` pattern in `apps/api/src/middleware/rate-limit.ts`.

## Validation schemas

- `packages/validation/src/auth.ts`: `resendVerificationSchema` (trimmed/lowercased email) and `sessionExchangeSchema` (accessToken/refreshToken, min 20 / max 4096 chars). Exported through the package index.
- IMPORTANT: `@pharmaguard/validation` resolves through built `dist/` — rebuild it (`npm run build -w packages/validation`) after any schema edit or the API typecheck fails with missing exports. Since 05 Sep 2026, `npm install`/`npm ci` auto-rebuilds both shared packages (workspace `prepare` scripts) — fresh clones, CI and Vercel no longer need a manual first build.

## Email template + brand

- Template: `docs/email-templates/confirm-signup.html` — the source of the branded Confirm-signup email. Uses GoTrue variables `{{ .Token }}` (6-digit OTP) and `{{ .SiteURL }}`. Status: applied live to the project on 04 Sep 2026 (subject "Verify your email - PharmaGuard") once custom SMTP unlocked customization; edits go via the Supabase dashboard or PATCH of `mailer_templates_confirmation_content`.
- Logo: `apps/web/public/brand/pharmaguard-logo.png`, referenced by the template as `{{ .SiteURL }}/brand/pharmaguard-logo.png`. Production-safe (HTTPS origin); with a localhost Site URL the logo will not render in real inbox clients — expected in development.

## Environment variables (NAMES only — never values)

- Web (`apps/web/.env.local`): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- API (`apps/api/.env`): `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, `SUPABASE_JWKS_URL`, `FRONTEND_URL` (+ existing cookie/CORS vars)
- No new variables were added by the auth upgrade.

## Testing status (04 Sep 2026; final re-validation 05 Sep 2026)

- 60/60 tests pass (56 prior + 4 new contract tests in `apps/api/tests/auth-verification.test.ts` for the two schemas and error mapping).
- Gates: `npm run lint` EXIT 0, `npm run build` EXIT 0, API typecheck EXIT 0.
- Final re-validation (05 Sep 2026, unchanged tree): lint EXIT 0, typecheck EXIT 0 (4 workspaces), npm test 60/60, build EXIT 0 (37 routes); secret-pattern scan of the 18-file auth changeset clean (no Resend/SMTP/password literals in tracked or untracked files); nothing staged; web dev server restarted after the root build per the ops note. Resend-as-SMTP delivery task concluded with zero code changes required — SMTP credentials live only in the Supabase dashboard.
- Vercel-build task (05 Sep 2026): the reported apps/api build failure (TS2307 for both @pharmaguard packages + missing vitest + cascades) was root-caused to the gitignored dist/ of the shared packages on a fresh checkout (no build ordering for per-workspace builds) plus vitest/@types/node missing from apps/api's own devDependencies. Fixed with workspace `prepare` scripts + apps' `prebuild` wrappers + devDeps (zero source changes). Re-verified from a simulated fresh checkout: npm ci EXIT 0 with both dists auto-built, npm run build -w apps/api EXIT 0, root build/typecheck/lint/test green, dev servers healthy.
- Live probes: `/`, `/login`, `/signup`, `/verify-email`, `/auth/callback` → 200; API health → 200; `POST /auth/resend-verification` invalid body → 422; `POST /auth/session` invalid body → 422 and garbage tokens → 401 (server-side token validation proven live).
- Regression: existing login/signup/logout/reset flows re-verified via tests; all guarded pages still boot via cookie `fetchSession`.

## Remaining user actions (Supabase dashboard — code is configuration-tolerant)

Status 04 Sep 2026 (scalar config applied programmatically via the Supabase Management API with a user-provided access token — token never stored in files):
- DONE + verified via live GET: Confirm email enabled (`mailer_autoconfirm=false`), OTP expiry 600s, OTP length 6, Site URL `http://localhost:3000`, redirect allow-list `http://localhost:3000/**`.
- RESOLVED (04 Sep 2026): custom SMTP configured via Supabase dashboard (Resend: smtp.resend.com:587, sender onboarding@resend.dev, name Pharma-Guard, rate_limit_email_sent 30/h) → template customization unlocked; branded Confirm-signup template (4,912 chars, `{{ .Token }}`, PharmaGuard logo) + subject "Verify your email - PharmaGuard" applied via Management API (`mailer_templates_confirmation_content`) and echo-verified.
- DONE (user, dashboard): Azure OAuth provider enabled with client ID + secret.
- DONE (04 Sep 2026): Google OAuth provider enabled via Management API (user's Google Cloud Console client; PATCH external_google_enabled/client_id/secret, echo-verified). Auth configuration is now COMPLETE: Google + Azure providers, Resend SMTP + branded template, Confirm email + OTP 600s/6-digit, Site URL + allow-list.
- RESOLVED (05 Sep 2026): OTP email delivery — root cause was NOT app code or Supabase config. Verified by a raw SMTP session against smtp.resend.com:587 (AUTH 235, MAIL FROM 250, RCPT TO 250) then a DATA-stage send: Resend answered `550 You can only send testing emails to your own email address (…)`. The shared testing sender `onboarding@resend.dev` delivers ONLY to the Resend account owner's address; every other recipient is rejected at DATA, which GoTrue surfaces as the generic warn `verification_email_send_failed` / "Error sending confirmation email". The registered app account IS the owner address, and a real `POST /auth/resend-verification` to it logged NO warn (200 only) — delivery confirmed working.
- PENDING (user): live tests — Google/Azure buttons → /auth/callback → dashboard; enter the received OTP at /verify-email. Production / other recipients: verify a sending domain at resend.com/domains and change `smtp_admin_email` + sender to that domain — until then only the owner address can receive mail (dev-only limitation, not a bug). Also: prod Site URL/redirects, HTTPS cookies. Rotate the sbp_ access token, Resend API key, and Google client secret after testing (all chat-exposed).
Exact guide: `docs/auth-setup.md` (incl. the free-tier template restriction note — custom SMTP is the unlock).

## Operational notes (standing)

- Running the root `npm run build` while `next dev` is live corrupts `apps/web/.next` — always restart the web dev server after a root build (kill the stale dev PID tree first if ports hang).
- Git: local commit `e03f162` (repo initial commit) exists; the push to `https://github.com/AHMED-TECH-01/Pharma-Guard-Web.git` was prepared but awaits the user's explicit word. Env files stay unpushed per `.gitignore`.
- Git divergence (verified 04 Sep 2026 via fetch): `origin/main` = `f3da588` "Delete docs directory" — a GitHub-side commit that deleted all 12 `docs/` files — on top of local `e03f162`. Local is 1 commit behind; a local push is non-fast-forward until reconciled. Options: restore docs (force-with-lease, destructive to the remote delete commit) or accept the deletion (merge/rebase removes docs from the repo). User decision required; local docs are intact and were NOT deleted.
- Pre-push security audit (04 Sep 2026, user 20-section protocol): PASS. Secret scan clean across tree/index/history/build artifacts (only gitignored env files hold real keys); RLS + RPC revokes verified; API/auth/OCR review passed; npm audit = 2 postcss-via-next vulns (fix is a breaking Next 16 upgrade — deferred deliberately); gates lint 0 / typecheck 0 / 60 tests / build 0. Credential rotation (sbp_ token, Resend key, Google client secret — all chat-exposed) is REQUIRED BEFORE PRODUCTION.
- Supabase Management API hazard (learned 05 Sep 2026): a PARTIAL `PATCH /v1/projects/{ref}/config/auth` wipes the whole SMTP group — a `smtp_pass`-only PATCH cleared host/port/user/admin/sender AND reset `mailer_templates_confirmation_content` to the 184-char default. Always send ONE atomic PATCH containing every SMTP field + template + subject. `smtp_port` must be a STRING ("587") or the PATCH is rejected 400. Read-back of `smtp_pass` returns a 64-char digest, not the plaintext — raw-AUTH-testing that digest yields a false 535. Config propagation lags ~60s.
- Resend testing-tier rule (verified): with the shared `onboarding@resend.dev` sender, non-owner recipients get 250 on RCPT TO but 550 at end-of-DATA — so a protocol-level recipient probe alone cannot prove deliverability; only a DATA-stage send can.
- TS server: after files are created mid-session, VS Code may show phantom TS2307 errors — Restart TS Server clears them (no code change).
- Monorepo build contract (learned 05 Sep 2026): packages/types + packages/validation are compile-then-consume (`main`/`types` → `dist/`, and `dist/` is gitignored — absent on fresh clones/Vercel). Both packages carry `prepare: tsc -p tsconfig.json` (npm runs workspace prepare at the end of every install/ci); apps/api + apps/web carry `prebuild` wrappers. Path depth: apps/* sit TWO levels below the root — scripts must use `../../packages/...`; a `../packages/...` path resolves to the nonexistent apps/packages (tsc TS5058; npm --prefix fails with spawn ENOENT exit -4058). npm 10.9.8 runs workspace script hooks (prebuild included) inside the workspace directory (cwd probe-verified), so these relative paths hold on Windows and Vercel Linux alike.
