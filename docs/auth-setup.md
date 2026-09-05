# PharmaGuard â€” Authentication Setup Guide

Google OAuth Â· Microsoft OAuth Â· Email OTP verification (Supabase Auth)

This guide documents every step needed to configure the auth-upgrade feature
end to end. Code is already configuration-tolerant: until a provider or
email confirmation is enabled in the Supabase dashboard, the related UI
surfaces calm errors instead of breaking.

---

## 1. How the flows work (architecture recap)

```text
Password signup  -> POST /api/v1/auth/signup
                     creates the user (GoTrue) + sends the branded OTP email
                 -> /verify-email  (6-digit code, 10 min, single-use)
                 -> verifyOtp (browser, GoTrue)
                 -> POST /api/v1/auth/session  (server re-validates token,
                     sets HttpOnly pg_access / pg_refresh cookies)
                 -> /onboarding or /dashboard

OAuth (Google / Microsoft)
                 -> signInWithOAuth (browser, PKCE)
                 -> provider consent
                 -> /auth/callback?code=â€¦
                 -> exchangeCodeForSession (browser, PKCE)
                 -> POST /api/v1/auth/session  (same gate as OTP)
                 -> /onboarding or /dashboard

Login            -> POST /api/v1/auth/login  (existing cookie session flow;
                    unconfirmed accounts are blocked by GoTrue with a
                    "verify your email" CTA linking to /verify-email)
```

Security properties (owned by GoTrue unless noted):

- OTP: cryptographically random 6 digits, **hashed at rest**, single-use,
  expires after 10 minutes, attempt-limited, resend rate-limited.
  The application never stores, logs, or displays OTP values.
- Session exchange (`POST /auth/session`) re-validates the browser-provided
  access token via `auth.getUser()` server-side before issuing cookies.
- Rate limits: verification resend 5/hour per IP+email, session exchange
  10/15 min per IP (apps/api/src/middleware/rate-limit.ts), plus GoTrue's
  own provider-side limits.
- Provider client secrets are stored ONLY in the Supabase dashboard - they
  are never placed in this repository or its environment files.

---

## 2. Supabase dashboard: email OTP verification

1. **Authentication -> Sign In / Providers -> Email**: enable **Confirm email**.
2. **Authentication -> Emails**: set **OTP expiry** to `600` seconds (10 minutes).
3. **Authentication -> Emails -> Templates -> Confirm signup**:
   paste the full source of `docs/email-templates/confirm-signup.html`.
   It renders the PharmaGuard logo and the `{{ .Token }}` 6-digit code.

   Platform restriction (verified 04 Sep 2026): template customization is
   rejected on free-tier projects using the built-in email provider -
   HTTP 400 "Email template modification is not available for free tier
   projects using the default email provider". Configure a custom SMTP
   provider (Project Settings -> Auth -> SMTP; e.g. Resend, Brevo, SendGrid,
   Gmail) or upgrade to Pro, then paste the template. Custom SMTP also
   unlocks the Management API field `mailer_templates_confirmation_content`
   for programmatic application. Until the template is applied, the default
   template sends a confirmation LINK (`{{ .ConfirmationURL }}`), not the
   6-digit code, so `/verify-email` code entry cannot complete.
4. **Authentication -> URL Configuration -> Site URL**:
   - Local development: `http://localhost:3000`
   - Production: your public HTTPS origin (e.g. `https://app.yourdomain.com`)
5. **Redirect URLs**: allow-list
   - `http://localhost:3000/**` (development)
   - `https://<your-production-origin>/**` (production)

Note: the email logo is served from `{{ .SiteURL }}/brand/pharmaguard-logo.png`.
With a localhost Site URL the image will not load in real inbox clients -
this is expected in development; in production the Site URL is HTTPS public
and the logo renders. The logo file lives at
`apps/web/public/brand/pharmaguard-logo.png` and is deployed with the web app.

### SMTP provider recipient restriction (verified 05 Sep 2026)

Resend's shared **testing** sender `onboarding@resend.dev` can only deliver to
the Resend account **owner's own email address**. Any other recipient is
accepted at `RCPT TO` (250) but rejected at end-of-`DATA` with:

```
550 You can only send testing emails to your own email address (<owner>).
To send emails to other recipients, please verify a domain at
resend.com/domains, and change the `from` address to an email using this domain.
```

GoTrue hides that detail and only logs the generic warning
`verification_email_send_failed` / `Error sending confirmation email`, so the
failure looks like a Supabase misconfiguration when it is actually a provider
account limitation. Because `RCPT TO` returns 250, a protocol-level recipient
probe cannot detect it - only a `DATA`-stage send can.

Consequences for development and production:

- Development: sign up / verify **only** with the Resend account owner's
  address. Other addresses silently receive nothing.
- Production (required): verify a sending domain at `resend.com/domains`, then
  set `smtp_admin_email` and the sender name to an address on that domain
  (Project Settings -> Auth -> SMTP). All recipients then work.

Supabase Management API hazard: `PATCH /v1/projects/{ref}/config/auth` is a
**partial** update that wipes the whole SMTP group - sending only `smtp_pass`
cleared host/port/user/admin/sender and reset the confirmation template to the
default. Always send ONE atomic PATCH containing every SMTP field plus the
template and subject, send `smtp_port` as a STRING (`"587"`), and expect
`smtp_pass` to read back as a digest rather than the plaintext key. Config
changes take up to ~60s to propagate to GoTrue.

---

## 3. Google OAuth

1. Open <https://console.cloud.google.com> -> create/select a project.
2. **APIs & Services -> OAuth consent screen**: External, fill app name
   ("PharmaGuard"), support email, developer contact. Scopes: `email`,
   `profile`, `openid`.
3. **APIs & Services -> Credentials -> Create credentials -> OAuth client ID**:
   - Application type: **Web application**
   - Authorized redirect URI:
     `https://<your-project-ref>.supabase.co/auth/v1/callback`
   (exact value shown by Supabase in step 4)
4. Supabase dashboard **Authentication -> Sign In / Providers -> Google**:
   enable, paste the **Client ID** and **Client secret** from step 3. Save.
5. No repository changes are needed - nothing is stored in `.env`.

---

## 4. Microsoft OAuth (Azure AD)

1. Open <https://portal.azure.com> -> **Microsoft Entra ID** (Azure AD) ->
   **App registrations -> New registration**:
   - Name: "PharmaGuard"
   - Supported account types: **Accounts in any organizational directory and
     personal Microsoft accounts** (matches Supabase's default `common` tenant)
   - Redirect URI (Web):
     `https://<your-project-ref>.supabase.co/auth/v1/callback`
2. **Certificates & secrets -> New client secret** - copy the **Value**
   (not the ID).
3. **API permissions**: `openid`, `email`, `profile` (delegated) are granted
   by default via Microsoft Graph `User.Read`.
4. Supabase dashboard **Authentication -> Sign In / Providers -> Azure**:
   enable, paste the **Application (client) ID** and the **secret Value**.
   Leave the tenant/URL override empty for the `common` tenant. Save.

---

## 5. Environment variables

No new variables are required. Provider secrets live in the Supabase
dashboard (sections 3-4). The existing variables continue to apply:

```text
NEXT_PUBLIC_SUPABASE_URL            # apps/web (browser Supabase client)
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY # apps/web (publishable key only)
SUPABASE_URL / SUPABASE_PUBLISHABLE_KEY / SUPABASE_SECRET_KEY / SUPABASE_JWKS_URL  # apps/api
FRONTEND_URL                         # apps/api (CORS + reset redirect target)
```

The service-role/secret key remains server-only and must never be prefixed
with `NEXT_PUBLIC_`.

---

## 6. Local development URLs

| Concern | Value |
| --- | --- |
| Web app | `http://localhost:3000` |
| API | `http://localhost:4000/api/v1` |
| OAuth callback | `http://localhost:3000/auth/callback` (set by the app itself) |
| Verify email page | `http://localhost:3000/verify-email?email=â€¦` |
| Supabase auth callback (provider-side) | `https://<project-ref>.supabase.co/auth/v1/callback` |

## 7. Production URLs

| Concern | Value |
| --- | --- |
| Site URL (Supabase URL Configuration) | `https://<your-production-origin>` |
| Redirect URLs | `https://<your-production-origin>/**` |
| CORS_ALLOWED_ORIGINS / FRONTEND_URL | the same production origin |
| Cookie Secure | `COOKIE_SECURE=true` (HTTPS) |

---

## 8. Routes added by this upgrade

| Route | Owner | Purpose |
| --- | --- | --- |
| `POST /api/v1/auth/resend-verification` | API | Re-send the signup OTP (anti-enumeration, rate-limited) |
| `POST /api/v1/auth/session` | API | Exchange a Supabase session (OAuth PKCE / OTP) for app cookies |
| `/verify-email` | Web | 6-digit OTP entry, states, resend cooldown, change email |
| `/auth/callback` | Web | OAuth PKCE code exchange + error handling |

---

## 9. Troubleshooting

| Symptom | Cause | Fix |
| --- | --- | --- |
| "Unable to sign in with this provider" on click | Provider not enabled / wrong secret in Supabase dashboard | Re-check sections 3-4 |
| OAuth redirects but callback shows invalid link | Redirect URL not allow-listed, or Site URL mismatch | Section 2 step 5 |
| "This verification code has expired" | OTP older than 10 minutes | Request a new code (Resend) |
| "Too many verification attempts" | Attempt/resend limits reached | Wait, then resend; limits reset per GoTrue policy |
| Verification email never arrives | "Confirm email" disabled, template not saved, provider quota, or the SMTP provider restricts recipients (see Â§2 "SMTP provider recipient restriction") | Section 2 steps 1-3; confirm the recipient is the provider account owner's address; check Supabase Auth logs |
| Email shows a broken logo image | Development Site URL is localhost (inbox cannot load it) | Expected locally; set the production Site URL |
| Login says "verify your email before signing in" | Account created before "Confirm email" was enabled | Use the "Verify your email" link on the login page |
| "Account profile not found" right after verifying | The user genuinely has no `profiles` row (trigger failed, or the row was deleted); infrastructure faults surface as "Profile service is unavailable" instead (see §10) | Re-apply `database/migrations/0008_service_role_grants.sql` (it backfills profiles); check the `on_auth_user_created` trigger is enabled |
| Template edits rejected (HTTP 400 "not available for free tier") | Free-tier project on the built-in email provider | Configure custom SMTP (Settings -> Auth -> SMTP) or upgrade to Pro, then paste the template |

---

## 10. Bootstrap failure semantics & database privileges (05 Sep 2026)

After email verification the app resolves: authenticated user → `profiles` row → `pharmacy_memberships` → `pharmacies`. Failure classes are intentionally distinct — the API never collapses them into one message:

| Message | Meaning | Where |
| --- | --- | --- |
| `Account profile not found` (401) | The authenticated user genuinely has no `profiles` row (trigger missing/failed, or profile deleted) | `loadUserContext` / `requireAuth` |
| `Profile service is unavailable` (502) | The profiles lookup failed for an infrastructure reason (privileges, network) — logged as `profile_lookup_failed` with the PostgREST code | same |
| `No active pharmacy membership` (403) | Profile exists, but no ACTIVE membership — the normal pre-onboarding state | `resolvePharmacyContext` |
| `Session expired. Please sign in again.` (401) | Refresh token missing/invalid on `/auth/refresh` | `refreshSession` |

Migration `database/migrations/0008_service_role_grants.sql` (mirrored in `apply-all-migrations.sql`) fixes the post-verification bootstrap:

- Grants the API's `service_role` its DML privileges (schema usage, all tables, sequences, functions). Previously every table showed only the schema-inherited `REFERENCES/TRIGGER/TRUNCATE`, so every profiles/memberships lookup failed with PostgREST 42501 and was surfaced as a misleading "Account profile not found".
- Restores the canonical `create_pharmacy_with_membership(p_user_id, ...)` definition (0003) — a drifted 5-arg live variant resolved `auth.uid()` internally, which is always NULL under the service key, making onboarding impossible.
- Locks that RPC to `service_role` only (revoke from `public`/`anon`/`authenticated`). RLS helpers (`is_active_member`, `has_any_role`) and `handle_new_user` keep their default PUBLIC execute — RLS policies depend on it; never blanket-revoke functions.
- Backfills missing `profiles` rows from `auth.users` (idempotent, `on conflict do nothing`).

Client roles (`anon`/`authenticated`) intentionally hold NO table grants: the frontend performs zero direct table access (all data flows through the API), and RLS stays enabled on all 17 tables as the defense-in-depth gate.
