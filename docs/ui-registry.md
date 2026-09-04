# PharmaGuard --- UI Registry

## 1. Purpose

This registry prevents AI agents from inventing different components for
the same UI problem.

Reuse registered components before creating new ones.

------------------------------------------------------------------------

## 2. Global Components

  Component       Purpose
  --------------- ----------------------------------
  AppShell        Authenticated application layout
  Sidebar         Desktop navigation
  MobileNav       Mobile navigation drawer
  Topbar          Header/search/profile
  Breadcrumbs     Page context
  PageHeader      Page title/actions
  Card            Shared surface
  KPI Card        Dashboard metric
  Button          Primary interaction
  IconButton      Compact action
  Input           Text input
  Select          Dropdown
  DatePicker      Date selection
  Modal           Confirmation/dialog
  Drawer          Mobile/side interaction
  Toast           Temporary feedback
  Alert           Persistent message
  Badge           Status
  DataTable       Desktop data
  Pagination      List pagination
  Skeleton        Loading placeholder
  EmptyState      No-data UI
  ErrorState      Recoverable error
  ConfirmDialog   Destructive confirmation

------------------------------------------------------------------------

## 3. Pharma Components

  Component            Purpose
  -------------------- -----------------------------
  MedicineCard         Medicine summary
  BatchTable           Batch-level data
  ExpiryBadge          Expiry status
  StockBadge           Stock status
  AlertCard            Alert summary
  ActionCenter         Prioritized tasks
  OCRUpload            Image upload
  OCRReviewPanel       AI extraction review
  ConfidenceBadge      OCR confidence
  FEFORecommendation   First-expiry recommendation
  ReorderCard          Reorder recommendation
  RiskScore            Inventory risk
  SalesSummary         Sales overview
  SupplierCard         Supplier overview
  QuarantineBadge      Quarantine state
  RecallCard           Recall information
  AuditTimeline        Activity history
  HealthScore          Pharmacy operational score

------------------------------------------------------------------------

## 4. Dashboard Registry

Required components:

``` text
DashboardHeader
KpiGrid
SalesOverviewCard
ExpiryOverviewCard
StockStatusCard
LowStockCard
ExpiringSoonCard
RecentSalesCard
AiDailySummary
ActionCenter
```

------------------------------------------------------------------------

## 5. Authentication Registry

``` text
AuthLayout
AuthBrandPanel
LoginForm
SignupForm
PasswordField
PasswordStrength
OAuthButtons
AuthError
```

------------------------------------------------------------------------

## 6. OCR Registry

``` text
OCRUploadZone
OCRProcessingState
OCRResultCard
OCRFieldEditor
OCRConfidence
OCRConfirmBar
OCRHistory
```

------------------------------------------------------------------------

## 7. Inventory Registry

``` text
InventoryToolbar
InventoryTable
InventoryMobileCard
MedicineDetailHeader
BatchTable
StockAdjustmentDialog
DuplicateWarning
ImportPreview
```

------------------------------------------------------------------------

## 8. Skeleton Registry

Every major page needs a corresponding skeleton:

``` text
DashboardSkeleton
TableSkeleton
CardSkeleton
ChartSkeleton
MedicineDetailSkeleton
AlertSkeleton
FormSkeleton
```

Do not create random skeleton shapes.

------------------------------------------------------------------------

## 9. Modal Registry

Use:

``` text
LogoutDialog
DeleteDialog
StockAdjustmentDialog
ConfirmSaleDialog
ConfirmReturnDialog
QuarantineDialog
RecallDialog
```

Destructive actions must use confirmation.

------------------------------------------------------------------------

## 10. Page Registry

``` text
/
 /pricing
 /login
 /signup
 /forgot-password
 /reset-password

/dashboard
/inventory
/inventory/[id]
/ai-scan
/expiry
/sales
/purchases
/reorders
/suppliers
/returns
/quarantine
/recalls
/analytics
/alerts
/compliance
/reports
/users
/settings
/settings/profile
/settings/pharmacy
/settings/notifications
/settings/security
/settings/appearance
```

------------------------------------------------------------------------

## 11. UI Duplication Rule

Before creating a component:

1.  Search this registry.
2.  Search the repository.
3.  Reuse if possible.
4.  Extend if necessary.
5.  Create new only when the use case is genuinely different.
6.  Register the new component.

------------------------------------------------------------------------

## 12. Screenshot Fidelity Rule

When implementing a reference page:

-   Match layout first.
-   Match spacing second.
-   Match typography third.
-   Match colors fourth.
-   Match interaction states fifth.
-   Add skeleton/error/empty states without changing the core visual
    identity.

The screenshot is not a suggestion. It is the baseline visual
specification.
