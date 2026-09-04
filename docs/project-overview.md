# PharmaGuard --- Project Overview

## 1. Product

PharmaGuard is a modern web-only pharmacy expiry, inventory,
safety-support, and compliance-management SaaS.

### One-line pitch

> Never sell an expired medicine again --- PharmaGuard tells pharmacy
> teams what to pull, reorder, quarantine, return, or review before it
> becomes a costly problem.

------------------------------------------------------------------------

## 2. Core Product Promise

The application converts pharmacy inventory into actionable operational
intelligence.

The primary loop is:

``` text
Upload
→ Extract
→ Verify
→ Track
→ Alert
→ Act
→ Analyze
```

------------------------------------------------------------------------

## 3. Target Users

-   Independent pharmacy owners.
-   Pharmacists.
-   Pharmacy managers.
-   Authorized pharmacy staff.

------------------------------------------------------------------------

## 4. Platform

Strictly:

**Web only.**

Must support:

-   Desktop browser.
-   Laptop browser.
-   Tablet browser.
-   Mobile browser.

There is no requirement for:

-   Native Android.
-   Native iOS.
-   Direct camera access.

For AI scanning, the user manually selects/uploads an image.

------------------------------------------------------------------------

## 5. Feature Inventory

### Authentication

-   Login.
-   Sign up.
-   Logout.
-   Forgot password.
-   Reset password.
-   Session handling.
-   Email verification where enabled.

### Dashboard

-   Total stock value.
-   Expiring soon.
-   Expired.
-   Low stock.
-   Out of stock.
-   Today's sales.
-   Sales chart.
-   Expiry overview.
-   Stock status.
-   Low-stock alerts.
-   Expiring-soon list.
-   Recent sales.
-   AI daily summary.
-   Action center.

### AI Scan

-   Image upload.
-   Drag and drop.
-   OCR.
-   Medicine extraction.
-   Batch extraction.
-   Expiry extraction.
-   Confidence.
-   Human verification.
-   Manual correction.
-   Confirm & Add.
-   Recent scans.
-   OCR retry.

### Inventory

-   All medicines.
-   Batch-level inventory.
-   Search.
-   Filters.
-   Sorting.
-   Pagination.
-   Stock adjustments.
-   Duplicate detection.
-   Barcode/manual barcode support.
-   Import.
-   Export.
-   Medicine details.

### Expiry

-   Expired.
-   0--30 day critical.
-   31--90 day warning.
-   Safe.
-   Expiry heatmap.
-   Financial exposure.
-   Bulk actions.
-   Quarantine.
-   Return.

### Safety

-   FEFO.
-   Recall center.
-   Quarantine.
-   Safety/risk score.
-   Action center.

### Commercial

-   Sales.
-   Sale reversal.
-   Purchases.
-   Suppliers.
-   Returns.
-   Reorders.
-   Stock valuation.
-   Profit/margin.

### Intelligence

-   Sales velocity.
-   Stockout prediction.
-   Smart reorder quantity.
-   Dead stock.
-   Overstock.
-   Expiry loss exposure.
-   AI daily summary.
-   Natural-language inventory search.

### Administration

-   Compliance & audit.
-   Reports.
-   Users.
-   Roles.
-   Settings.
-   Notification preferences.
-   Appearance.
-   Security.

### Marketing

-   Landing page.
-   Pricing page.
-   FAQ.
-   CTA.

------------------------------------------------------------------------

## 6. Required Visual Pages

The supplied reference image is the visual baseline for:

1.  Login.
2.  Sign Up.
3.  Dashboard.
4.  Logout.
5.  AI Scan.
6.  Inventory.
7.  Expiry Center.
8.  Sales.
9.  Suppliers.
10. Returns.
11. Alerts.
12. Reports/Analytics.
13. 404. 
14. 500. 

The remaining pages must use the same shell and design system.

------------------------------------------------------------------------

## 7. UI Skeleton Requirement

Skeleton loading is mandatory.

Every data-heavy page must show skeletons before content appears.

Examples:

-   Dashboard KPI skeletons.
-   Chart skeleton.
-   Table row skeleton.
-   Inventory card skeleton.
-   Alert skeleton.
-   Medicine detail skeleton.
-   OCR processing skeleton.

Skeletons must resemble the actual content layout instead of being a
generic spinner-only screen.

------------------------------------------------------------------------

## 8. Pricing

Suggested plans:

### Starter

PKR 1,500/month.

### Professional

PKR 2,800/month.

### Premium

PKR 4,000/month.

### Enterprise

Custom.

Pricing is a proposed product model and must be configurable rather than
hardcoded into business logic.

------------------------------------------------------------------------

## 9. Demo Story

The strongest demo:

``` text
Sign in
→ Dashboard
→ AI Scan
→ Upload medicine image
→ OCR extracts batch + expiry
→ User confirms
→ Inventory record created
→ Expiry risk appears
→ FEFO recommendation
→ Record sale
→ Stock decreases
→ Low-stock alert
→ Reorder prediction
→ Analytics shows financial exposure
```

------------------------------------------------------------------------

## 10. Product Principles

-   Safety first.
-   Human verification for AI.
-   Actionable information.
-   Batch-level accuracy.
-   Responsive design.
-   Clear error recovery.
-   Secure by default.
-   Multi-tenant isolation.
-   No regulatory overclaiming.
