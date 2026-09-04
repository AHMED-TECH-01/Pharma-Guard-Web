# PharmaGuard --- Technical Requirements Document (TRD)

**Version:** 1.0\
**Date:** 03 September 2026\
**Architecture:** Responsive web SaaS\
**Frontend:** Next.js + React + TypeScript\
**Backend:** Node.js + Express\
**Database:** PostgreSQL\
**AI/OCR:** Gemini Vision API or equivalent\
**Charts:** Recharts or equivalent

------------------------------------------------------------------------

## 1. Technical Architecture

``` text
                     Browser
          Desktop / Tablet / Mobile
                         |
                         v
                Next.js Web App
                         |
                  HTTPS / REST
                         |
                         v
                 Node.js / Express
                         |
        +----------------+----------------+
        |                |                |
        v                v                v
   PostgreSQL       AI/OCR Service    Notification
        |             Gemini Vision      Service
        |                                  |
        +----------------+-----------------+
                         |
                    Audit / Logs
```

The application is web-only.

There is no direct camera dependency. Users upload medicine images
through a standard file picker or drag-and-drop interface.

------------------------------------------------------------------------

## 2. Recommended Repository Structure

``` text
pharmaguard/
├── apps/
│   ├── web/
│   │   ├── app/
│   │   │   ├── (public)/
│   │   │   │   ├── page.tsx
│   │   │   │   ├── pricing/
│   │   │   │   ├── login/
│   │   │   │   ├── signup/
│   │   │   │   └── forgot-password/
│   │   │   ├── (dashboard)/
│   │   │   │   ├── dashboard/
│   │   │   │   ├── inventory/
│   │   │   │   ├── ai-scan/
│   │   │   │   ├── expiry/
│   │   │   │   ├── sales/
│   │   │   │   ├── purchases/
│   │   │   │   ├── reorders/
│   │   │   │   ├── suppliers/
│   │   │   │   ├── returns/
│   │   │   │   ├── quarantine/
│   │   │   │   ├── recalls/
│   │   │   │   ├── analytics/
│   │   │   │   ├── alerts/
│   │   │   │   ├── compliance/
│   │   │   │   ├── reports/
│   │   │   │   ├── users/
│   │   │   │   └── settings/
│   │   │   ├── 404.tsx
│   │   │   └── error.tsx
│   │   ├── components/
│   │   ├── features/
│   │   ├── hooks/
│   │   ├── lib/
│   │   ├── services/
│   │   ├── styles/
│   │   └── types/
│   │
│   └── api/
│       ├── src/
│       │   ├── modules/
│       │   │   ├── auth/
│       │   │   ├── pharmacies/
│       │   │   ├── users/
│       │   │   ├── medicines/
│       │   │   ├── batches/
│       │   │   ├── sales/
│       │   │   ├── purchases/
│       │   │   ├── suppliers/
│       │   │   ├── alerts/
│       │   │   ├── recalls/
│       │   │   ├── quarantine/
│       │   │   ├── returns/
│       │   │   ├── analytics/
│       │   │   ├── reports/
│       │   │   └── audit/
│       │   ├── middleware/
│       │   ├── config/
│       │   ├── database/
│       │   ├── utils/
│       │   └── server.ts
│       └── tests/
│
├── packages/
│   ├── ui/
│   ├── validation/
│   └── types/
│
├── database/
│   ├── migrations/
│   └── seed/
│
├── docs/
├── .env.example
└── README.md
```

------------------------------------------------------------------------

## 3. Database Design

PostgreSQL is the primary system of record.

### pharmacies

``` sql
id UUID PRIMARY KEY
name VARCHAR(255) NOT NULL
owner_name VARCHAR(255)
phone VARCHAR(50)
email VARCHAR(255)
address TEXT
created_at TIMESTAMP NOT NULL
updated_at TIMESTAMP NOT NULL
```

### users

``` sql
id UUID PRIMARY KEY
pharmacy_id UUID NOT NULL
name VARCHAR(255) NOT NULL
email VARCHAR(255) UNIQUE NOT NULL
password_hash TEXT
phone VARCHAR(50)
role VARCHAR(30) NOT NULL
created_at TIMESTAMP NOT NULL
updated_at TIMESTAMP NOT NULL
```

Roles:

``` text
OWNER
MANAGER
PHARMACIST
STAFF
```

### medicines

``` sql
id UUID PRIMARY KEY
pharmacy_id UUID NOT NULL
name VARCHAR(255) NOT NULL
generic_name VARCHAR(255)
strength VARCHAR(100)
dosage_form VARCHAR(100)
manufacturer VARCHAR(255)
barcode VARCHAR(100)
category VARCHAR(100)
reorder_level NUMERIC NOT NULL DEFAULT 0
safety_stock NUMERIC NOT NULL DEFAULT 0
purchase_price NUMERIC(12,2)
selling_price NUMERIC(12,2)
created_at TIMESTAMP NOT NULL
updated_at TIMESTAMP NOT NULL
```

### batches

``` sql
id UUID PRIMARY KEY
medicine_id UUID NOT NULL
pharmacy_id UUID NOT NULL
batch_no VARCHAR(100) NOT NULL
manufacturing_date DATE
expiry_date DATE NOT NULL
quantity INTEGER NOT NULL DEFAULT 0
received_date DATE
purchase_price NUMERIC(12,2)
supplier_id UUID
status VARCHAR(30) NOT NULL
created_at TIMESTAMP NOT NULL
updated_at TIMESTAMP NOT NULL
```

Unique recommendation:

``` text
UNIQUE(pharmacy_id, medicine_id, batch_no)
```

### sales

``` sql
id UUID PRIMARY KEY
pharmacy_id UUID NOT NULL
user_id UUID NOT NULL
medicine_id UUID NOT NULL
batch_id UUID NOT NULL
quantity INTEGER NOT NULL
unit_price NUMERIC(12,2) NOT NULL
total_amount NUMERIC(12,2) NOT NULL
sold_at TIMESTAMP NOT NULL
note TEXT
reversed_at TIMESTAMP
```

### purchases

``` sql
id UUID PRIMARY KEY
pharmacy_id UUID NOT NULL
supplier_id UUID
invoice_no VARCHAR(100)
received_at TIMESTAMP NOT NULL
created_by UUID NOT NULL
```

### purchase_items

``` sql
id UUID PRIMARY KEY
purchase_id UUID NOT NULL
medicine_id UUID NOT NULL
batch_id UUID NOT NULL
quantity INTEGER NOT NULL
unit_cost NUMERIC(12,2) NOT NULL
```

### suppliers

``` sql
id UUID PRIMARY KEY
pharmacy_id UUID NOT NULL
name VARCHAR(255) NOT NULL
phone VARCHAR(50)
email VARCHAR(255)
address TEXT
created_at TIMESTAMP NOT NULL
updated_at TIMESTAMP NOT NULL
```

### alerts

``` sql
id UUID PRIMARY KEY
pharmacy_id UUID NOT NULL
medicine_id UUID
batch_id UUID
type VARCHAR(50) NOT NULL
severity VARCHAR(20) NOT NULL
title VARCHAR(255) NOT NULL
message TEXT NOT NULL
status VARCHAR(20) NOT NULL
created_at TIMESTAMP NOT NULL
resolved_at TIMESTAMP
```

### recalls

``` sql
id UUID PRIMARY KEY
pharmacy_id UUID NOT NULL
medicine_id UUID
batch_no VARCHAR(100)
manufacturer VARCHAR(255)
reason TEXT
status VARCHAR(30)
created_at TIMESTAMP NOT NULL
```

### quarantine_items

``` sql
id UUID PRIMARY KEY
pharmacy_id UUID NOT NULL
batch_id UUID NOT NULL
quantity INTEGER NOT NULL
reason VARCHAR(255) NOT NULL
status VARCHAR(30) NOT NULL
created_by UUID NOT NULL
created_at TIMESTAMP NOT NULL
```

### returns

``` sql
id UUID PRIMARY KEY
pharmacy_id UUID NOT NULL
supplier_id UUID
batch_id UUID NOT NULL
quantity INTEGER NOT NULL
reason VARCHAR(100) NOT NULL
status VARCHAR(30) NOT NULL
return_date DATE
created_by UUID NOT NULL
```

### audit_logs

``` sql
id UUID PRIMARY KEY
pharmacy_id UUID NOT NULL
user_id UUID
action VARCHAR(100) NOT NULL
entity_type VARCHAR(100) NOT NULL
entity_id UUID
before_data JSONB
after_data JSONB
created_at TIMESTAMP NOT NULL
ip_hash_or_metadata JSONB
```

### ocr_scans

``` sql
id UUID PRIMARY KEY
pharmacy_id UUID NOT NULL
user_id UUID NOT NULL
file_reference TEXT
extracted_data JSONB
confidence NUMERIC(5,2)
status VARCHAR(30)
created_at TIMESTAMP NOT NULL
```

------------------------------------------------------------------------

## 4. Multi-Tenant Data Isolation

Every pharmacy-owned table must contain `pharmacy_id` directly or be
safely reachable through a pharmacy-owned parent.

Every query must enforce the authenticated pharmacy context.

Example:

``` text
WHERE pharmacy_id = authenticated_user.pharmacy_id
```

Never trust a client-provided pharmacy ID.

If PostgreSQL Row Level Security is used, policies must enforce tenant
isolation.

------------------------------------------------------------------------

## 5. Authentication Architecture

Recommended:

-   Short-lived access token.
-   Secure refresh/session mechanism.
-   HttpOnly cookies where appropriate.
-   Password hashing using Argon2id or bcrypt.
-   Email verification.
-   Password reset tokens with expiry.
-   Login rate limiting.

Never store plaintext passwords.

------------------------------------------------------------------------

## 6. Authorization

Authorization middleware:

``` text
authenticate()
authorize(role[])
```

Example:

``` text
Owner:
    *
Manager:
    inventory, sales, purchases, suppliers,
    returns, analytics, reports

Pharmacist:
    inventory, sales, expiry, quarantine,
    returns

Staff:
    inventory-read, sales
```

Actual permissions should be represented as capabilities where possible.

------------------------------------------------------------------------

## 7. API Design

Base:

``` text
/api/v1
```

### Auth

``` text
POST   /auth/signup
POST   /auth/login
POST   /auth/logout
POST   /auth/forgot-password
POST   /auth/reset-password
GET    /auth/me
```

### Medicines

``` text
GET    /medicines
POST   /medicines
GET    /medicines/:id
PATCH  /medicines/:id
DELETE /medicines/:id
```

### Batches

``` text
GET    /medicines/:id/batches
POST   /medicines/:id/batches
PATCH  /batches/:id
POST   /batches/:id/adjust
```

### OCR

``` text
POST /ocr/scan
GET  /ocr/scans
GET  /ocr/scans/:id
```

### Sales

``` text
POST /sales
GET  /sales
POST /sales/:id/reverse
```

### Purchases

``` text
POST /purchases
GET  /purchases
GET  /purchases/:id
```

### Alerts

``` text
GET  /alerts
POST /alerts/:id/read
POST /alerts/:id/resolve
POST /alerts/:id/snooze
```

### Analytics

``` text
GET /analytics/overview
GET /analytics/sales
GET /analytics/inventory
GET /analytics/expiry
GET /analytics/reorders
```

------------------------------------------------------------------------

## 8. OCR Pipeline

``` text
Browser
   |
   | multipart upload
   v
API
   |
   +--> Validate MIME type
   +--> Validate file size
   +--> Virus/security validation
   |
   v
Temporary/Object Storage
   |
   v
Gemini Vision
   |
   v
Structured OCR Result
   |
   v
Validation / Normalization
   |
   v
Frontend Review
   |
   v
User Confirmation
   |
   v
Medicine + Batch Creation
```

Suggested OCR output:

``` json
{
  "medicineName": "Panadol 500mg",
  "genericName": "Paracetamol",
  "strength": "500mg",
  "dosageForm": "Tablet",
  "manufacturer": "Example",
  "batchNumber": "PND48291",
  "manufacturingDate": "2024-11-01",
  "expiryDate": "2026-11-01",
  "confidence": {
    "medicineName": 0.96,
    "batchNumber": 0.91,
    "expiryDate": 0.98
  }
}
```

The AI output must be considered unverified until user confirmation.

------------------------------------------------------------------------

## 9. File Security

For uploaded medicine images:

-   Allow only expected image MIME types.
-   Limit file size.
-   Generate server-side file identifiers.
-   Do not trust filenames.
-   Store outside executable web root.
-   Scan where infrastructure supports it.
-   Use signed/private URLs when object storage is used.
-   Delete temporary files after processing according to retention
    policy.

------------------------------------------------------------------------

## 10. Expiry Calculation

Use server time as the source of truth.

``` ts
daysToExpiry = differenceInCalendarDays(
  expiryDate,
  today
);
```

Status:

``` ts
if (daysToExpiry < 0) {
  status = "EXPIRED";
} else if (daysToExpiry <= 30) {
  status = "CRITICAL";
} else if (daysToExpiry <= 90) {
  status = "WARNING";
} else {
  status = "SAFE";
}
```

Make thresholds configurable.

------------------------------------------------------------------------

## 11. Reorder Algorithm

Basic MVP:

``` text
observation_days = selected historical period

average_daily_sales =
    total_units_sold / observation_days

lead_time_demand =
    average_daily_sales * supplier_lead_time_days

recommended_stock =
    lead_time_demand + safety_stock

recommended_order =
    max(0, recommended_stock - current_stock)
```

If the product has insufficient sales history:

``` text
Recommendation:
Insufficient sales history.
Enter supplier lead time or collect more sales data.
```

Do not fabricate a prediction.

------------------------------------------------------------------------

## 12. FEFO Algorithm

For a medicine:

``` text
SELECT batches
WHERE quantity > 0
AND status NOT IN ('QUARANTINED', 'RETURNED')
ORDER BY expiry_date ASC
```

Recommend the earliest valid expiry batch.

Never recommend an expired batch for sale.

------------------------------------------------------------------------

## 13. Inventory Transactions

Inventory mutations must be atomic.

### Sale

``` text
BEGIN
  Lock batch row
  Verify available quantity
  Decrease quantity
  Create sale
  Create audit log
COMMIT
```

### Purchase

``` text
BEGIN
  Create/update batch
  Increase quantity
  Create purchase item
  Create audit log
COMMIT
```

### Return

``` text
BEGIN
  Lock batch
  Verify quantity
  Decrease available quantity
  Create return
  Create audit log
COMMIT
```

------------------------------------------------------------------------

## 14. Dashboard Queries

Dashboard should aggregate:

-   Total inventory value.
-   Expiring batches.
-   Expired batches.
-   Low-stock medicines.
-   Out-of-stock medicines.
-   Today's sales.
-   Recent alerts.
-   Sales trend.
-   Stock distribution.

Use optimized aggregation queries and indexes.

------------------------------------------------------------------------

## 15. Required Database Indexes

Recommended:

``` text
medicines(pharmacy_id)
medicines(pharmacy_id, name)
medicines(pharmacy_id, barcode)

batches(pharmacy_id, expiry_date)
batches(pharmacy_id, medicine_id)
batches(pharmacy_id, status)

sales(pharmacy_id, sold_at)
sales(medicine_id, sold_at)

alerts(pharmacy_id, status, created_at)

audit_logs(pharmacy_id, created_at)
```

------------------------------------------------------------------------

## 16. Frontend Architecture

Use feature-oriented components.

Example:

``` text
components/
├── ui/
│   ├── Button
│   ├── Input
│   ├── Modal
│   ├── Badge
│   ├── Table
│   ├── Card
│   ├── Toast
│   └── EmptyState
├── dashboard/
├── inventory/
├── ai-scan/
├── expiry/
├── sales/
├── analytics/
└── alerts/
```

Business logic should not be buried inside presentational components.

------------------------------------------------------------------------

## 17. State Management

Use:

-   Server state/query cache for API data.
-   Local state for forms and UI.
-   URL query parameters for filters/pagination where appropriate.

Do not put the entire application state into one global store.

------------------------------------------------------------------------

## 18. Form Validation

Use a shared schema library such as Zod.

Example:

``` ts
const medicineSchema = z.object({
  name: z.string().min(1),
  batchNo: z.string().min(1),
  expiryDate: z.coerce.date(),
  quantity: z.number().int().nonnegative()
});
```

Validate both client and server.

------------------------------------------------------------------------

## 19. Responsive Design System

Recommended breakpoints:

``` text
Mobile:  < 640px
Tablet:  640–1023px
Desktop: >= 1024px
Large:   >= 1280px
```

These are implementation defaults, not hard product requirements.

### Mobile

-   Collapsed navigation.
-   Cards instead of dense tables.
-   Full-width actions.
-   Bottom sheet modals.
-   Responsive charts.

### Desktop

-   Sidebar.
-   Multi-column dashboard.
-   Dense tables.
-   Persistent filters.

------------------------------------------------------------------------

## 20. UI Components

Required reusable components:

-   AppShell.
-   Sidebar.
-   Topbar.
-   Mobile navigation.
-   Breadcrumbs.
-   KPI Card.
-   Chart Card.
-   Data Table.
-   Medicine Card.
-   Status Badge.
-   Alert Card.
-   Modal.
-   Drawer.
-   Date Picker.
-   File Upload.
-   OCR Review Panel.
-   Confirmation Dialog.
-   Toast.
-   Skeleton.
-   Empty State.
-   Error State.
-   Pagination.
-   Filter Bar.

------------------------------------------------------------------------

## 21. Design Tokens

Use CSS variables/design tokens for:

``` text
background
foreground
surface
border
primary
success
warning
danger
info
muted
radius
shadow
spacing
typography
```

Do not hardcode colors throughout components.

------------------------------------------------------------------------

## 22. Page-Specific Technical Design

### Login

Routes:

``` text
/login
```

States:

``` text
idle
submitting
success
invalid
server-error
```

### Signup

``` text
/signup
```

After successful signup:

``` text
/signup → /onboarding
```

### Onboarding

Steps:

``` text
pharmacy-info
alert-preferences
inventory-import
complete
```

### Dashboard

``` text
/dashboard
```

Data should be fetched from aggregated dashboard endpoints where
possible.

### AI Scan

``` text
/ai-scan
```

Upload state machine:

``` text
idle
→ uploading
→ processing
→ review
→ confirmed
```

Error:

``` text
processing-error → retry/manual-entry
```

### Inventory

``` text
/inventory
/inventory/:id
/inventory/batches
/inventory/import
```

### Expiry

``` text
/expiry
```

Use server-calculated expiry status.

### Sales

``` text
/sales
/sales/new
```

### Purchases

``` text
/purchases
/purchases/new
```

### Reorders

``` text
/reorders
```

### Analytics

``` text
/analytics
```

Charts should be responsive.

### Alerts

``` text
/alerts
```

### Suppliers

``` text
/suppliers
/suppliers/:id
```

### Returns

``` text
/returns
```

### Quarantine

``` text
/quarantine
```

### Compliance

``` text
/compliance
/compliance/audit
```

### Reports

``` text
/reports
```

### Settings

``` text
/settings
/settings/profile
/settings/pharmacy
/settings/users
/settings/notifications
/settings/security
/settings/appearance
```

### Pricing

``` text
/pricing
```

------------------------------------------------------------------------

## 23. Error Strategy

Frontend must handle:

``` text
400 Bad Request
401 Unauthorized
403 Forbidden
404 Not Found
409 Conflict
422 Validation Error
429 Rate Limited
500 Server Error
502/503 External Service Error
```

OCR service failure should not create or modify inventory.

------------------------------------------------------------------------

## 24. Logging and Monitoring

Backend logs should include:

-   Request ID.
-   Endpoint.
-   Status code.
-   Duration.
-   Error code.
-   User ID when appropriate.
-   Pharmacy ID when appropriate.

Do not log:

-   Passwords.
-   Access tokens.
-   API secrets.
-   Full sensitive uploaded images.
-   Unnecessary personal information.

------------------------------------------------------------------------

## 25. Testing Strategy

### Unit Tests

Test:

-   Expiry calculation.
-   FEFO.
-   Stock calculations.
-   Reorder algorithm.
-   Risk score.
-   Validation.

### Integration Tests

Test:

-   Login.
-   Medicine creation.
-   Batch creation.
-   Sale transaction.
-   Purchase transaction.
-   Alerts.
-   OCR confirmation.

### E2E Tests

Critical journey:

``` text
Signup
→ Onboarding
→ Login
→ Upload OCR image
→ Review
→ Confirm
→ Inventory
→ Record sale
→ Alert
→ Reorder
→ Logout
```

### Responsive Testing

Verify:

-   320px.
-   375px.
-   768px.
-   1024px.
-   1280px.
-   1440px+.

------------------------------------------------------------------------

## 26. Security Checklist

-   [ ] HTTPS.
-   [ ] Secure cookies.
-   [ ] Password hashing.
-   [ ] CSRF protection where cookie auth requires it.
-   [ ] CORS configuration.
-   [ ] Rate limiting.
-   [ ] Input validation.
-   [ ] SQL injection protection.
-   [ ] XSS protection.
-   [ ] File upload validation.
-   [ ] Authorization middleware.
-   [ ] Tenant isolation.
-   [ ] Secret management.
-   [ ] Dependency updates.
-   [ ] Audit logs.
-   [ ] Secure error messages.

------------------------------------------------------------------------

## 27. Environment Variables

Example:

``` env
NODE_ENV=development

DATABASE_URL=
AUTH_SECRET=

GEMINI_API_KEY=

NEXT_PUBLIC_APP_URL=
API_BASE_URL=

STORAGE_BUCKET=
STORAGE_ACCESS_KEY=
STORAGE_SECRET_KEY=

EMAIL_API_KEY=
SMS_API_KEY=
```

Never commit real secrets.

------------------------------------------------------------------------

## 28. Deployment

### Frontend

Deploy Next.js to a production web platform.

### Backend

Deploy Node.js/Express to a production backend platform.

### Database

Use managed PostgreSQL.

### Storage

Use private object storage for uploaded OCR images when persistent
storage is required.

### CI/CD

Pipeline:

``` text
Push
 ↓
Lint
 ↓
Typecheck
 ↓
Unit Tests
 ↓
Build
 ↓
Integration/E2E Tests
 ↓
Deploy
```

------------------------------------------------------------------------

## 29. Backup and Recovery

Database:

-   Automated backups.
-   Point-in-time recovery where supported.

Uploaded files:

-   Retention policy.
-   Backup only when business requirements require it.

Audit data should not be casually deleted.

------------------------------------------------------------------------

## 30. Demo Seed Data

The hackathon demo should include:

-   100+ medicines.
-   Multiple batches.
-   Expired batches.
-   Critical batches.
-   Warning batches.
-   Safe batches.
-   Low-stock medicines.
-   Out-of-stock medicines.
-   Fast-moving medicines.
-   Slow-moving medicines.
-   Dead stock.
-   Overstock.
-   Sales history.
-   Purchase history.
-   Suppliers.
-   Alerts.
-   Returns.
-   Quarantine records.
-   Audit logs.

Provide a controlled:

``` text
Load Demo Pharmacy
```

operation for demonstrations.

------------------------------------------------------------------------

## 31. Performance Targets

Suggested targets:

-   Dashboard API p95 \< 500ms under normal demo-scale load.
-   Standard CRUD API p95 \< 400ms excluding external services.
-   OCR processing UX must provide immediate progress feedback.
-   Search should feel instant through debouncing and indexed queries.
-   Large inventory lists must use pagination.

External AI response time must not block the rest of the application.

------------------------------------------------------------------------

## 32. Subscription Architecture

For hackathon:

``` text
plan
- STARTER
- PROFESSIONAL
- PREMIUM
- ENTERPRISE
```

Store subscription separately from pharmacy data.

Future:

``` text
subscriptions
subscription_events
usage_metrics
billing_customers
```

Enforce plan limits server-side.

------------------------------------------------------------------------

## 33. AI Safety/Quality Requirements

AI must not:

-   Automatically approve medicine information.
-   Automatically delete inventory.
-   Automatically mark medicine safe for sale.
-   Invent missing batch/expiry values.
-   Override pharmacist corrections.

AI should:

-   Clearly indicate uncertainty.
-   Request confirmation.
-   Return structured data.
-   Provide useful extraction confidence.
-   Fall back to manual entry.

------------------------------------------------------------------------

## 34. Recommended Development Order

### Day 1

``` text
Project setup
Authentication
Database
Pharmacy/user model
Medicine/batch model
Responsive AppShell
Inventory CRUD
AI OCR upload
```

### Day 2

``` text
Expiry engine
Expiry Center
Alerts
Sales
Low-stock detection
FEFO
Reorder algorithm
Dashboard
```

### Day 3

``` text
Analytics
Suppliers
Returns
Quarantine
Audit
Pricing
Error pages
Demo seed data
Responsive polish
Testing
```

------------------------------------------------------------------------

## 35. Hackathon Demo Flow

The final demo should be:

``` text
Landing
  ↓
Login / Signup
  ↓
Dashboard
  ↓
AI Scan
  ↓
Upload medicine image
  ↓
AI extracts:
medicine + batch + expiry
  ↓
User confirms
  ↓
Inventory created
  ↓
Expiry risk detected
  ↓
FEFO recommendation
  ↓
Record sale
  ↓
Stock decreases
  ↓
Low-stock alert
  ↓
Stockout prediction
  ↓
Smart reorder recommendation
  ↓
Financial exposure shown
  ↓
Analytics
  ↓
Logout
```

------------------------------------------------------------------------

## 36. Final Technical Principle

PharmaGuard should be architected as:

**AI-assisted, human-verified, multi-tenant, batch-aware,
transaction-safe, responsive web SaaS.**

The most important technical rule is:

> AI may recommend or extract information, but inventory-changing
> decisions require validated application logic and, where appropriate,
> explicit user confirmation.
