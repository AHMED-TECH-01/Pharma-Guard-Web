# PharmaGuard --- Build Plan

## 1. Mandatory Agent Workflow

The application must be built **piece by piece, phase by phase**.

An AI agent must not attempt to generate the entire application in one
uncontrolled operation.

For every phase:

``` text
Inspect
→ Plan
→ Implement
→ Run checks
→ Fix
→ Regression test
→ Update progress
→ Continue
```

------------------------------------------------------------------------

## Phase 0 --- Discovery

### Goal

Understand the existing repository before changing it.

### Tasks

-   Inspect all source files.
-   Inspect package manifests.
-   Inspect existing routes.
-   Inspect Supabase setup.
-   Inspect migrations.
-   Inspect environment files.
-   Inspect existing UI components.
-   Inspect current tests.
-   Build dependency chart.

### Deliverables

-   Architecture understanding.
-   Feature inventory.
-   Existing-route inventory.
-   Risk list.

### Do not

-   Rewrite the application.
-   Delete files.
-   Replace dependencies.

------------------------------------------------------------------------

## Phase 1 --- Foundation

### Tasks

-   Establish frontend/backend separation.
-   Configure environment validation.
-   Connect Supabase.
-   Configure authentication.
-   Create database migrations.
-   Enable RLS.
-   Add CORS.
-   Add security headers.
-   Add rate limiting.
-   Add error middleware.
-   Create shared types.
-   Create design tokens.
-   Create app shell.

### Acceptance

-   User can authenticate.
-   Backend can verify session.
-   Tenant isolation works.
-   Secrets are not exposed.
-   Shell matches reference.

------------------------------------------------------------------------

## Phase 2 --- Public Pages

Build:

-   Landing.
-   Login.
-   Sign Up.
-   Forgot Password.
-   Reset Password.
-   Pricing.
-   404. 
-   500. 

Add:

-   Form validation.
-   Skeletons where applicable.
-   Error states.
-   Responsive layouts.

------------------------------------------------------------------------

## Phase 3 --- Dashboard

Build exact reference composition:

-   Sidebar.
-   Header.
-   Greeting.
-   KPI cards.
-   Sales chart.
-   Expiry donut.
-   Stock status.
-   Low stock.
-   Expiring soon.
-   Recent sales.

Then add:

-   AI daily summary.
-   Action center.

------------------------------------------------------------------------

## Phase 4 --- Inventory

Build:

-   Medicine schema.
-   Batch schema.
-   Inventory API.
-   Inventory table.
-   Search.
-   Filters.
-   Sorting.
-   Pagination.
-   Medicine detail.
-   Stock adjustment.
-   Duplicate detection.

------------------------------------------------------------------------

## Phase 5 --- AI OCR

Build:

-   Upload zone.
-   File validation.
-   Backend OCR endpoint.
-   Gemini integration.
-   Structured output.
-   Confidence.
-   Review screen.
-   Manual correction.
-   Confirmation.
-   OCR history.

No direct camera.

------------------------------------------------------------------------

## Phase 6 --- Expiry and Safety

Build:

-   Expiry engine.
-   Expiry Center.
-   Status cards.
-   Expiry table.
-   FEFO.
-   Alerts.
-   Quarantine.
-   Recall Center.

------------------------------------------------------------------------

## Phase 7 --- Sales

Build:

-   New sale.
-   Batch selection.
-   FEFO recommendation.
-   Stock decrement.
-   Sale history.
-   Sale reversal.
-   Audit events.

------------------------------------------------------------------------

## Phase 8 --- Purchases and Suppliers

Build:

-   Purchase receiving.
-   Supplier records.
-   Purchase history.
-   Stock increment.
-   Supplier detail.

------------------------------------------------------------------------

## Phase 9 --- Returns and Reorders

Build:

-   Returns.
-   Return workflow.
-   Reorder prediction.
-   Stockout prediction.
-   Recommended quantity.
-   Reorder history.

------------------------------------------------------------------------

## Phase 10 --- Analytics

Build:

-   Sales trends.
-   Fast movers.
-   Slow movers.
-   Dead stock.
-   Overstock.
-   Inventory valuation.
-   Expiry exposure.
-   Margins.
-   Pharmacy health score.

------------------------------------------------------------------------

## Phase 11 --- Reports and Compliance

Build:

-   Reports.
-   PDF/CSV exports.
-   Compliance support page.
-   Audit timeline.
-   User activity.

Important:

The app must not state that generated records are official DRAP
certification unless independently validated and legally approved.

------------------------------------------------------------------------

## Phase 12 --- Admin

Build:

-   Users.
-   Roles.
-   Permissions.
-   Settings.
-   Notification preferences.
-   Security settings.
-   Appearance settings.

------------------------------------------------------------------------

## Phase 13 --- Security Hardening

Checklist:

-   [ ] No secrets in frontend.
-   [ ] No secret keys in Git.
-   [ ] RLS enabled everywhere.
-   [ ] RLS policies tested.
-   [ ] Backend authorization tested.
-   [ ] CORS restricted.
-   [ ] Rate limits active.
-   [ ] Input validation complete.
-   [ ] File upload secured.
-   [ ] SQL injection protection.
-   [ ] XSS protection.
-   [ ] CSRF strategy reviewed.
-   [ ] Security headers.
-   [ ] Error leakage removed.
-   [ ] Dependency audit.
-   [ ] Authentication abuse protection.

------------------------------------------------------------------------

## Phase 14 --- QA

### Functional

Test every route.

### Responsive

Test:

-   320px.
-   375px.
-   768px.
-   1024px.
-   1280px.
-   1440px+.

### E2E

Test:

``` text
Signup
→ Onboarding
→ Login
→ OCR
→ Inventory
→ Sale
→ Alert
→ Reorder
→ Logout
```

------------------------------------------------------------------------

## Phase 15 --- Release

-   Production build.
-   Environment verification.
-   Database migration verification.
-   Seed demo data.
-   Monitoring.
-   Error tracking.
-   Backup.
-   Smoke tests.

------------------------------------------------------------------------

## AI Agent Stop Conditions

An agent must stop and ask for clarification rather than guessing when:

-   A required package is missing and cannot be safely selected.
-   Database schema conflicts with existing production data.
-   An existing feature would need destructive migration.
-   Credentials are unavailable.
-   A UI requirement conflicts with an existing explicit product rule.
-   A security requirement cannot be safely implemented.
