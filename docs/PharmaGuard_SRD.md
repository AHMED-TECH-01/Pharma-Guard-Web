# PharmaGuard --- Software Requirements Document (SRD)

**Version:** 1.0\
**Date:** 03 September 2026\
**System:** PharmaGuard Web Application

------------------------------------------------------------------------

## 1. Purpose

This SRD defines the functional and non-functional software requirements
for PharmaGuard, a responsive web application for pharmacy inventory,
expiry, safety-support, alerts, sales, purchasing, analytics, and audit
management.

The application must run in modern desktop and mobile browsers and must
not require a native application or direct camera integration.

------------------------------------------------------------------------

## 2. System Scope

### Included

-   Web frontend.
-   Authentication.
-   Pharmacy management.
-   User roles.
-   AI OCR through uploaded images.
-   Medicine and batch inventory.
-   Expiry monitoring.
-   FEFO.
-   Sales.
-   Purchases.
-   Reorders.
-   Suppliers.
-   Returns.
-   Quarantine.
-   Recall management.
-   Alerts.
-   Analytics.
-   Reports.
-   Audit logs.
-   Pricing.
-   Settings.
-   Error handling.
-   Responsive design.

### Excluded from MVP

-   Native apps.
-   Direct camera capture.
-   Automated distributor ordering.
-   Full accounting.
-   Official regulatory certification.
-   Custom ML training.

------------------------------------------------------------------------

## 3. Functional Requirements

### FR-001 Authentication

The system shall allow users to:

-   Sign up.
-   Sign in.
-   Sign out.
-   Reset password.
-   Change password.
-   Maintain authenticated sessions.

Validation shall cover:

-   Required fields.
-   Valid email.
-   Password requirements.
-   Password confirmation.
-   Duplicate email.

### FR-002 Pharmacy Profile

The system shall store:

-   Pharmacy name.
-   Owner.
-   Address.
-   Phone.
-   Email.
-   License/reference information if the pharmacy chooses to store it.
-   Created date.

### FR-003 User Roles

Minimum roles:

-   Owner.
-   Manager.
-   Pharmacist.
-   Staff.

The backend must enforce permissions independently of the frontend.

### FR-004 Medicine

Medicine records shall support:

-   Name.
-   Generic name.
-   Strength.
-   Dosage form.
-   Manufacturer.
-   Barcode.
-   Category.
-   Reorder level.
-   Safety stock.
-   Purchase price.
-   Selling price.

### FR-005 Batch

Each batch shall support:

-   Medicine ID.
-   Batch number.
-   Manufacturing date.
-   Expiry date.
-   Quantity.
-   Received date.
-   Purchase price.
-   Supplier.
-   Status.

### FR-006 AI OCR Upload

The user shall upload an image file.

Supported examples:

-   JPG/JPEG.
-   PNG.
-   WEBP.

The system shall:

1.  Validate file.
2.  Upload/process securely.
3.  Send image to vision OCR service.
4.  Parse structured fields.
5.  Display extracted information.
6.  Display confidence/processing status.
7.  Allow editing.
8.  Require confirmation.
9.  Create/update records only after confirmation.

### FR-007 OCR Error Handling

If OCR fails:

-   Show user-friendly error.
-   Preserve uploaded file state when safe.
-   Allow retry.
-   Allow manual entry.

The system must never create a potentially incorrect medicine record
silently after OCR failure.

### FR-008 Inventory

Users shall:

-   View inventory.
-   Search.
-   Filter.
-   Sort.
-   Add.
-   Edit.
-   Archive/delete according to permissions.
-   Adjust quantity.
-   View batches.
-   View medicine details.

### FR-009 Duplicate Detection

The system shall detect likely duplicates based on medicine/batch
attributes.

The user shall decide whether to:

-   Increase existing quantity.
-   Create new batch.
-   Merge records where supported.

### FR-010 Expiry Engine

The system shall calculate:

``` text
days_to_expiry = expiry_date - current_date
```

Statuses:

-   Expired.
-   Critical.
-   Warning.
-   Safe.

### FR-011 FEFO

For a medicine with multiple batches, the system shall identify the
earliest valid expiry batch and recommend it for sale first.

### FR-012 Sales

Users with permission shall record:

-   Medicine.
-   Batch.
-   Quantity.
-   Sale price.
-   Date/time.
-   Optional note.

The system shall reduce batch quantity atomically.

### FR-013 Sale Reversal

Authorized users shall reverse an incorrect sale.

The system shall:

-   Restore quantity.
-   Record reversal.
-   Add audit event.

### FR-014 Purchase Receiving

Users shall record:

-   Supplier.
-   Invoice.
-   Medicine.
-   Batch.
-   Quantity.
-   Purchase price.
-   Expiry.
-   Received date.

Receiving shall increase inventory atomically.

### FR-015 Low Stock

The system shall compare quantity against reorder level.

``` text
if quantity <= reorder_level:
    low_stock = true
```

### FR-016 Stockout Prediction

The system shall estimate stockout:

``` text
average_daily_sales =
    units_sold / observation_days

estimated_days_remaining =
    current_quantity / average_daily_sales
```

If insufficient sales data exists, the system shall clearly state that
the estimate is unavailable or low confidence.

### FR-017 Smart Reorder

Recommendation shall consider:

-   Current quantity.
-   Average sales.
-   Lead time.
-   Safety stock.
-   Optional target coverage.

The system shall display an explanation rather than only a number.

### FR-018 Dead Stock

The system shall identify medicines with no sales for a configurable
period.

Default example: 60 days.

### FR-019 Overstock

The system shall identify inventory with excessive projected coverage.

Threshold must be configurable.

### FR-020 Stock Valuation

The system shall calculate:

``` text
inventory_value =
sum(quantity × purchase_price)
```

Separate:

-   Total value.
-   Near-expiry value.
-   Expired value.
-   Quarantined value.

### FR-021 Expiry Loss Exposure

The system shall estimate financial exposure of stock approaching
expiry:

``` text
expiry_exposure =
sum(quantity × purchase_price)
```

This is an estimate, not guaranteed loss.

### FR-022 Alerts

The system shall generate alerts for:

-   Expired.
-   Expiring.
-   Low stock.
-   Stockout risk.
-   Dead stock.
-   Overstock.
-   Recall.
-   Quarantine.
-   OCR/data review.

### FR-023 Alert Lifecycle

Alert states:

-   New.
-   Read.
-   Snoozed.
-   Resolved.

### FR-024 Recall

Users shall create recall records containing:

-   Medicine.
-   Batch.
-   Manufacturer.
-   Reason.
-   Date.
-   Status.

System shall identify matching inventory.

### FR-025 Quarantine

Users shall move affected stock into quarantine.

Quarantine shall preserve:

-   Quantity.
-   Batch.
-   Reason.
-   User.
-   Timestamp.

Possible actions:

-   Release.
-   Return.
-   Remove/archive.

### FR-026 Returns

Return records shall include:

-   Medicine.
-   Batch.
-   Quantity.
-   Supplier.
-   Reason.
-   Return date.
-   Status.

### FR-027 Suppliers

Supplier records shall include:

-   Name.
-   Contact.
-   Address.
-   Medicines supplied.
-   Last order.
-   Pending returns.

### FR-028 Analytics

The system shall provide:

-   Sales trend.
-   Top medicines.
-   Fast-moving medicines.
-   Slow-moving medicines.
-   Dead stock.
-   Overstock.
-   Expiry exposure.
-   Stock valuation.
-   Reorder trends.
-   Margins when price data exists.

### FR-029 AI Daily Summary

The dashboard may generate a summary from authorized system metrics.

Example output:

-   Expired batches.
-   Critical expiry.
-   Low stock.
-   Stockout risks.
-   Dead stock.
-   Financial exposure.

### FR-030 Natural Language Search

The system shall accept constrained queries such as:

-   Expiring medicines.
-   Low-stock medicines.
-   Stockout risks.
-   Slow-moving products.

Natural-language interpretation must respect the authenticated user's
permissions.

### FR-031 Audit Trail

Audit events shall include:

-   User.
-   Action.
-   Entity.
-   Entity ID.
-   Before value when appropriate.
-   After value when appropriate.
-   Timestamp.
-   Source.

### FR-032 Reports

Reports shall be generated for:

-   Inventory.
-   Expired stock.
-   Near expiry.
-   Sales.
-   Purchases.
-   Returns.
-   Audit.
-   Valuation.

### FR-033 Import

CSV/Excel import shall:

1.  Validate headers.
2.  Validate dates.
3.  Validate quantities.
4.  Detect duplicates.
5.  Show preview.
6.  Require confirmation.
7.  Report failed rows.

### FR-034 Export

The system shall export selected reports to:

-   CSV.
-   PDF.

### FR-035 Notifications

MVP:

-   In-app notifications.

Future:

-   Email.
-   SMS.
-   WhatsApp.

### FR-036 Dashboard Customization

Authorized users may select dashboard widgets.

### FR-037 Pharmacy Health Score

The system may calculate a non-regulatory operational score based on:

-   Expiry status.
-   Stock levels.
-   Data completeness.
-   Alert resolution.
-   Inventory health.

It must not be presented as an official regulatory score.

### FR-038 Pricing

Pricing page shall display:

-   Starter.
-   Professional.
-   Premium.
-   Enterprise.

Subscription checkout may initially be mocked for the hackathon.

### FR-039 Error Pages

The application shall support:

-   404. 
-   500. 
-   401. 
-   403. 
-   Network error.
-   Validation error.
-   OCR failure.
-   Empty states.

------------------------------------------------------------------------

## 4. UI Requirements

### UI-001 Design System

All pages shall share:

-   Same navigation.
-   Typography.
-   Buttons.
-   Inputs.
-   Cards.
-   Tables.
-   Status badges.
-   Modal styles.
-   Toasts.
-   Icons.

### UI-002 Dashboard

Dashboard must show high-priority information above the fold.

### UI-003 Tables

Desktop uses tables.

Mobile converts rows to stacked cards or provides an intentional
responsive table pattern.

### UI-004 Forms

Forms shall have:

-   Labels.
-   Required indicators.
-   Inline validation.
-   Helpful placeholders.
-   Error messages.
-   Loading states.
-   Success feedback.

### UI-005 Loading

Provide:

-   Skeletons.
-   Spinners where appropriate.
-   Disabled buttons during submission.
-   Progress state for OCR.

### UI-006 Empty States

Every list must have a useful empty state and action.

### UI-007 Accessibility

Target:

-   Keyboard navigation.
-   Visible focus states.
-   Semantic HTML.
-   Accessible labels.
-   Sufficient contrast.
-   Non-color-only status communication.

------------------------------------------------------------------------

## 5. Non-Functional Requirements

### NFR-001 Responsive

The application must work at common viewport sizes from approximately
320px mobile widths through large desktop displays.

### NFR-002 Performance

Target:

-   Fast initial page load.
-   Lazy-load heavy charts.
-   Paginate large inventory lists.
-   Debounce search.
-   Avoid unnecessary API requests.

### NFR-003 Security

-   HTTPS in production.
-   Secure authentication.
-   Password hashing.
-   Authorization on server.
-   Input validation.
-   Parameterized database queries/ORM.
-   Rate limiting for authentication and AI endpoints.
-   Secure file validation.
-   File size limits.
-   Secrets stored in environment variables.
-   No sensitive keys in frontend bundles.

### NFR-004 Data Integrity

Inventory-changing operations must be transactional.

Examples:

-   Sale.
-   Purchase receiving.
-   Stock adjustment.
-   Return.
-   Quarantine movement.

### NFR-005 Reliability

Failures in external AI services must not corrupt inventory.

### NFR-006 Auditability

Important state changes must generate audit events.

### NFR-007 Maintainability

Use:

-   TypeScript.
-   Modular components.
-   Service layer.
-   Schema validation.
-   Central error handling.
-   Consistent API contracts.

### NFR-008 Scalability

The architecture shall support multiple pharmacies and multiple users
without pharmacy data leakage.

### NFR-009 Privacy

A user's pharmacy data must only be accessible according to
authorization.

### NFR-010 Browser Support

Support current versions of:

-   Chrome.
-   Edge.
-   Firefox.
-   Safari.

------------------------------------------------------------------------

## 6. Validation Requirements

### Authentication

-   Email format.
-   Password strength.
-   Duplicate account.
-   Password match.

### Medicine

-   Medicine name required.
-   Batch required.
-   Quantity cannot be negative.
-   Expiry must be a valid date.
-   Manufacturing date cannot be after expiry.

### Sales

-   Quantity \> 0.
-   Quantity \<= available batch quantity.
-   Authorized user required.

### Purchases

-   Quantity \> 0.
-   Valid supplier.
-   Valid batch.

------------------------------------------------------------------------

## 7. Core State Machines

### Medicine Batch

``` text
Available
   ├── Low Stock
   ├── Expiring Soon
   ├── Expired
   ├── Quarantined
   ├── Returned
   └── Archived
```

### Alert

``` text
New → Read → Resolved
       └── Snoozed → Read
```

### Return

``` text
Draft → Pending → Approved → Completed
              └── Rejected
```

------------------------------------------------------------------------

## 8. Error Handling

Every API error should return a consistent structure:

``` json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Expiry date is invalid",
    "details": {}
  }
}
```

Frontend should convert technical failures into understandable messages.

------------------------------------------------------------------------

## 9. Acceptance Criteria

The system is acceptable when:

-   Authenticated users cannot access another pharmacy's data.
-   Medicine batches can be created and tracked.
-   Expiry status updates based on date.
-   Sales reduce the correct batch quantity.
-   Purchases increase inventory.
-   Alerts are generated correctly.
-   OCR requires confirmation.
-   Reorder recommendations explain their calculation.
-   Mobile layouts remain usable.
-   Errors are recoverable.
-   Audit logs reflect critical operations.

------------------------------------------------------------------------

## 10. MVP Priority

### P0

-   Authentication.
-   Responsive shell.
-   Dashboard.
-   AI OCR upload.
-   Medicine/batch inventory.
-   Expiry center.
-   Alerts.
-   Sales.
-   Low-stock detection.

### P1

-   Reorder prediction.
-   FEFO.
-   Analytics.
-   Purchases.
-   Suppliers.
-   Returns.
-   Quarantine.
-   Audit.

### P2

-   Recall.
-   Natural language search.
-   Dashboard customization.
-   Health score.
-   Advanced reports.
-   Subscription integration.

------------------------------------------------------------------------

## 11. Definition of Done

A feature is complete when:

-   UI is responsive.
-   API is implemented.
-   Validation exists.
-   Authorization exists.
-   Loading state exists.
-   Error state exists.
-   Empty state exists where relevant.
-   Audit event exists for critical mutations.
-   Tests exist for core logic.
-   No console errors remain in production build.
