# remember.md — PharmaGuard project memory

Last updated: 06 Sep 2026 (evening) — OTP flow RESTORED per user decision (Gmail SMTP delivery confirmed working by the user; the live dashboard still sends the 6-digit {{ .Token }} code, so /verify-email was reinstated with the 6-box OTP input; /auth/confirm remains as a link-template fallback; Google/Microsoft OAuth stays removed). Gmail SMTP replaced Resend in the dashboard earlier the same day. Code changes are local-only pending user commit/push; web + API remain deployed to Vercel production (https://pharma-guard-web.vercel.app, https://pharma-guard-api.vercel.app). See the auth and deployment sections below.
This file is a working memory of the auth implementation: architecture, parameters, routes, env NAMES only.
No secrets, keys, or credentials are ever stored here.

## Vercel deployment (Web)

- Project: `ahmed-tech-01s-projects/pharma-guard-web` (prj_g0o7XbdCLdcelQsvHV69Zu0A7Ox6), connected to GitHub AHMED-TECH-01/Pharma-Guard-Web — pushes to main auto-deploy production.
- Production URL: https://pharma-guard-web.vercel.app (aliased at deploy time; older per-deployment URLs like pharma-guard-web-api-fphb.vercel.app belong to the deleted broken projects and 404 with DEPLOYMENT_NOT_FOUND).
- Required project settings: Root Directory = apps/web (dashboard-only setting), framework Next.js (auto-detected). With Root Directory set, Vercel installs ONLY the apps/web workspace tree (~101 packages), which lacks root-level devDependencies — fixed via `apps/web/vercel.json` `"installCommand": "cd ../.. && npm install"` (full root workspace install, ~611 packages incl. typescript/eslint/@types/node). Do not remove this override.
- Environment variables (NAMES only): NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, NEXT_PUBLIC_API_URL=`/api/v1` (relative), API_PROXY_URL=https://pharma-guard-api.vercel.app — all Production set via CLI (Preview pending). NEXT_PUBLIC_API_URL was MISSING until Phase 14 (the deployed web silently fell back to localhost:4000); it is now relative so the browser calls its own origin and next.config.ts rewrites (env-gated by API_PROXY_URL, unset locally) proxy /api/v1/* to the API — same-site, keeping the SameSite=Lax HttpOnly auth cookies first-party (every *.vercel.app subdomain is its own site; direct cross-origin cookie auth would silently fail). API CORS/cookie code untouched.
- Verification performed 06 Sep 2026: all routes 200 (/, /login, /signup, /dashboard, /inventory, /verify-email, /suppliers); CSS asset 200 (43,338 bytes, byte-identical to the local production build, Tailwind v4 tokens present); browser-verified /login and / visually styled with zero console errors/warnings and the stylesheet request 200.
- CLI workflow that works: `npx vercel --prod --yes` from the REPO ROOT (uploads the whole monorepo; the project's Root Directory handles the rest). Deploying from apps/web alone uploads only that directory and breaks workspace install; vercel build --prebuilt fails on Windows (EPERM symlink for dynamic-route .func outputs — Windows needs Developer Mode for symlinks).
- The three pre-existing broken projects (pharma-guard-web-api-fphb, pharma-guard-web, pharma-guard-web-web) were deleted from Vercel before 06 Sep; their GitHub deployment records remain on the repo but the deployments 404.

## Vercel deployment (API)

- Project: `ahmed-tech-01s-projects/pharma-guard-api` (prj_RrtlFlvMEXXzFuhxca9Dt3vGcnru), GitHub-connected (pushes to main auto-deploy it too), Root Directory = apps/api (dashboard setting). Production URL: https://pharma-guard-api.vercel.app.
- Serverless strategy: the Express app is BUNDLED by apps/api/scripts/build-vercel.mjs (esbuild devDependency) into gitignored dist-vercel/index.js — self-contained ESM with @pharmaguard/types + @pharmaguard/validation INLINED (their extensionless dist specifiers crash plain-Node-ESM serverless, same root cause as the web 500s; npm deps stay external and are traced from node_modules, keeping pdfkit font data disk-readable). The committed bridge apps/api/api/index.js re-exports the bundle (project-root api/ convention — note: api/ functions are discovered at the PROJECT ROOT, not inside outputDirectory).
- apps/api/vercel.json is required, do not remove: `"framework": null` (stops Express framework detection from building a phantom root function from src/server.ts, which traced the raw packages and 500'd FUNCTION_INVOCATION_FAILED on /), `"installCommand": "cd ../.. && npm install --include=dev"` (plain install SKIPS devDependencies when NODE_ENV=production is set as a project env var → package prepare scripts failed `tsc: command not found`), `"buildCommand": "npm run prebuild && node scripts/build-vercel.mjs"`, `"outputDirectory": "public"` (build writes a minimal public/index.html — empty output directories are rejected), rewrites `/(.*) → /api/index` (the original request path is preserved — Express sees /api/v1/*).
- Environment variables (NAMES only, Production, values piped via stdin never printed): NODE_ENV=production, API_URL, FRONTEND_URL, CORS_ALLOWED_ORIGINS (web prod URL), COOKIE_SECURE=true, SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, SUPABASE_SECRET_KEY, SUPABASE_JWKS_URL, GEMINI_API_KEY, EXPIRY_CRITICAL_DAYS, EXPIRY_WARNING_DAYS, AUDIT_IP_SALT.
- Verified 06 Sep 2026: GET /api/v1/health → 200 {"success":true,"data":{"status":"ok","service":"pharmaguard-api"}}; / serves the static index page; unknown /api/v1/* → 401 UNAUTHORIZED envelope (requireAuth guards before the 404 handler — by design, both directly and through the web proxy). Local pre-deploy smoke test imports the bundle under plain Node ESM (the exact crash mode) with the real apps/api/.env.
- Known serverless constraints (documented, accepted): express-rate-limit counters are per-lambda-instance (not global); request body cap 4.5MB (OCR uploads must stay under); single function, no cron/scheduled jobs.
- CLI workflow: deploy from the REPO ROOT with the root `.vercel/project.json` pointing at the TARGET project (it was temporarily switched to pharma-guard-api for API deploys and restored to pharma-guard-web afterwards — back the file up before switching). npx vercel resolves the local devDependency install.

## Authentication architecture

- Backend-authoritative cookie sessions: Express sets HttpOnly `pg_access` (1h) / `pg_refresh` (7d) cookies; the browser never persists Supabase sessions.
- Existing password flows (signup, login, logout, password reset/recovery) are unchanged and remain the default paths.
- Signup email verification is owned by Supabase Auth (GoTrue) as a 6-digit OTP code (restored 06 Sep): the code is stored hashed, single-use, 10-minute expiry ("OTP expiry" 600s), entry attempt-limited, resend rate-limited. OTP length 6 + expiry 600s were verified live via the Management API on 04 Sep and match the live branded template. The app never stores, logs, or displays code values.
- Signup sequence (shape unchanged): `admin.createUser` (email_confirm:false, does NOT email) then `auth.resend({ type: 'signup', email })` delivers the branded confirmation email. Send failures are warn-logged only — anti-enumeration.
- OTP template (docs/email-templates/confirm-signup.html, restored 06 Sep to the LIVE `{{ .Token }}` version): branded code box, subject "Verify your email - PharmaGuard" — matches what the dashboard actually sends now that Gmail SMTP delivers to any recipient. The link-template variant from the earlier 06 Sep pass was replaced by this restore (never committed).
- Web pages: `/verify-email` RESTORED from git HEAD (spec-exact copy after user-requested edits: "Check your email" heading, full email display, 6-box OTPInput, Verify button disabled while submitting/when incomplete, invalid/expired/too-many/network states, resend via POST /auth/resend-verification with 60s UI cooldown, Change email → /signup; success → session exchange → /onboarding or /dashboard). `/auth/confirm` KEPT as the link-template fallback (auto token-hash exchange). Signup routes to /verify-email?email=... on success; login links there when GoTrue blocks an unconfirmed login.
- Session exchange gate: `POST /api/v1/auth/session` accepts `{accessToken, refreshToken}` from the browser after the confirmation-link or password-recovery exchange, re-validates the access token server-side via `supabase.auth.getUser()`, loads user context, then issues the existing HttpOnly cookies. The server never trusts client claims.
- Approved browser Supabase operations (persistSession:false client only): recovery PKCE (pre-existing), the signup OTP verification (`verifyOtp` with email + 6-digit token) and the signup confirmation token-hash exchange fallback (`verifyOtp` with token_hash). Everything else stays server-side; OAuth operations removed.
- Login gating: with "Confirm email" enabled, GoTrue blocks unconfirmed logins (`email_not_confirmed` → existing friendly message); the login page links to `/verify-email?email=...`, which owns code entry and resend.

## OAuth (removed 06 Sep 2026)

- Google + Microsoft (Azure) social sign-in REMOVED: `apps/web/src/components/auth/oauth-buttons.tsx` and `/auth/callback` deleted; signup/login offer email + password only. If the providers were enabled in the Supabase dashboard, disable them (Authentication → Sign In / Providers).
- Accounts previously created via a social provider can still sign in with email + password after setting a password through the forgot-password flow.
- Gemini/OCR (`GEMINI_API_KEY`) is unrelated to auth and unaffected.

## Routes

- API: `POST /api/v1/auth/resend-verification` (re-sends the signup OTP email; verificationLimiter: 5/hour per IP+email, anti-enumeration `{sent:true}` response) and `POST /api/v1/auth/session` (sessionExchangeLimiter: 10/15min per IP; sets cookies; returns the same shape as `/auth/me`).
- Web: `/verify-email` (OTP page: 6-box input, verify/resend-60s-cooldown/change-email, invalid/expired/too-many/network states) and `/auth/confirm` (confirmation-link fallback: auto token-hash exchange, verifying/invalid/too-many states, resend with email param, "Create an account" fallback). `/auth/callback` remains deleted.
- Post-session routing: `/onboarding` if the user has no pharmacy yet, else `/dashboard`.
- Rate limiters follow the existing `makeLimiter` pattern in `apps/api/src/middleware/rate-limit.ts`.

## Profile, membership, RLS, protected routes (unchanged by the 06 Sep overhaul)

- Profiles: created by the `on_auth_user_created` trigger from auth.users signup metadata; read via the API's service key in `loadUserContext` (auth.service.ts); PGRST116 → honest 401 "Account profile not found", any other fault → 502 "Profile service is unavailable" + `profile_lookup_failed` log.
- Membership: `pharmacy_memberships` → `pharmacies`; `resolvePharmacyContext` 403 "No active pharmacy membership" is the normal pre-onboarding state; /onboarding is its own authenticated area.
- RLS: enabled on all 17 tables; anon/authenticated hold NO table grants (all data flows through the API); migration 0008 grants service_role DML and locks `create_pharmacy_with_membership` to service_role.
- Protected routes: web pages boot via cookie `fetchSession`; API requireAuth guards every area before the 404 handler (pinned by app.test.ts).
- Next recommended step: user runs the OTP test matrix on localhost (signup → receive code → /verify-email → verify → onboarding/dashboard, plus wrong-code, expired-code, resend-cooldown, change-email, logout and unauthenticated-dashboard checks), then production Site URL + allow-list before any push; commit/push remains the user's explicit decision.

## Validation schemas

- `packages/validation/src/auth.ts`: `resendVerificationSchema` (trimmed/lowercased email) and `sessionExchangeSchema` (accessToken/refreshToken, min 20 / max 4096 chars). Exported through the package index.
- IMPORTANT: `@pharmaguard/validation` resolves through built `dist/` — rebuild it (`npm run build -w packages/validation`) after any schema edit or the API typecheck fails with missing exports. Since 05 Sep 2026, `npm install`/`npm ci` auto-rebuilds both shared packages (workspace `prepare` scripts) — fresh clones, CI and Vercel no longer need a manual first build.

## Email template + brand

- Template: `docs/email-templates/confirm-signup.html` — the source of the branded Confirm-signup email, restored 06 Sep 2026 to the LIVE `{{ .Token }}` 6-digit version (GoTrue variables `{{ .Token }}` + `{{ .SiteURL }}` for the logo; subject "Verify your email - PharmaGuard"). This matches the template already applied live (04 Sep); with Gmail SMTP it now delivers to any recipient — no dashboard paste needed. The 06 Sep LINK variant was discarded in favor of the restored OTP flow.
- Logo: `apps/web/public/brand/pharmaguard-logo.png`, referenced by the template as `{{ .SiteURL }}/brand/pharmaguard-logo.png`. Production-safe (HTTPS origin); with a localhost Site URL the logo will not render in real inbox clients — expected in development.

## Environment variables (NAMES only — never values)

- Web (`apps/web/.env.local`): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- API (`apps/api/.env`): `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, `SUPABASE_JWKS_URL`, `FRONTEND_URL` (+ existing cookie/CORS vars)
- No new variables were added by the auth upgrade.

## Testing status (04 Sep 2026; final re-validation 05 Sep 2026)

- 60/60 tests pass (56 prior + 4 new contract tests in `apps/api/tests/auth-verification.test.ts` for the two schemas and error mapping).
- Gates: `npm run lint` EXIT 0, `npm run build` EXIT 0, API typecheck EXIT 0.
- Final re-validation (05 Sep 2026, unchanged tree): lint EXIT 0, typecheck EXIT 0 (4 workspaces), npm test 60/60, build EXIT 0 (37 routes); secret-pattern scan of the 18-file auth changeset clean (no Resend/SMTP/password literals in tracked or untracked files); nothing staged; web dev server restarted after the root build per the ops note. Resend-as-SMTP delivery task concluded with zero code changes required — SMTP credentials live only in the Supabase dashboard.
- Auth delivery overhaul re-validation (06 Sep 2026): typecheck EXIT 0 (4 workspaces), lint EXIT 0 (after eslint ignores += .vercel-tmp), npm test 60/60 EXIT 0, build EXIT 0 — 36 routes (/auth/confirm present; /verify-email + /auth/callback gone). verifyOtp token-hash exchange required GoTrue's snake_case `token_hash` field (VerifyTokenHashParams in @supabase/auth-js 2.115) — camelCase tokenHash fails TS2353. apps/web/.next deleted to clear phantom .next/types entries for the two deleted pages (TS config includes .next/types → phantom TS2307); restart the dev server after a root build if one was running.
- Vercel-build task (05 Sep 2026): the reported apps/api build failure (TS2307 for both @pharmaguard packages + missing vitest + cascades) was root-caused to the gitignored dist/ of the shared packages on a fresh checkout (no build ordering for per-workspace builds) plus vitest/@types/node missing from apps/api's own devDependencies. Fixed with workspace `prepare` scripts + apps' `prebuild` wrappers + devDeps (zero source changes). Re-verified from a simulated fresh checkout: npm ci EXIT 0 with both dists auto-built, npm run build -w apps/api EXIT 0, root build/typecheck/lint/test green, dev servers healthy.
- Live probes: `/`, `/login`, `/signup`, `/verify-email`, `/auth/callback` → 200; API health → 200; `POST /auth/resend-verification` invalid body → 422; `POST /auth/session` invalid body → 422 and garbage tokens → 401 (server-side token validation proven live).
- Regression: existing login/signup/logout/reset flows re-verified via tests; all guarded pages still boot via cookie `fetchSession`.

## Remaining user actions (Supabase dashboard — code is configuration-tolerant)

Status 06 Sep 2026 after the Resend → Gmail SMTP switch + OTP-page restoration (exact steps in docs/auth-setup.md section 2):
- DONE (user): Gmail SMTP is live in the dashboard (smtp.gmail.com:587, dedicated address + App Password) — OTP emails confirmed arriving in the inbox.
- DONE (live): branded `{{ .Token }}` 6-digit Confirm-signup template applied (04 Sep) — matches the restored docs/email-templates/confirm-signup.html; no template action needed.
- PENDING (user): disable Google + Azure providers (Authentication → Sign In / Providers) — the UI no longer offers them.
- KEEP: Confirm email enabled; "OTP expiry" 600s; OTP length 6; dev Site URL `http://localhost:3000` + allow-list `http://localhost:3000/**`. For production: Site URL `https://pharma-guard-web.vercel.app` + matching allow-list.
- Accepted trade-off (documented in docs/auth-setup.md): consumer Gmail ≈ 500 recipients/day and higher spam-folder risk; Supabase recommends dedicated transactional providers for production scale.
- Standing: rotate chat-exposed credentials (sbp_ access token, Resend API key, Google client secret). Git note: origin/main was back in sync with local main (0d3b41c) as of 06 Sep; any push must await the user's explicit word.

## Operational notes (standing)

- Running the root `npm run build` while `next dev` is live corrupts `apps/web/.next` — always restart the web dev server after a root build (kill the stale dev PID tree first if ports hang).
- Git: local commit `e03f162` (repo initial commit) exists; the push to `https://github.com/AHMED-TECH-01/Pharma-Guard-Web.git` was prepared but awaits the user's explicit word. Env files stay unpushed per `.gitignore`.
- Git divergence (verified 04 Sep 2026 via fetch): `origin/main` = `f3da588` "Delete docs directory" — a GitHub-side commit that deleted all 12 `docs/` files — on top of local `e03f162`. Local is 1 commit behind; a local push is non-fast-forward until reconciled. Options: restore docs (force-with-lease, destructive to the remote delete commit) or accept the deletion (merge/rebase removes docs from the repo). User decision required; local docs are intact and were NOT deleted.
- Pre-push security audit (04 Sep 2026, user 20-section protocol): PASS. Secret scan clean across tree/index/history/build artifacts (only gitignored env files hold real keys); RLS + RPC revokes verified; API/auth/OCR review passed; npm audit = 2 postcss-via-next vulns (fix is a breaking Next 16 upgrade — deferred deliberately); gates lint 0 / typecheck 0 / 60 tests / build 0. Credential rotation (sbp_ token, Resend key, Google client secret — all chat-exposed) is REQUIRED BEFORE PRODUCTION.
- Supabase Management API hazard (learned 05 Sep 2026): a PARTIAL `PATCH /v1/projects/{ref}/config/auth` wipes the whole SMTP group — a `smtp_pass`-only PATCH cleared host/port/user/admin/sender AND reset `mailer_templates_confirmation_content` to the 184-char default. Always send ONE atomic PATCH containing every SMTP field + template + subject. `smtp_port` must be a STRING ("587") or the PATCH is rejected 400. Read-back of `smtp_pass` returns a 64-char digest, not the plaintext — raw-AUTH-testing that digest yields a false 535. Config propagation lags ~60s.
- Resend testing-tier rule (verified): with the shared `onboarding@resend.dev` sender, non-owner recipients get 250 on RCPT TO but 550 at end-of-DATA — so a protocol-level recipient probe alone cannot prove deliverability; only a DATA-stage send can.
- TS server: after files are created mid-session, VS Code may show phantom TS2307 errors — Restart TS Server clears them (no code change).
- Monorepo build contract (learned 05 Sep 2026): packages/types + packages/validation are compile-then-consume (`main`/`types` → `dist/`, and `dist/` is gitignored — absent on fresh clones/Vercel). Both packages carry `prepare: tsc -p tsconfig.json` (npm runs workspace prepare at the end of every install/ci); apps/api + apps/web carry `prebuild` wrappers. Path depth: apps/* sit TWO levels below the root — scripts must use `../../packages/...`; a `../packages/...` path resolves to the nonexistent apps/packages (tsc TS5058; npm --prefix fails with spawn ENOENT exit -4058). npm 10.9.8 runs workspace script hooks (prebuild included) inside the workspace directory (cwd probe-verified), so these relative paths hold on Windows and Vercel Linux alike.
