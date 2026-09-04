# PharmaGuard --- UI Rules

## 1. Visual Source of Truth

The supplied PharmaGuard screenshot is the primary UI reference.

The implementation should match:

-   Layout.
-   Sidebar proportions.
-   Card density.
-   Typography hierarchy.
-   Status colors.
-   Form composition.
-   Table density.
-   Button hierarchy.
-   Modal treatment.
-   Overall healthcare SaaS feel.

Do not redesign the UI into a generic dashboard.

------------------------------------------------------------------------

## 2. Application Shell

Desktop:

``` text
┌──────────────┬─────────────────────────────┐
│              │ Header                      │
│   Sidebar    ├─────────────────────────────┤
│              │ Main content                │
│              │                             │
└──────────────┴─────────────────────────────┘
```

Mobile:

``` text
┌─────────────────────────────┐
│ Header / menu               │
├─────────────────────────────┤
│ Main content                │
│                             │
└─────────────────────────────┘
```

Sidebar collapses on smaller screens.

------------------------------------------------------------------------

## 3. Sidebar

Must contain the same general navigation hierarchy shown in the
reference:

-   Dashboard.
-   Inventory.
-   AI Scan (OCR).
-   Expiry Center.
-   Sales.
-   Purchases.
-   Reorders.
-   Suppliers.
-   Returns.
-   Quarantine.
-   Analytics.
-   Alerts.
-   Compliance.
-   Users.
-   Settings.

Rules:

-   Active route is clearly highlighted.
-   Icons remain consistent.
-   Labels remain readable.
-   Sidebar does not cause horizontal overflow.
-   Mobile uses drawer navigation.

------------------------------------------------------------------------

## 4. Header

Header includes:

-   Menu control where needed.
-   Search.
-   Notification indicator.
-   User identity/avatar.
-   Page context where useful.

Search should support:

-   Medicines.
-   Batches.
-   Invoices.
-   Relevant operational entities.

------------------------------------------------------------------------

## 5. Dashboard

Match the screenshot's hierarchy:

1.  Greeting.
2.  Date/control.
3.  KPI cards.
4.  Sales overview.
5.  Expiry overview.
6.  Stock status.
7.  Low-stock alerts.
8.  Expiring soon.
9.  Recent sales.

Add:

-   AI daily summary.
-   Action center.

Do not overwhelm the first viewport.

------------------------------------------------------------------------

## 6. Cards

Cards should have:

-   White surface.
-   Subtle border.
-   Small radius.
-   Minimal shadow.
-   Consistent padding.
-   Clear title.
-   Optional action.

Avoid excessive glassmorphism.

------------------------------------------------------------------------

## 7. Buttons

Primary:

-   Green.

Danger:

-   Red.

Secondary:

-   White/light neutral with border.

Ghost:

-   Transparent.

Buttons need:

-   Hover.
-   Focus.
-   Disabled.
-   Loading.

------------------------------------------------------------------------

## 8. Forms

Inputs must:

-   Have labels.
-   Have clear placeholder text.
-   Show focus.
-   Show validation.
-   Show error.
-   Show disabled state.

Password fields include show/hide.

------------------------------------------------------------------------

## 9. Tables

Desktop:

-   Dense but readable.
-   Header row.
-   Status pills.
-   Row actions.

Mobile:

-   Convert to cards or intentionally responsive table.
-   Never force unreadable horizontal scrolling unless there is no
    better alternative.

------------------------------------------------------------------------

## 10. Status System

Use semantic statuses:

``` text
Safe
Success
Warning
Critical
Expired
Low Stock
Out of Stock
Quarantined
Returned
Pending
Completed
```

Status should be communicated through:

-   Text.
-   Icon.
-   Color.

Never rely on color alone.

------------------------------------------------------------------------

## 11. Skeleton Loading

Mandatory on all asynchronous content.

Skeleton shapes should match:

-   KPI card.
-   Chart.
-   Table.
-   Card.
-   List.

Example:

``` text
[████████] [████████] [████████]
[────────────── chart ──────────]
[██████████████████████████████]
[██████████████████████████████]
```

Skeleton animation must be subtle and respect reduced-motion
preferences.

------------------------------------------------------------------------

## 12. Empty States

Example:

``` text
No expiring medicines

Your inventory currently has no medicines
approaching the configured expiry threshold.

[View Inventory]
```

Every empty state should offer a next action when one exists.

------------------------------------------------------------------------

## 13. Error States

Error UI should be calm and actionable.

Example:

``` text
Something went wrong

We couldn't load your inventory.

[Try Again]
```

Never show raw stack traces.

------------------------------------------------------------------------

## 14. Login

Match the screenshot:

-   Split layout.
-   Pharmacy branding panel.
-   Medicine illustration.
-   Login card.
-   Email.
-   Password.
-   Remember me.
-   Forgot password.
-   Sign in.
-   Social login placeholders if enabled.
-   Sign-up CTA.

------------------------------------------------------------------------

## 15. Sign Up

Match the login visual identity.

Fields:

-   Full name.
-   Email.
-   Phone.
-   Password.
-   Confirm password.
-   Terms.

------------------------------------------------------------------------

## 16. Logout

Use a centered confirmation modal.

Actions:

-   Yes, Logout --- danger.
-   Cancel --- secondary.

Backdrop dims the application.

------------------------------------------------------------------------

## 17. AI Scan

The central interaction is an upload zone.

Include:

-   Drag/drop.
-   Choose File.
-   Accepted file formats.
-   File size.
-   Processing state.
-   Extracted information panel.
-   Confidence.
-   Edit manually.
-   Confirm & Add.

Do not use a camera capture button.

------------------------------------------------------------------------

## 18. Expiry Center

Use status summary cards:

-   Expired.
-   Critical.
-   Warning.
-   Safe.

Then:

-   Filterable table.
-   Quick actions.
-   Financial exposure.

------------------------------------------------------------------------

## 19. Pricing

Keep the same design language.

Plans should be easy to compare.

Each plan includes:

-   Price.
-   Billing period.
-   Feature list.
-   CTA.
-   Recommended badge where appropriate.

------------------------------------------------------------------------

## 20. Accessibility

Target WCAG-style good practice:

-   Keyboard accessible.
-   Focus visible.
-   Labels.
-   Semantic headings.
-   Accessible dialogs.
-   Screen-reader-friendly status.
-   Reduced motion support.

------------------------------------------------------------------------

## 21. Responsive Rules

Suggested breakpoints:

-   `<640px`: mobile.
-   `640–1023px`: tablet.
-   `>=1024px`: desktop.

At mobile:

-   One-column layout.
-   Full-width primary actions.
-   Drawer navigation.
-   Compact header.
-   Cards replace dense tables.
-   Charts resize.
-   Modals become sheets where useful.

------------------------------------------------------------------------

## 22. Do Not

-   Use direct camera APIs.
-   Create a different design for every page.
-   Add random gradients.
-   Add unnecessary animations.
-   Hide errors.
-   Use spinners as the only loading state.
-   Put secrets in UI code.
-   Use color without labels.
-   Break desktop layout to support mobile.
