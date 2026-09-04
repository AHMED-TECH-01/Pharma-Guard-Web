# PharmaGuard --- UI Tokens

## 1. Purpose

These tokens create a single visual system so AI agents do not invent
different colors, spacing, radii, or typography on every page.

------------------------------------------------------------------------

## 2. Color Roles

The reference UI uses a healthcare palette centered around deep teal and
green.

Use semantic variables rather than hardcoded colors.

``` css
:root {
  --color-primary-950: #063f37;
  --color-primary-900: #075548;
  --color-primary-800: #08745d;
  --color-primary-700: #07875f;
  --color-primary-600: #0a9a69;
  --color-primary-500: #16a878;

  --color-surface: #ffffff;
  --color-surface-muted: #f7faf9;
  --color-background: #f5f7f7;

  --color-text: #17201e;
  --color-text-muted: #6b7774;
  --color-border: #e3e9e7;

  --color-success: #149447;
  --color-warning: #f59e0b;
  --color-danger: #ef3d3d;
  --color-info: #2879d8;
}
```

These are starting tokens. Preserve the screenshot's visual appearance
when tuning.

------------------------------------------------------------------------

## 3. Typography

Recommended:

``` text
Font family: Inter/system sans-serif
```

Hierarchy:

``` text
Display: 28–36px
Page title: 20–24px
Section title: 15–18px
Body: 13–15px
Caption: 11–12px
```

Use medium/semibold weights for labels and headings.

Avoid oversized typography inside operational tables.

------------------------------------------------------------------------

## 4. Spacing

Base unit:

``` text
4px
```

Suggested:

``` text
4
8
12
16
20
24
32
40
48
64
```

------------------------------------------------------------------------

## 5. Radius

``` text
small: 6px
medium: 8px
large: 12px
xl: 16px
pill: 999px
```

Reference UI generally favors modest rounding rather than extreme pill
cards.

------------------------------------------------------------------------

## 6. Shadows

Use subtle elevation:

``` text
shadow-sm
shadow-card
shadow-modal
```

Do not create heavy floating cards.

------------------------------------------------------------------------

## 7. Borders

Default:

``` text
1px solid var(--color-border)
```

Use stronger borders only for:

-   Focus.
-   Selected state.
-   Validation.
-   High-priority status.

------------------------------------------------------------------------

## 8. Status Tokens

``` css
--status-safe
--status-success
--status-warning
--status-critical
--status-expired
--status-info
--status-quarantine
```

Each status must have:

-   Background.
-   Foreground.
-   Border.
-   Icon.

------------------------------------------------------------------------

## 9. Layout

Desktop sidebar target:

``` text
220–250px
```

Content:

``` text
max-width: 1440px
```

Page padding:

``` text
desktop: 24px
tablet: 20px
mobile: 16px
```

------------------------------------------------------------------------

## 10. Motion

Use:

-   120--200ms for micro-interactions.
-   200--300ms for drawers/modals.
-   Subtle skeleton shimmer.

Respect:

``` css
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

------------------------------------------------------------------------

## 11. Responsive Tokens

Use CSS/container queries where appropriate.

Never hardcode a component to one viewport width.

------------------------------------------------------------------------

## 12. Token Rule

If a visual value is reused twice, consider making it a token.

Do not introduce one-off styles when a shared token exists.
