# PharmaGuard --- Product Requirements Document (PRD)

**Version:** 1.0\
**Date:** 03 September 2026\
**Product:** PharmaGuard\
**Platform:** Web-only responsive SaaS\
**Primary Users:** Independent pharmacy owners, pharmacists, pharmacy
managers, and authorized staff

------------------------------------------------------------------------

## 1. Product Overview

PharmaGuard is a web-based pharmacy safety, expiry, inventory, and
compliance-support platform designed for independent pharmacies. It
helps pharmacies identify expired and near-expiry medicines, monitor
batch-level inventory, detect low-stock and stockout risks, reduce dead
stock, and make better reorder decisions.

The central product experience is:

**Upload medicine image → AI extracts medicine/batch/expiry information
→ user verifies → inventory is created → PharmaGuard monitors risk →
actionable alerts and recommendations are generated.**

PharmaGuard is strictly a **web application**. It must work on desktop,
laptop, tablet, and mobile browsers. It does not require a native mobile
application and does not use a direct camera integration. OCR uses a
manually uploaded image/file.

------------------------------------------------------------------------

## 2. Problem Statement

Independent pharmacies frequently manage inventory using paper
registers, spreadsheets, basic POS systems, or manual processes. These
workflows can make expiry tracking, batch management, stock monitoring,
and reorder planning difficult.

Problems include:

-   Expired medicines remaining in inventory.
-   Manual expiry and batch entry.
-   Near-expiry stock being discovered too late.
-   Fast-moving medicines unexpectedly becoming unavailable.
-   Capital being tied up in dead or overstocked medicines.
-   Poor visibility into batch-level inventory.
-   Difficult audit/history tracking.
-   Limited actionable analytics.
-   Existing enterprise pharmacy/POS systems being too complex or
    expensive for small independent pharmacies.

------------------------------------------------------------------------

## 3. Product Vision

**Make every independent pharmacy safer and smarter by turning inventory
data into clear, timely actions.**

PharmaGuard should not feel like a generic CRUD inventory system. It
should behave like an operational intelligence layer for a pharmacy.

The product should answer:

1.  What medicines are expired?
2.  What medicines will expire soon?
3.  Which batches should be sold first?
4.  Which medicines are running low?
5.  Which medicines may run out soon?
6.  What stock is not moving?
7.  How much money is exposed to expiry?
8.  What inventory needs attention today?
9.  What should the pharmacy reorder?
10. What actions have been performed and by whom?

------------------------------------------------------------------------

## 4. Goals

### Primary Goals

-   Reduce the chance of expired medicine being sold.
-   Make batch and expiry data fast to enter.
-   Provide actionable expiry alerts.
-   Provide low-stock and stockout-risk alerts.
-   Provide FEFO (First Expiry, First Out) recommendations.
-   Give owners visibility into inventory value and risk.
-   Provide basic predictive reorder recommendations.
-   Maintain an audit trail.
-   Deliver a modern, responsive web experience.

### Secondary Goals

-   Reduce dead stock.
-   Detect overstock.
-   Support returns and quarantine workflows.
-   Provide supplier and purchasing visibility.
-   Support recall tracking.
-   Provide reports and exports.
-   Support multiple users and permissions.
-   Provide AI-assisted summaries and search.

------------------------------------------------------------------------

## 5. Non-Goals for MVP

The first hackathon MVP should not depend on:

-   Native Android/iOS applications.
-   Direct camera APIs.
-   Full pharmacy POS/billing replacement.
-   Live distributor integration.
-   Automated distributor ordering.
-   Custom machine-learning model training.
-   Official regulatory certification.
-   Automated regulatory/legal compliance guarantees.
-   Complex accounting.
-   Hospital/enterprise ERP integration.

These can be future capabilities.

------------------------------------------------------------------------

## 6. Target Users

### 6.1 Pharmacy Owner

Needs:

-   Inventory value.
-   Expiry exposure.
-   Business-level analytics.
-   Reorder recommendations.
-   Dead/overstock detection.
-   Supplier information.
-   Reports.
-   User management.

### 6.2 Pharmacist

Needs:

-   Batch management.
-   Expiry monitoring.
-   AI medicine entry.
-   FEFO recommendations.
-   Sales logging.
-   Quarantine/return actions.
-   Alerts.

### 6.3 Pharmacy Staff

Needs:

-   Search inventory.
-   Record sales.
-   View stock.
-   Receive inventory.
-   Follow assigned actions.

### 6.4 Manager

Needs:

-   Analytics.
-   Stock movement.
-   Suppliers.
-   Returns.
-   Audit records.
-   Reports.

------------------------------------------------------------------------

## 7. User Journey

### New Pharmacy

1.  Open PharmaGuard.
2.  View landing page.
3.  Select Sign Up.
4.  Enter account information.
5.  Create pharmacy profile.
6.  Configure alert preferences.
7.  Import existing inventory or add medicines.
8.  Reach dashboard.

### Adding Medicine Using AI

1.  Open AI Scan.
2.  Upload medicine image.
3.  AI/OCR processes image.
4.  Extract medicine information.
5.  Display confidence.
6.  User reviews fields.
7.  User edits incorrect fields if required.
8.  User confirms.
9.  System creates medicine/batch record.
10. Dashboard/alerts update automatically.

### Daily Workflow

1.  User opens dashboard.
2.  Reads AI Daily Summary.
3.  Reviews Action Center.
4.  Handles expired/critical stock.
5.  Reviews FEFO recommendations.
6.  Records sales.
7.  Reviews reorder recommendations.
8.  Checks alerts.

------------------------------------------------------------------------

## 8. Information Architecture

``` text
Public
├── Landing
├── Pricing
├── Login
├── Sign Up
├── Forgot Password
├── Reset Password
└── Error Pages

Authenticated
├── Dashboard
├── Inventory
│   ├── All Medicines
│   ├── Medicine Details
│   ├── Batches
│   ├── Stock Adjustments
│   └── Import / Export
├── AI Scan
├── Expiry Center
│   ├── Expired
│   ├── Critical (0–30 days)
│   ├── Warning (31–90 days)
│   └── Safe
├── Sales
├── Purchases
├── Reorders
├── Suppliers
├── Returns
├── Quarantine
├── Recall Center
├── Analytics
├── Alerts
├── Compliance & Audit
├── Reports
├── Users
└── Settings
```

------------------------------------------------------------------------

## 9. UI/UX Requirements

### Design Direction

Modern healthcare SaaS interface with:

-   Clean whitespace.
-   Professional typography.
-   Dark navy/green navigation.
-   Green primary actions.
-   Subtle cards and borders.
-   Rounded components.
-   Clear status badges.
-   Accessible warning states.
-   Pharmacy-related illustrations only where useful.
-   Consistent iconography.
-   Light and dark mode.

### Responsive Behavior

Desktop:

-   Persistent sidebar.
-   Multi-column dashboard.
-   Data tables.

Tablet:

-   Collapsible sidebar.
-   Responsive two-column cards.

Mobile browser:

-   Navigation drawer/bottom navigation where appropriate.
-   One-column cards.
-   Tables become responsive cards.
-   Full-width forms.
-   Touch-friendly buttons.
-   Responsive charts.
-   Modals can become full-screen sheets.

No feature may be desktop-only.

------------------------------------------------------------------------

## 10. Required Pages

### 10.1 Landing Page

Sections:

-   Hero.
-   Problem statement.
-   How it works.
-   AI OCR demonstration.
-   Expiry protection.
-   Smart reorder.
-   Analytics.
-   Feature overview.
-   Pricing.
-   FAQ.
-   CTA.
-   Footer.

### 10.2 Login

-   Email.
-   Password.
-   Show/hide password.
-   Remember me.
-   Forgot password.
-   Sign in.
-   Google/Microsoft OAuth placeholders if configured.
-   Sign-up link.
-   Validation errors.
-   Server errors.

### 10.3 Sign Up

-   Full name.
-   Email.
-   Phone.
-   Password.
-   Confirm password.
-   Terms/privacy acceptance.
-   Account creation.
-   Optional OAuth.
-   Validation.
-   Password strength indicator.

### 10.4 Logout

Confirmation modal:

-   Logout.
-   Cancel.
-   Redirect to login after confirmation.

### 10.5 Dashboard

KPI cards:

-   Total stock value.
-   Expiring soon.
-   Expired.
-   Low stock.
-   Out of stock.
-   Today's sales.

Widgets:

-   Sales overview.
-   Expiry overview.
-   Stock status.
-   Low-stock alerts.
-   Expiring-soon list.
-   Recent sales.
-   AI daily summary.
-   Action Center.

### 10.6 AI Scan

-   Upload area.
-   Drag and drop.
-   File picker.
-   Supported file type/size information.
-   Processing state.
-   OCR results.
-   Confidence score.
-   Editable fields.
-   Confirm & Add.
-   Recent scans.
-   OCR error state.

### 10.7 Inventory

Features:

-   Search.
-   Filters.
-   Sorting.
-   Pagination.
-   Batch view.
-   Add medicine.
-   Edit.
-   Delete/archival.
-   Stock adjustment.
-   Import.
-   Export.

Statuses:

-   In Stock.
-   Low Stock.
-   Out of Stock.
-   Expiring Soon.
-   Expired.
-   Quarantined.
-   Returned.
-   Damaged.

### 10.8 Medicine Details

Tabs:

-   Overview.
-   Batches.
-   Sales.
-   Purchases.
-   Expiry.
-   History.

Include:

-   Risk score.
-   Stock.
-   sales velocity.
-   expiry status.
-   inventory value.
-   FEFO recommendation.

### 10.9 Expiry Center

-   Expired.
-   Critical.
-   Warning.
-   Safe.
-   Expiry calendar/heatmap.
-   Financial exposure.
-   Bulk actions.
-   Mark removed.
-   Mark returned.
-   Quarantine.

### 10.10 Sales

-   New sale.
-   Medicine.
-   Batch.
-   Quantity.
-   Price.
-   Date/time.
-   Notes.
-   Sales history.
-   Automatic stock update.
-   Sale reversal.

### 10.11 Purchases

-   Receive stock.
-   Supplier.
-   Invoice.
-   Medicine.
-   Batch.
-   Quantity.
-   Purchase price.
-   Expiry.
-   Purchase history.

### 10.12 Reorders

-   Current stock.
-   Daily sales.
-   Safety stock.
-   Lead time.
-   Estimated stockout.
-   Recommended quantity.
-   Recommendation explanation.
-   Reorder status.

### 10.13 Suppliers

-   Supplier list.
-   Contact.
-   Medicines supplied.
-   Last order.
-   Pending returns.
-   Supplier detail.
-   Add/edit supplier.

### 10.14 Returns

Reasons:

-   Expired.
-   Damaged.
-   Recall.
-   Incorrect shipment.
-   Other.

Statuses:

-   Pending.
-   Approved.
-   Completed.
-   Rejected.

### 10.15 Quarantine

-   Quarantined batches.
-   Reason.
-   Quantity.
-   Created by.
-   Date.
-   Release.
-   Return.
-   Destroy/remove workflow.

### 10.16 Recall Center

-   Recall records.
-   Medicine.
-   Batch.
-   Manufacturer.
-   Affected inventory.
-   Quarantine action.
-   Recall status.

### 10.17 Analytics

-   Sales trend.
-   Fast-moving products.
-   Slow-moving products.
-   Dead stock.
-   Overstock.
-   Stock valuation.
-   Expiry exposure.
-   Reorder trends.
-   Profit/margin when configured.

### 10.18 Alerts Center

Severity:

-   Critical.
-   High.
-   Medium.
-   Low.

Alert types:

-   Expired.
-   Expiring.
-   Low stock.
-   Stockout risk.
-   Dead stock.
-   Recall.
-   Quarantine.
-   Data quality/OCR review.

Actions:

-   Mark read.
-   Resolve.
-   Snooze.
-   Open record.

### 10.19 Compliance & Audit

Track:

-   Expired stock.
-   Removed stock.
-   Returned stock.
-   Quarantined stock.
-   Stock adjustments.
-   User actions.
-   Audit timeline.

The product must not claim that these records constitute official DRAP
compliance certification.

### 10.20 Reports

Reports:

-   Inventory.
-   Expired stock.
-   Near-expiry.
-   Sales.
-   Purchases.
-   Stock valuation.
-   Audit.
-   Returns.

Exports:

-   CSV.
-   PDF.

### 10.21 Settings

-   Pharmacy information.
-   User profile.
-   Roles.
-   Notifications.
-   Security.
-   Appearance.
-   Backup/export.
-   Preferences.

### 10.22 Pricing

Suggested plans:

**Starter --- PKR 1,500/month** - Up to 1,000 medicines. - 1 user. -
Basic reports. - AI OCR. - Expiry alerts.

**Professional --- PKR 2,800/month** - Up to 5,000 medicines. - 3
users. - Advanced reports. - Priority support. - Smart reorder. -
Expanded alerts.

**Premium --- PKR 4,000/month** - Up to 10,000 medicines. - 5 users. -
Advanced analytics. - SMS alert allowance if integrated. - Priority
support.

**Enterprise --- Custom** - Unlimited/negotiated inventory. - Custom
users. - Integrations. - Dedicated support. - Advanced analytics.

Pricing is a product proposal and should be validated commercially
before launch.

### 10.23 Error Pages

404:

-   Clear message.
-   Go Home.
-   Back.

500:

-   Clear message.
-   Try Again.
-   Go Home.

Also provide:

-   Network error.
-   Unauthorized.
-   Forbidden.
-   Empty state.
-   OCR failure.
-   Validation errors.

------------------------------------------------------------------------

## 11. AI Features

### OCR

Gemini Vision or equivalent vision model extracts structured fields from
uploaded images.

AI must:

-   Return structured data.
-   Provide confidence where possible.
-   Never silently overwrite verified user data.
-   Allow manual correction.
-   Require confirmation.

### Reorder Prediction

MVP statistical model:

``` text
Average Daily Sales = Units Sold / Observation Days

Estimated Days Remaining = Current Stock / Average Daily Sales

Recommended Order =
Demand During Lead Time
+ Safety Stock
- Current Stock
```

### AI Daily Summary

Summarize high-priority inventory events.

### Natural Language Search

Examples:

-   "Show medicines expiring next month."
-   "What may run out this week?"
-   "Show my slow-moving medicines."

Use constrained, permission-aware query handling.

------------------------------------------------------------------------

## 12. Business Rules

### Expiry

-   Expired: expiry date \< current date.
-   Critical: 0--30 days.
-   Warning: 31--90 days.
-   Safe: \>90 days.

Exact thresholds should be configurable.

### Stock

-   Out of Stock: quantity = 0.
-   Low Stock: quantity \<= reorder level.
-   Overstock: projected coverage exceeds configurable threshold.
-   Dead Stock: no sale for configurable period, e.g. 60 days.

### FEFO

When multiple batches exist, recommend the batch with the earliest valid
expiry date.

### Duplicate Detection

Detect likely duplicate:

-   Same medicine + same batch.
-   Similar medicine names.
-   Same manufacturer/strength.

User confirmation is required for merging.

------------------------------------------------------------------------

## 13. Success Metrics

### Product

-   Time to add first medicine.
-   OCR confirmation rate.
-   Number of expired batches identified.
-   Number of alerts resolved.
-   Reorder recommendation acceptance.
-   Daily active pharmacy users.
-   Inventory data completeness.

### Business

-   Trial-to-paid conversion.
-   Monthly recurring revenue.
-   Pharmacy retention.
-   Average revenue per pharmacy.
-   Customer acquisition cost.
-   Churn.

------------------------------------------------------------------------

## 14. MVP Acceptance Criteria

The hackathon MVP is successful when a judge can:

1.  Sign up.
2.  Log in.
3.  Create a pharmacy.
4.  Upload a medicine image.
5.  See extracted fields.
6.  Correct/confirm them.
7.  Create a batch.
8.  See it on inventory.
9.  See expiry status.
10. Record a sale.
11. See quantity update.
12. See low-stock detection.
13. See reorder recommendation.
14. View alerts.
15. View analytics.
16. Log out.
17. Navigate error pages.
18. Use the system comfortably on mobile browser.

------------------------------------------------------------------------

## 15. Future Vision

-   Distributor integration.
-   Automated purchase orders.
-   Supplier APIs.
-   Advanced demand forecasting.
-   Multi-branch management.
-   WhatsApp notifications.
-   SMS.
-   Advanced recall feeds.
-   Regulatory reporting assistance.
-   Accounting integration.
-   Barcode workflows.
-   Enterprise API.
-   Pharmacy network analytics.

------------------------------------------------------------------------

## 16. Product Principles

1.  **Safety first.**
2.  **AI assists; humans verify.**
3.  **Action over information.**
4.  **Batch-level accuracy.**
5.  **Mobile-friendly web experience.**
6.  **Simple enough for independent pharmacies.**
7.  **Every important action is traceable.**
8.  **Never claim regulatory compliance without verification.**
