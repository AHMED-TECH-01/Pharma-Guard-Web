# PharmaGuard --- Architecture Guide

## 1. Purpose

This document is the mandatory architecture contract for every AI coding
agent working on PharmaGuard.

PharmaGuard is a **web-only, responsive, multi-tenant pharmacy SaaS**.
It must reproduce the supplied PharmaGuard UI reference as closely as
practical while adding production-grade backend integration, security,
loading/skeleton states, validation, and maintainable architecture.

### Non-negotiable principles

1.  Frontend and backend are strictly separated.
2.  No server secrets are shipped to the browser.
3.  Supabase is the database/auth platform.
4.  Row-Level Security (RLS) is mandatory on every application table.
5.  Backend authorization is mandatory even when RLS exists.
6.  Every mutation is validated on the backend.
7.  Every API endpoint is rate-limited according to risk.
8.  CORS allows only trusted application origins.
9.  AI/OCR results are suggestions until the user confirms them.
10. Never replace working features with a shortcut while fixing another
    feature.
11. Work phase-by-phase and finish validation before moving to the next
    phase.
12. Do not invent packages, APIs, database columns, routes, or UI
    components that are not supported by the project specification.

------------------------------------------------------------------------

## 2. Reference UI Contract

The uploaded UI reference is the visual source of truth.

The reference contains these compositions:

-   Login page.
-   Sign-up page.
-   Main dashboard.
-   Logout confirmation modal.
-   AI Scan / OCR upload page.
-   All Medicines / Inventory page.
-   Expiry Center.
-   Sales Management.
-   Suppliers Management.
-   Returns Management.
-   Alerts Center.
-   Reports & Analytics.
-   404 page.
-   500 page.

Additional required pages from the product specification:

-   Landing page.
-   Pricing page.
-   Forgot Password.
-   Reset Password.
-   Onboarding.
-   Purchases.
-   Reorders.
-   Quarantine.
-   Recall Center.
-   Compliance & Audit.
-   Reports.
-   Users.
-   Settings.
-   Profile.
-   Notification settings.
-   Security settings.
-   Appearance settings.

The visual language must remain consistent with the reference:

-   White/light surfaces.
-   Deep teal pharmacy sidebar.
-   Green primary actions.
-   Red danger actions.
-   Compact dashboard cards.
-   Rounded cards.
-   Thin borders.
-   Small shadows.
-   Dense but readable pharmacy tables.
-   Clear status pills.
-   Professional healthcare SaaS appearance.
-   Same general information hierarchy and sidebar layout.

Do not redesign the application into a different visual identity merely
because a newer UI trend exists.

------------------------------------------------------------------------

## 3. System Architecture

``` text
Browser
  |
  | HTTPS
  v
Next.js / React Web
  |
  | authenticated API requests
  v
Node.js / Express API
  |
  +------------------------+
  |                        |
  v                        v
Supabase PostgreSQL     Gemini Vision
  |                        |
  +--> RLS                 |
  +--> DB transactions     |
  +--> indexes             |
  +--> audit data          |
                           v
                    OCR structured result
                           |
                           v
                    Backend validation
                           |
                           v
                     Frontend review
                           |
                           v
                    User confirmation
```

### Important

The browser must never directly receive:

-   Supabase secret/service-role credentials.
-   Gemini private API key.
-   Payment provider secret keys.
-   Email/SMS provider secrets.
-   Database connection strings.
-   JWT signing secrets.
-   Server encryption keys.

The browser may use the Supabase **publishable** client key where the
chosen Supabase architecture requires it. Security must come from RLS,
authentication, and backend authorization---not from hiding a
publishable key.

------------------------------------------------------------------------

## 4. Frontend

Recommended:

-   Next.js.
-   React.
-   TypeScript.
-   Tailwind CSS or the project's established CSS system.
-   Accessible component primitives.
-   Recharts for analytics if already installed/verified.
-   Supabase browser client only for explicitly approved public/auth
    operations.

The frontend owns:

-   Rendering.
-   Client interaction.
-   Form state.
-   UI state.
-   Loading/skeleton states.
-   Optimistic UI only where safe.
-   Client-side validation for user experience.
-   Calling backend APIs.
-   Displaying backend results.

The frontend does **not** own:

-   Authorization decisions.
-   Secret credentials.
-   Pricing enforcement.
-   Inventory truth.
-   Stock mutation logic.
-   RLS bypass.
-   AI approval decisions.

------------------------------------------------------------------------

## 5. Backend

Recommended:

-   Node.js.
-   Express.
-   TypeScript.
-   Zod or another verified validation library.
-   Supabase server client using secret credentials only on the server.
-   Structured error middleware.
-   Rate limiting middleware.
-   Strict CORS.

The backend owns:

-   Authentication verification.
-   Authorization.
-   Tenant resolution.
-   Validation.
-   Inventory business rules.
-   Sales transactions.
-   Purchase transactions.
-   Expiry calculations.
-   FEFO.
-   Reorder calculations.
-   AI orchestration.
-   Audit logging.
-   Report generation.
-   Subscription enforcement.
-   Security controls.

------------------------------------------------------------------------

## 6. Supabase

Supabase PostgreSQL is the primary persistent database.

Supabase Auth is used for:

-   Sign up.
-   Sign in.
-   Session management.
-   Password reset.
-   Signup email verification (6-digit OTP code entry; no OAuth
    providers).

### Approved browser (public/auth) Supabase operations

The browser Supabase client (publishable key, `persistSession: false`) is
approved for these public auth operations only:

-   Password-recovery PKCE exchange (reset password completion).
-   Signup OTP verification via `verifyOtp({ type: 'signup', email, token })`
    (page `/verify-email`).
-   Signup confirmation token-hash exchange via
    `verifyOtp({ type: 'signup', tokenHash })` (page `/auth/confirm`),
    kept as the link-template fallback.

In every case the resulting session is handed to the backend endpoint
`POST /api/v1/auth/session`, which re-validates the access token with
`auth.getUser()` server-side before issuing the HttpOnly application
cookies. The browser never persists a Supabase session.

### Signup verification-code ownership

The signup verification code is generated, hashed, stored, expired
(10 minutes), and attempt-limited by GoTrue (Supabase Auth); the browser
submits only the email address and the 6-digit code to `verifyOtp`. The
application stores no code data and requires no code table; branded
delivery uses the Supabase Auth email template with Gmail SMTP (see
docs/auth-setup.md and docs/email-templates/confirm-signup.html). If the
dashboard template is switched to the link pattern, `/auth/confirm`
performs the equivalent token-hash exchange instead.

Every pharmacy-owned table must support tenant isolation.

### Recommended tenant model

``` text
auth.users
    |
    v
profiles
    |
    v
pharmacy_memberships
    |
    +---- pharmacies
    |
    +---- medicines
    |
    +---- batches
    +---- sales
    +---- purchases
    +---- alerts
    +---- suppliers
    +---- returns
    +---- quarantine
    +---- recalls
    +---- audit_logs
```

Do not assume every row should literally contain `user_id` if the
business entity belongs to a pharmacy. Use a membership-based tenant
policy where appropriate.

------------------------------------------------------------------------

## 7. RLS Requirements

Enable RLS on **every application table**.

Policies must ensure a user can only access data belonging to pharmacies
where they have an authorized membership.

Example conceptual policy:

``` sql
USING (
  EXISTS (
    SELECT 1
    FROM pharmacy_memberships pm
    WHERE pm.pharmacy_id = table_name.pharmacy_id
      AND pm.user_id = auth.uid()
      AND pm.status = 'active'
  )
)
```

Write separate policies for:

-   SELECT.
-   INSERT.
-   UPDATE.
-   DELETE.

Do not rely only on frontend filtering.

For sensitive operations, backend authorization should additionally
verify:

``` text
authenticated user
    +
active pharmacy membership
    +
required permission
```

------------------------------------------------------------------------

## 8. Secret Management

The supplied Supabase secret key is sensitive. **Do not commit it to the
repository, Markdown files, frontend code, screenshots, Git history, or
AI prompts used for code generation. Rotate it if it has been exposed
outside the intended secure environment.**

Use:

``` text
.env
.env.local
```

and commit only:

``` text
.env.example
```

with placeholders.

Example:

``` env
SUPABASE_URL=https://<project>.supabase.co
SUPABASE_PUBLISHABLE_KEY=<publishable-key>
SUPABASE_SECRET_KEY=<server-only-secret>
SUPABASE_JWKS_URL=https://<project>.supabase.co/auth/v1/.well-known/jwks.json
```

Never use:

``` env
NEXT_PUBLIC_SUPABASE_SECRET_KEY=
```

Never prefix a secret with `NEXT_PUBLIC_`.

------------------------------------------------------------------------

## 9. Request Flow

### Read

``` text
UI
→ API
→ authenticate
→ authorize
→ validate query
→ tenant scope
→ Supabase query
→ RLS
→ response
→ UI
```

### Mutation

``` text
UI
→ API
→ authentication
→ authorization
→ validation
→ business rule validation
→ transaction
→ database
→ audit log
→ response
→ UI refresh
```

------------------------------------------------------------------------

## 10. AI/OCR Flow

``` text
User selects image
→ Frontend validates type/size
→ Backend receives multipart upload
→ Backend validates file
→ Temporary/private storage
→ Gemini Vision request
→ Structured extraction
→ Backend normalizes fields
→ Backend validates fields
→ Frontend displays review
→ User edits if needed
→ User confirms
→ Backend creates medicine/batch
→ Audit log
```

No AI result may automatically become authoritative inventory data.

------------------------------------------------------------------------

## 11. Error Boundary

Every major route needs:

-   Loading state.
-   Empty state.
-   Error state.
-   Retry action.
-   Unauthorized state where relevant.

A backend error must not expose:

-   Stack traces.
-   Database SQL.
-   API keys.
-   Internal file paths.
-   Provider secrets.

------------------------------------------------------------------------

## 12. Phase-Based Development

Agents must build in this order:

### Phase 0 --- Repository inspection

Do not write application code.

Inspect:

-   Existing files.
-   Existing routes.
-   Existing dependencies.
-   Existing database migrations.
-   Existing environment configuration.
-   Existing components.
-   Existing tests.

Produce a dependency/feature map.

### Phase 1 --- Foundation

-   Project structure.
-   Environment validation.
-   Supabase connection.
-   Authentication.
-   App shell.
-   Global design tokens.
-   Error handling.
-   Security middleware.

### Phase 2 --- Public UI

-   Landing.
-   Login.
-   Sign-up.
-   Forgot password.
-   Pricing.
-   Error pages.

### Phase 3 --- Dashboard

-   Sidebar.
-   Header.
-   KPI cards.
-   Charts.
-   Recent alerts.
-   Skeleton loaders.
-   Responsive behavior.

### Phase 4 --- Inventory

-   Medicines.
-   Batches.
-   Search.
-   Filters.
-   Add/edit.
-   Batch history.
-   Import/export.

### Phase 5 --- AI Scan

-   Upload.
-   OCR.
-   Review.
-   Confirmation.
-   Error handling.

### Phase 6 --- Safety Operations

-   Expiry Center.
-   FEFO.
-   Alerts.
-   Quarantine.
-   Recall.

### Phase 7 --- Commercial Operations

-   Sales.
-   Purchases.
-   Suppliers.
-   Returns.
-   Reorders.

### Phase 8 --- Analytics

-   Reports.
-   Analytics.
-   Stock valuation.
-   Expiry exposure.
-   Dead stock.
-   Overstock.
-   Health score.

### Phase 9 --- Security hardening

-   RLS audit.
-   Authorization audit.
-   Rate-limit audit.
-   CORS audit.
-   Input validation audit.
-   Secret scan.
-   Dependency audit.

### Phase 10 --- QA and release

-   Unit tests.
-   Integration tests.
-   E2E tests.
-   Responsive tests.
-   Accessibility checks.
-   Production build.
-   Demo seed data.

------------------------------------------------------------------------

## 13. Regression Protection

Before changing existing logic:

1.  Read the relevant feature.
2.  Trace imports and dependencies.
3.  Identify API consumers.
4.  Identify database tables affected.
5.  Identify shared components affected.
6.  Write a hidden regression checklist.
7.  Make the smallest safe change.
8.  Run typecheck.
9.  Run tests.
10. Verify dependent pages.
11. Verify responsive UI.
12. Only then declare the fix complete.

Never patch one page blindly.
