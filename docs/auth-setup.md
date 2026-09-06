# PharmaGuard -- Authentication Setup Guide

Signup email verification codes (6-digit OTP) delivered via Gmail SMTP
(Supabase Auth). No OAuth providers, no Resend.

This guide documents every step needed to configure signup email confirmation
end to end. Code is configuration-tolerant: until "Confirm email" and custom
SMTP are configured in the Supabase dashboard, signup still works -- accounts
just stay unconfirmed and GoTrue blocks unconfirmed logins with the friendly
"verify your email" message.

---

## 1. How the flow works (architecture recap)

```text
Password signup  -> POST /api/v1/auth/signup
                     creates the user (GoTrue, email_confirm: false)
                     + sends the branded OTP email (Gmail SMTP)
                 -> email contains the 6-digit verification code
                 -> signup page routes to /verify-email?email=<address>
                     (the OTP page; login links here for unconfirmed
                     accounts)
                 -> supabase.auth.verifyOtp({ type: 'signup', email, token })
                 -> POST /api/v1/auth/session  (server re-validates token,
                     sets HttpOnly pg_access / pg_refresh cookies)
                 -> /onboarding or /dashboard

Login            -> POST /api/v1/auth/login  (existing cookie session flow;
                     unconfirmed accounts are blocked by GoTrue with the
                     "verify your email" message; the login page links to
                     /verify-email, which owns code entry and resend)
```

Security properties (owned by GoTrue unless noted):

- Verification code: GoTrue generates the 6-digit OTP, stores only its
  **hash**, and marks it single-use. It expires after 10 minutes (the
  "OTP expiry" setting) and entry is attempt-limited; resend is
  rate-limited. The application never stores, logs, or displays code
  values.
- Session exchange (`POST /auth/session`) re-validates the browser-provided
  access token via `auth.getUser()` server-side before issuing cookies.
- Rate limits: verification resend 5/hour per IP+email, session exchange
  10/15 min per IP (apps/api/src/middleware/rate-limit.ts), plus GoTrue's
  own provider-side limits.
- SMTP credentials (the Gmail App Password) are stored ONLY in the Supabase
  dashboard -- never in this repository or its environment files.

---

## 2. Supabase dashboard: Gmail SMTP + OTP template

### Step 1 -- Dedicated Gmail account and App Password

1. Create (or pick) a dedicated Gmail address for PharmaGuard, e.g.
   `pharmaguard.noreply@gmail.com`. Do not use a personal mailbox.
2. In that Google account, enable **2-Step Verification**
   (myaccount.google.com -> Security). App Passwords are unavailable
   without it.
3. Visit myaccount.google.com -> Security -> **App passwords**, create one
   for "Mail". Copy the 16-character password NOW -- it is shown only once.

### Step 2 -- Configure Gmail SMTP in Supabase

Project Settings -> Auth -> SMTP Settings:

| Setting | Value |
| --- | --- |
| Enable Custom SMTP | ON |
| Sender email | the dedicated Gmail address (step 1) |
| Sender Name | `PharmaGuard` |
| Host | `smtp.gmail.com` |
| Port | `587` |
| Username | the dedicated Gmail address |
| Password | the 16-character App Password (paste without spaces) |

Save, then use **Send test email** to verify delivery to your own inbox.

Never put the App Password in `.env` files, `NEXT_PUBLIC_*` variables, or
the repository. It lives only in this dashboard form.

### Step 3 -- Install the branded OTP template

Authentication -> Emails -> Templates -> **Confirm signup**:

- Subject: `Verify your email - PharmaGuard`
- Paste the full source of `docs/email-templates/confirm-signup.html`.

The template renders the PharmaGuard logo and the 6-digit verification
code (`{{ .Token }}`) the user enters on `/verify-email`.

Template customization requires custom SMTP on free-tier projects
(platform policy, HTTP 400 otherwise) -- step 2 already satisfies this.

### Step 4 -- Email and URL settings

1. **Authentication -> Sign In / Providers -> Email**: keep **Confirm
   email** enabled.
2. **Authentication -> Emails**: "OTP expiry" `600` seconds and OTP
   length `6` -- the code's validity window and the number of digits
   users enter on `/verify-email`.
3. **Authentication -> URL Configuration -> Site URL**:
   - Local development: `http://localhost:3000`
   - Production: the public HTTPS origin
     (e.g. `https://pharma-guard-web.vercel.app`)
4. **Redirect URLs**: allow-list
   - `http://localhost:3000/**` (development)
   - `https://<your-production-origin>/**` (production)
5. **Authentication -> Sign In / Providers**: disable **Google** and
   **Azure/Microsoft** if they were enabled previously -- the UI no longer
   offers social sign-in.

Note: the email logo is served from `{{ .SiteURL }}/brand/pharmaguard-logo.png`.
With a localhost Site URL the image will not load in real inbox clients --
expected in development. The logo lives at
`apps/web/public/brand/pharmaguard-logo.png` and is deployed with the web app.

### Gmail sending limits (accepted trade-off)

A consumer Gmail mailbox allows roughly **500 recipients/day** over SMTP
(after which Google temporarily blocks sending), and transactional mail
from a consumer address has a higher spam-folder risk than dedicated
providers. Supabase recommends a dedicated transactional email service for
production scale. Gmail SMTP is a deliberate choice for this project's
current stage; monitor quota and spam placement as signup volume grows.

### Why the switch from Resend (migration note, 05-06 Sep 2026)

Resend's shared **testing** sender `onboarding@resend.dev` delivers only to
the Resend account owner's address; every other recipient is accepted at
`RCPT TO` (250) but rejected at end-of-`DATA` with:

```text
550 You can only send testing emails to your own email address (<owner>).
To send emails to other recipients, please verify a domain at
resend.com/domains, and change the `from` address to an email using this domain.
```

GoTrue hides that detail and only logs the generic warning
`verification_email_send_failed` / `Error sending confirmation email`, so
the failure looks like a Supabase misconfiguration when it is actually a
provider account limitation. Because `RCPT TO` returns 250, a
protocol-level recipient probe cannot detect it -- only a `DATA`-stage send
can. Fixing it would require verifying a sending domain at
resend.com/domains; switching to Gmail SMTP was chosen instead.

Supabase Management API hazard (standing knowledge): `PATCH
/v1/projects/{ref}/config/auth` is a **partial** update that wipes the whole
SMTP group -- sending only `smtp_pass` cleared host/port/user/admin/sender
and reset the confirmation template to the default. Always send ONE atomic
PATCH containing every SMTP field plus the template and subject, and send
`smtp_port` as a STRING (`"587"`). `smtp_pass` reads back as a digest, not
the plaintext. Config changes take up to ~60s to propagate to GoTrue.

---

## 3. OAuth providers (removed)

Google and Microsoft/Azure social sign-in were removed from the
authentication UI (signup and login offer email + password only). The
browser-side OAuth code (`oauth-buttons.tsx`, `/auth/callback`) and the
approved-operations entry for `signInWithOAuth` are gone.

- If Google/Azure providers were enabled in the Supabase dashboard, disable
  them (Authentication -> Sign In / Providers). The Gemini OCR integration
  (`GEMINI_API_KEY`) is unrelated and unaffected.
- Accounts previously created through a social provider can still sign in
  with email + password after setting a password through the
  forgot-password flow (GoTrue emails a recovery link that also sets a
  password).

---

## 4. Environment variables

No new variables are required. The Gmail App Password lives in the Supabase
dashboard only (section 2). The existing variables continue to apply:

```text
NEXT_PUBLIC_SUPABASE_URL             # apps/web (browser Supabase client)
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY # apps/web (publishable key only)
SUPABASE_URL / SUPABASE_PUBLISHABLE_KEY / SUPABASE_SECRET_KEY / SUPABASE_JWKS_URL  # apps/api
FRONTEND_URL                         # apps/api (CORS + reset redirect target)
```

The service-role/secret key remains server-only and must never be prefixed
with `NEXT_PUBLIC_`.

---

## 5. Local development URLs

| Concern | Value |
| --- | --- |
| Web app | `http://localhost:3000` |
| API | `http://localhost:4000/api/v1` |
| OTP template `{{ .SiteURL }}` (logo base) | `http://localhost:3000`; code entry happens in-app on `/verify-email` |

## 6. Production URLs

| Concern | Value |
| --- | --- |
| Site URL (Supabase URL Configuration) | `https://<your-production-origin>` |
| Redirect URLs | `https://<your-production-origin>/**` |
| CORS_ALLOWED_ORIGINS / FRONTEND_URL | the same production origin |
| Cookie Secure | `COOKIE_SECURE=true` (HTTPS) |

---

## 7. Routes

| Route | Owner | Purpose |
| --- | --- | --- |
| `POST /api/v1/auth/resend-verification` | API | Re-send the signup OTP email (anti-enumeration, rate-limited) |
| `POST /api/v1/auth/session` | API | Exchange a verified Supabase session for app cookies |
| `/verify-email` | Web | OTP page: `verifyOtp({ type: 'signup', email, token })`, resend with 60s UI cooldown, change email |
| `/auth/confirm` | Web | Confirmation-link fallback page: auto-confirms via `verifyOtp({ type: 'signup', tokenHash })`, then session exchange |

---

## 8. Troubleshooting

| Symptom | Cause | Fix |
| --- | --- | --- |
| Confirmation email never arrives | "Confirm email" disabled, template not saved, Gmail SMTP misconfigured, Gmail daily quota reached, or mail in spam | Section 2 steps 1-4; check spam; check Supabase Auth logs for `verification_email_send_failed` |
| Gmail rejects the connection (`535-5.7.8 Username and Password not accepted`) | Wrong App Password, spaces left in it, or 2-Step Verification disabled | Recreate the App Password (section 2 step 1) and paste it without spaces |
| Mail stops after ~500 sends/day | Consumer Gmail SMTP quota | Wait for the quota window to reset; consider a dedicated transactional provider for volume |
| Emails land in spam | Consumer sender address / content filters | Ask recipients to mark "not spam"; for production volume move to a dedicated provider with your own domain |
| "This verification code has expired" | Code older than 10 minutes | Request a fresh code (resend on /verify-email) and enter it within 10 minutes |
| "Invalid verification code" | Code mistyped, already used, or attempt-limited | Check the code, then resend if needed |
| "Too many requests" when resending | App/GoTrue resend limits reached | Wait, then resend; limits reset per GoTrue policy |
| Email shows a broken logo image | Development Site URL is localhost (inbox cannot load it) | Expected locally; set the production Site URL |
| Login says "verify your email before signing in" | The account exists but is not confirmed | Open /verify-email via the login page link, then enter or resend the code |
| "Account profile not found" right after verifying | The user genuinely has no `profiles` row (trigger failed, or the row was deleted); infrastructure faults surface as "Profile service is unavailable" instead (see §9) | Re-apply `database/migrations/0008_service_role_grants.sql` (it backfills profiles); check the `on_auth_user_created` trigger is enabled |
| Template edits rejected (HTTP 400 "not available for free tier") | Free-tier project on the built-in email provider | Configure Gmail SMTP (section 2 step 2) or upgrade to Pro, then paste the template |
| "Profile service is unavailable" right after verifying, with `profile_lookup_failed code=PGRST303 "JWT issued at future"` in the API logs | Supabase platform incident "401 errors due to JWT rejections": a stale time cache makes PostgREST reject freshly minted JWTs as future-issued (intermittent). Verified 06 Sep 2026: same key 401s then 200s within minutes; deployed flow passes again | Retry after a short wait. If persistent, Restart project (Dashboard -> General settings -> Restart project), Supabase's documented remediation. Not an app-code defect -- the 502 + `profile_lookup_failed` log is the by-design honest signal |

---

## 9. Bootstrap failure semantics & database privileges (05 Sep 2026)

After email confirmation the app resolves: authenticated user -> `profiles`
row -> `pharmacy_memberships` -> `pharmacies`. Failure classes are
intentionally distinct -- the API never collapses them into one message:

| Message | Meaning | Where |
| --- | --- | --- |
| `Account profile not found` (401) | The authenticated user genuinely has no `profiles` row (trigger missing/failed, or profile deleted) | `loadUserContext` / `requireAuth` |
| `Profile service is unavailable` (502) | The profiles lookup failed for an infrastructure reason (privileges, network) -- logged as `profile_lookup_failed` with the PostgREST code | same |
| `No active pharmacy membership` (403) | Profile exists, but no ACTIVE membership -- the normal pre-onboarding state | `resolvePharmacyContext` |
| `Session expired. Please sign in again.` (401) | Refresh token missing/invalid on `/auth/refresh` | `refreshSession` |

Migration `database/migrations/0008_service_role_grants.sql` (mirrored in
`apply-all-migrations.sql`) fixes the post-confirmation bootstrap:

- Grants the API's `service_role` its DML privileges (schema usage, all
  tables, sequences, functions). Previously every table showed only the
  schema-inherited `REFERENCES/TRIGGER/TRUNCATE`, so every
  profiles/memberships lookup failed with PostgREST 42501 and was surfaced
  as a misleading "Account profile not found".
- Restores the canonical `create_pharmacy_with_membership(p_user_id, ...)`
  definition (0003) -- a drifted 5-arg live variant resolved `auth.uid()`
  internally, which is always NULL under the service key, making onboarding
  impossible.
- Locks that RPC to `service_role` only (revoke from
  `public`/`anon`/`authenticated`). RLS helpers (`is_active_member`,
  `has_any_role`) and `handle_new_user` keep their default PUBLIC execute --
  RLS policies depend on it; never blanket-revoke functions.
- Backfills missing `profiles` rows from `auth.users` (idempotent,
  `on conflict do nothing`).

Client roles (`anon`/`authenticated`) intentionally hold NO table grants:
the frontend performs zero direct table access (all data flows through the
API), and RLS stays enabled on all 17 tables as the defense-in-depth gate.
