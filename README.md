# PharmaGuard

## Expiry, Inventory & Compliance Management SaaS for Pharmacies

> **Never sell an expired medicine again.**

PharmaGuard is a web-based SaaS platform designed for independent pharmacies to manage medicine inventory, batch and expiry information, low-stock alerts, sales activity, safety workflows, suppliers, reorders, analytics, and compliance-related records from one centralized system.

The core idea is simple:

**Upload a photo of a medicine package → PharmaGuard extracts the medicine/batch/expiry information → pharmacist reviews it → inventory is updated → the system monitors expiry and stock levels automatically.**

PharmaGuard is designed specifically around the operational realities of small and independent pharmacies rather than large pharmacy chains.

---

# Table of Contents

- [Project Overview](#project-overview)
- [Problem](#problem)
- [Solution](#solution)
- [Target Users](#target-users)
- [Product Vision](#product-vision)
- [MVP](#mvp)
- [MVP User Journey](#mvp-user-journey)
- [Core Features](#core-features)
- [SaaS Features](#saas-features)
- [AI Features](#ai-features)
- [Safety Features](#safety-features)
- [Inventory Management](#inventory-management)
- [Expiry Management](#expiry-management)
- [Sales Management](#sales-management)
- [Supplier & Purchase Management](#supplier--purchase-management)
- [Reorder Management](#reorder-management)
- [Analytics](#analytics)
- [Reports & Compliance](#reports--compliance)
- [Authentication & Authorization](#authentication--authorization)
- [User Roles](#user-roles)
- [Multi-Tenant Architecture](#multi-tenant-architecture)
- [Technology Stack](#technology-stack)
- [Architecture](#architecture)
- [Repository Structure](#repository-structure)
- [Database](#database)
- [AI OCR Architecture](#ai-ocr-architecture)
- [Security](#security)
- [Rate Limiting](#rate-limiting)
- [Validation](#validation)
- [Environment Variables](#environment-variables)
- [Local Development](#local-development)
- [Installation](#installation)
- [Running the Project](#running-the-project)
- [Database Setup](#database-setup)
- [Testing](#testing)
- [Development Workflow](#development-workflow)
- [Phase-by-Phase Development](#phase-by-phase-development)
- [UI/UX](#uiux)
- [Responsive Design](#responsive-design)
- [Loading & Error States](#loading--error-states)
- [API Architecture](#api-architecture)
- [Coding Standards](#coding-standards)
- [Documentation](#documentation)
- [Progress Tracking](#progress-tracking)
- [AI Coding Agent Rules](#ai-coding-agent-rules)
- [Deployment](#deployment)
- [Monitoring](#monitoring)
- [Business Model](#business-model)
- [Pricing Strategy](#pricing-strategy)
- [SaaS Growth Strategy](#saas-growth-strategy)
- [Future Roadmap](#future-roadmap)
- [Competitive Advantage](#competitive-advantage)
- [Risks](#risks)
- [Non-Goals](#non-goals)
- [Project Status](#project-status)
- [Contributing](#contributing)
- [License](#license)

---

# Project Overview

PharmaGuard is a pharmacy-focused SaaS platform for managing medicine inventory and safety.

Small pharmacies frequently rely on:

- paper registers
- spreadsheets
- manual expiry checking
- manual stock counting
- disconnected billing systems
- memory-based reordering
- manual supplier communication

This creates several problems:

- expired medicine may remain on shelves
- medicines may expire before being sold
- fast-moving medicines can become out of stock
- pharmacy owners may not know what stock is approaching expiry
- manual data entry consumes staff time
- stock information may be inaccurate
- safety-related records can be difficult to maintain

PharmaGuard addresses these problems through a lightweight web application focused on:

**Inventory + Expiry + Safety + Alerts + AI-assisted data entry + Analytics**

---

# Problem

## The Core Problem

Independent pharmacies need an affordable and simple way to know:

1. What medicine do I have?
2. Which batch does it belong to?
3. When does it expire?
4. What is running low?
5. What should I reorder?
6. What should I remove from sale?
7. What stock is already expired?
8. What stock is approaching expiry?
9. What medicines are selling quickly?
10. What actions have staff taken?

Traditional pharmacy software often focuses heavily on billing/POS functionality.

PharmaGuard instead focuses on **stock safety and expiry intelligence**.

---

# Solution

PharmaGuard provides a centralized pharmacy operations dashboard.

The main workflow is:

```text
Medicine Package
       |
       v
Manual Image Upload
       |
       v
AI OCR
       |
       v
Extract:
Medicine
Batch Number
Expiry Date
Quantity
       |
       v
Human Review
       |
       v
Confirmation
       |
       v
Inventory
       |
       +----------------+
       |                |
       v                v
Expiry Monitoring    Stock Monitoring
       |                |
       v                v
Expiry Alerts       Low Stock Alerts
       |                |
       +--------+-------+
                |
                v
        Reorder Suggestions
````

---

# Target Users

## Primary Users

### Independent Pharmacy Owner

Needs:

- inventory visibility
- expiry monitoring
- sales information
- reorder recommendations
- supplier management
- reports
- staff management

### Pharmacist

Needs:

- medicine lookup
- expiry tracking
- batch management
- safety alerts
- sales recording
- quarantine/recall workflows

### Pharmacy Staff

Needs:

- quick stock lookup
- medicine entry
- sales entry
- receiving stock
- expiry notifications

---

# Product Vision

The long-term vision is to become a pharmacy operations platform that connects:

```text
Pharmacy
   |
   +-- Inventory
   |
   +-- Expiry
   |
   +-- Sales
   |
   +-- Suppliers
   |
   +-- Reorders
   |
   +-- Safety
   |
   +-- Analytics
   |
   +-- Compliance
   |
   +-- Distributor Network
```

The first version focuses on the most important problem:

> **Prevent expired medicines from being sold while reducing inventory-management effort.**

---

# MVP

The MVP is intentionally focused.

## MVP Features

### 1. Authentication

- Sign up
- Login
- Logout
- Password reset
- Session management
- Protected routes

### 2. Pharmacy Onboarding

- Create pharmacy
- Pharmacy profile
- Basic configuration
- User membership

### 3. Dashboard

Dashboard provides:

- total medicines
- total inventory value
- low-stock medicines
- medicines expiring soon
- expired medicines
- recent sales
- recent alerts
- inventory summary

### 4. AI Medicine OCR

User manually uploads an image.

PharmaGuard extracts:

- medicine name
- strength
- batch number
- expiry date
- manufacturer where available

The pharmacist can:

- review
- edit
- reject
- confirm

AI output must never automatically become trusted inventory data without confirmation.

### 5. Inventory

Users can:

- create medicines
- add batches
- update stock
- search medicines
- filter medicines
- view batch information
- view expiry
- view stock levels

### 6. Expiry Monitoring

PharmaGuard categorizes inventory:

- Expired
- Critical
- Expiring Soon
- Safe

Example:

```text
Expired
0 days or past expiry

Critical
≤ 30 days

Expiring Soon
31–90 days

Safe
> 90 days
```

The exact thresholds must remain configurable according to the product requirements.

### 7. Alerts

Alerts include:

- expired medicine
- medicine approaching expiry
- low stock
- critical stock
- reorder recommendation

### 8. Sales Log

MVP sales functionality:

- record sale
- medicine
- batch
- quantity
- selling price
- timestamp
- staff member

Inventory quantity must update safely.

### 9. Basic Reorder Intelligence

Use a simple statistical model.

Example inputs:

- recent sales velocity
- current quantity
- minimum stock
- lead time

The MVP does not require custom machine learning.

### 10. Responsive Web UI

The product must work on:

- desktop
- laptop
- tablet
- mobile browser

No native mobile application is required for the MVP.

---

# MVP User Journey

```text
Visit PharmaGuard
       |
       v
Sign Up
       |
       v
Create Pharmacy
       |
       v
Dashboard
       |
       v
Upload Medicine Image
       |
       v
OCR Extraction
       |
       v
Review Data
       |
       v
Confirm
       |
       v
Inventory Updated
       |
       v
Expiry Monitoring
       |
       +------------------+
       |                  |
       v                  v
Expiry Alert         Low Stock Alert
       |                  |
       +--------+---------+
                |
                v
          Reorder Suggestion
```

---

# Core Features

## Dashboard

The dashboard is the central operational screen.

It should provide:

- inventory KPIs
- expiry KPIs
- low-stock KPIs
- sales summary
- recent activity
- alerts
- quick actions

Primary quick actions:

- Add Medicine
- Scan Medicine
- Record Sale
- Add Stock
- View Expiring Items

---

# SaaS Features

PharmaGuard is designed as a multi-tenant SaaS application.

SaaS functionality includes:

- pharmacy accounts
- subscriptions
- plans
- usage limits
- user memberships
- role-based permissions
- billing status
- feature access
- organization settings

---

# Suggested SaaS Plans

## Starter

Example:

**PKR 1,500/month**

Suitable for small pharmacies.

Potential limits:

- 1 pharmacy
- limited users
- inventory
- expiry tracking
- basic alerts
- basic reports

---

## Professional

Example:

**PKR 2,500/month**

Includes:

- more users
- advanced analytics
- AI OCR
- reorder intelligence
- supplier management
- advanced reports
- audit history

---

## Business

Example:

**PKR 4,000/month**

Includes:

- larger user limits
- advanced analytics
- compliance reports
- advanced safety workflows
- priority support
- future distributor integrations

Pricing is subject to product validation and should not be hardcoded throughout the application.

---

# AI Features

## AI OCR

The AI OCR system is one of PharmaGuard's primary differentiators.

The system should extract structured information from medicine packaging.

Potential fields:

```text
medicine_name
generic_name
strength
dosage_form
manufacturer
batch_number
expiry_date
pack_size
```

Not every field is guaranteed to be available.

The AI must return confidence/uncertainty where appropriate.

---

# AI Safety Rule

AI output must never be treated as unquestionable truth.

Required workflow:

```text
Upload
  ↓
OCR
  ↓
Validation
  ↓
Review
  ↓
Edit
  ↓
Confirm
  ↓
Persist
```

A human must approve important inventory data.

---

# Expiry Management

Expiry management is one of the most important PharmaGuard modules.

The system should identify:

- expired stock
- near-expiry stock
- future expiry
- batches
- quantities at risk
- estimated inventory value at risk

---

# FEFO

PharmaGuard should support:

**First Expired, First Out (FEFO)**

When selecting batches for sale or stock movement, batches with earlier expiry dates should be prioritized when appropriate.

---

# Safety Features

## Quarantine

Allow authorized staff to move inventory into quarantine.

Reasons may include:

- suspected damage
- expired stock
- recall
- packaging issue
- quality concern

Quarantined stock should not be treated as normal sellable stock.

---

# Recall Center

Support recall-related workflows.

Potential information:

- medicine
- batch
- manufacturer
- reason
- affected quantity
- recall date
- status
- notes

---

# Audit Logs

Important actions should be recorded.

Examples:

- login
- logout
- medicine creation
- medicine update
- stock adjustment
- sale
- sale reversal
- quarantine
- recall
- user creation
- permission changes
- settings changes

---

# Inventory Management

Inventory entities include:

```text
Medicine
Batch
Stock
Stock Movement
```

Medicine information may include:

- name
- generic name
- strength
- dosage form
- manufacturer

Batch information may include:

- batch number
- expiry date
- purchase price
- selling price
- quantity

---

# Stock Movements

Stock movement types may include:

```text
PURCHASE
SALE
RETURN
ADJUSTMENT
QUARANTINE
RELEASE
EXPIRED
DAMAGED
RECALL
```

All stock-changing operations must be auditable.

---

# Sales Management

Sales should support:

- medicine
- batch
- quantity
- unit price
- total
- staff
- timestamp

Sales must use safe inventory transactions.

A sale must not be created if sufficient stock is unavailable.

---

# Supplier & Purchase Management

Future and extended functionality includes:

- suppliers
- purchase orders
- receiving
- purchase history
- supplier contact information
- purchase pricing
- expected delivery
- lead time

---

# Reorder Management

Reorder suggestions can consider:

```text
Current Stock
+
Average Daily Sales
+
Lead Time
+
Safety Stock
```

Example conceptual formula:

```text
Reorder Point =
Average Daily Sales × Lead Time
+ Safety Stock
```

The exact calculation should be implemented according to the technical requirements.

---

# Analytics

Analytics can include:

- sales trends
- top-selling medicines
- slow-moving medicines
- inventory value
- expiry exposure
- stock turnover
- estimated margins
- reorder trends

---

# Reports & Compliance

Potential reports include:

- inventory report
- expiry report
- expired stock report
- sales report
- purchase report
- stock movement report
- audit report
- quarantine report
- recall report

Compliance functionality must be implemented carefully and must not claim regulatory compliance unless requirements have been verified.

---

# Authentication & Authorization

Authentication is handled securely.

Required functionality:

- signup
- login
- logout
- password reset
- session handling
- protected routes

Authorization is separate from authentication.

A logged-in user does not automatically have access to every resource.

---

# User Roles

Potential roles:

## Owner

Full pharmacy access.

## Pharmacist

Operational pharmacy access.

## Staff

Limited operational access.

## Manager

Operational and reporting access.

## Platform Admin

Platform-level administrative access.

Platform admin access must be separated from pharmacy tenant access.

---

# Multi-Tenant Architecture

PharmaGuard is multi-tenant.

The fundamental security model is:

```text
User
 |
 v
Membership
 |
 v
Pharmacy
 |
 +---- Medicines
 |
 +---- Batches
 |
 +---- Sales
 |
 +---- Purchases
 |
 +---- Suppliers
 |
 +---- Alerts
 |
 +---- Audit Logs
```

A user must never be able to access another pharmacy's data.

Tenant isolation must be enforced at:

1. API authorization
2. Database RLS
3. Query scoping
4. Business logic

Frontend filtering is NOT a security mechanism.

---

# Technology Stack

## Frontend

- Next.js
- React
- TypeScript
- Tailwind CSS or established project CSS system
- Accessible UI primitives
- Recharts where required and verified

## Backend

- Node.js
- Express
- TypeScript
- Zod or verified validation library

## Database

- Supabase
- PostgreSQL
- Row-Level Security

## AI

- Gemini Vision API

## Architecture

```text
Browser
   |
   | HTTPS
   v
Next.js / React
   |
   | Authenticated API Requests
   v
Node.js / Express
   |
   +----------------------+
   |                      |
   v                      v
Supabase PostgreSQL    Gemini Vision
   |
   +-- RLS
   +-- Transactions
   +-- Indexes
   +-- Audit Logs
```

---

# Repository Structure

Recommended structure:

```text
PharmaGuard/
│
├── apps/
│   │
│   ├── web/
│   │   └── src/
│   │
│   └── api/
│       └── src/
│
├── packages/
│   │
│   ├── validation/
│   ├── ui/
│   ├── types/
│   └── config/
│
├── supabase/
│   │
│   ├── migrations/
│   ├── seed/
│   └── config.toml
│
├── docs/
│   │
│   ├── PharmaGuard_PRD.md
│   ├── PharmaGuard_SRD.md
│   ├── PharmaGuard_TRD.md
│   ├── architecture.md
│   ├── project-overview.md
│   ├── code-standards.md
│   ├── ui-rules.md
│   ├── ui-tokens.md
│   ├── library-docs.md
│   ├── build-plan.md
│   ├── progress-tracker.md
│   └── ui-registry.md
│
├── reference-ui/
│   └── PharmaGuard_UI_Reference.png
│
├── .env.example
├── README.md
└── remember.md
```

---

# Database

The database is implemented using Supabase PostgreSQL.

Core entities may include:

```text
profiles
pharmacies
pharmacy_members
medicines
medicine_batches
stock_movements
sales
sale_items
suppliers
purchase_orders
purchase_items
alerts
quarantine_records
recalls
audit_logs
subscriptions
plans
```

The final schema must follow the authoritative TRD/SRD and migrations.

Do not invent database tables merely because they appear in this README.

---

# Row-Level Security

RLS must be enabled for every application table containing tenant data.

Policies must ensure:

```text
Authenticated User
       |
       v
Valid Pharmacy Membership
       |
       v
Allowed Pharmacy Record
```

A user from Pharmacy A must never be able to query Pharmacy B.

---

# AI OCR Architecture

```text
Browser
   |
   | Upload Image
   v
Backend
   |
   | Validate File
   v
OCR Service
   |
   v
Gemini Vision
   |
   v
Structured OCR Result
   |
   v
Backend Validation
   |
   v
Frontend Review
   |
   +---- Edit
   |
   +---- Reject
   |
   +---- Confirm
            |
            v
        Database
```

The Gemini API key must remain server-side.

---

# Security

Security is a first-class product requirement.

## Secrets

Never expose:

- Supabase secret/service-role key
- Gemini API key
- database credentials
- JWT secrets
- payment secrets
- email/SMS secrets
- encryption keys

Never use:

```text
NEXT_PUBLIC_SUPABASE_SECRET_KEY
```

Private credentials must remain server-side.

---

# Rate Limiting

Rate limiting must be applied to backend endpoints.

Sensitive endpoints require stricter limits.

Examples:

```text
Login
Password Reset
Signup
OCR
Expensive Analytics
Public APIs
```

Rate limiting should protect against:

- brute force
- abuse
- scraping
- automated requests
- resource exhaustion

For production multi-instance deployment, use an appropriate distributed strategy.

---

# Validation

Client-side validation improves UX.

Backend validation is authoritative.

Validate:

- IDs
- dates
- quantities
- prices
- strings
- enums
- emails
- uploads
- pagination
- filters
- sorting

Never trust browser input.

---

# XSS Protection

Do not render untrusted HTML.

Avoid:

```javascript
dangerouslySetInnerHTML
```

unless absolutely necessary and safely sanitized.

Treat OCR results and user-entered content as untrusted.

---

# SQL Injection Protection

Never concatenate user input into SQL.

Use:

- Supabase query builders
- parameterized queries
- allowlists for dynamic query options

---

# CORS

Production CORS must only allow trusted application origins.

Do not use:

```text
Access-Control-Allow-Origin: *
```

for authenticated production APIs.

---

# Environment Variables

Use:

```text
.env
.env.local
```

Real secrets must never be committed.

Only commit:

```text
.env.example
```

Example:

```env
SUPABASE_URL=
SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SECRET_KEY=
SUPABASE_JWKS_URL=
GEMINI_API_KEY=
FRONTEND_URL=
API_URL=
```

The example file must never contain real secrets.

---

# Local Development

## Requirements

Recommended:

- Node.js 20+
- npm/pnpm according to the existing repository
- Git
- Supabase project
- Gemini API access for OCR development

Use the project's existing package manager.

Do not introduce a second package manager unnecessarily.

---

# Installation

Clone the repository:

```bash
git clone <repository-url>
cd PharmaGuard
```

Install dependencies using the package manager already configured by the repository.

For npm:

```bash
npm install
```

For pnpm:

```bash
pnpm install
```

---

# Environment Setup

Create the appropriate local environment files.

Example:

```bash
cp .env.example .env
```

On Windows, create the file manually if necessary.

Never commit the real `.env`.

---

# Running the Project

Typical development setup:

### Web

```bash
npm run dev --workspace=@pharmaguard/web
```

### API

```bash
npm run dev --workspace=@pharmaguard/api
```

The exact commands must follow the repository's package configuration.

---

# Database Setup

Supabase migrations should be used for database changes.

Recommended workflow:

```text
Create Migration
      ↓
Review SQL
      ↓
Review RLS
      ↓
Apply Migration
      ↓
Test
      ↓
Update Documentation
```

Never manually modify production schema without documenting the change.

---

# Testing

The project should use multiple testing levels.

## Type Checking

```bash
npm run typecheck
```

## Linting

```bash
npm run lint
```

## Unit Tests

```bash
npm test
```

## Integration Tests

Test:

- API
- database
- authentication
- authorization
- RLS

## E2E Tests

Critical flow:

```text
Signup
 ↓
Login
 ↓
Dashboard
 ↓
OCR
 ↓
Review
 ↓
Confirm
 ↓
Inventory
 ↓
Sale
 ↓
Stock Update
 ↓
Alert
 ↓
Logout
```

---

# Development Workflow

PharmaGuard must be built phase-by-phase.

Do not attempt to generate the entire application in one uncontrolled operation.

Each phase follows:

```text
READ
 ↓
INSPECT
 ↓
PLAN
 ↓
IMPLEMENT
 ↓
CONNECT
 ↓
VALIDATE
 ↓
TEST
 ↓
REGRESSION CHECK
 ↓
DOCUMENT
 ↓
NEXT PHASE
```

---

# Phase-by-Phase Development

## Phase 0 — Discovery

- Read all documentation
- Inspect repository
- Inspect UI reference
- Map dependencies
- Identify conflicts
- Identify missing implementation

---

## Phase 1 — Foundation

- Monorepo setup
- TypeScript
- shared packages
- configuration
- API foundation
- frontend foundation
- Supabase connection

---

## Phase 2 — Authentication

- Signup
- Login
- Logout
- Password reset
- Session management
- Protected routes

---

## Phase 3 — Dashboard

- App shell
- Sidebar
- Header
- KPI cards
- Alerts
- Recent activity
- Dashboard API

---

## Phase 4 — Inventory

- Medicines
- Batches
- Stock
- Search
- Filtering
- Pagination
- CRUD
- RLS

---

## Phase 5 — AI OCR

- Upload
- File validation
- Gemini integration
- OCR extraction
- Review
- Confirmation
- Inventory integration

---

## Phase 6 — Expiry & Safety

- Expiry calculations
- Expiry dashboard
- Quarantine
- Recall
- Safety alerts
- Audit events

---

## Phase 7 — Sales

- Sales
- Sale items
- Batch selection
- FEFO
- Inventory transactions
- Sales history

---

## Phase 8 — Purchases & Suppliers

- Suppliers
- Purchase orders
- Receiving
- Stock updates
- Supplier history

---

## Phase 9 — Reorders

- Low stock
- Reorder recommendations
- Reorder workflows
- Supplier connection

---

## Phase 10 — Analytics

- Sales analytics
- Inventory analytics
- Expiry analytics
- Stock movement
- Trends

---

## Phase 11 — Reports

- Inventory reports
- Expiry reports
- Sales reports
- Audit reports
- Safety reports

---

## Phase 12 — Administration

- Users
- Roles
- Permissions
- Pharmacy settings
- Profile
- Notification settings
- Security settings

---

## Phase 13 — Security Hardening

- RLS review
- CORS
- Rate limiting
- validation
- upload security
- authorization
- audit logs
- secret scanning

---

## Phase 14 — QA

- Unit tests
- Integration tests
- E2E
- RLS tests
- security tests
- responsive tests
- regression tests

---

## Phase 15 — Production Readiness

- Build verification
- environment verification
- migration verification
- observability
- deployment
- final documentation
- final security audit

---

# UI/UX

The supplied reference image is the primary visual reference for the PharmaGuard interface.

The UI should maintain:

- deep teal sidebar
- green primary actions
- white/light surfaces
- compact cards
- rounded cards
- thin borders
- subtle shadows
- dense but readable tables
- clear status badges
- professional healthcare SaaS visual language

The application must not be redesigned into an unrelated dashboard style.

---

# Required Pages

Public:

- Landing
- Pricing
- Login
- Sign Up
- Forgot Password
- Reset Password

Application:

- Dashboard
- AI Scan
- Inventory
- Medicine Details
- Expiry Center
- Sales
- Purchases
- Suppliers
- Reorders
- Returns
- Quarantine
- Recall Center
- Alerts
- Analytics
- Reports
- Compliance & Audit
- Users
- Settings
- Profile

System:

- 404
- 500
- Unauthorized
- Forbidden
- Maintenance/Error states where appropriate

---

# Responsive Design

PharmaGuard is a web application.

It must work on:

```text
Desktop
Laptop
Tablet
Mobile Browser
```

Suggested breakpoints:

```text
< 640px
Mobile

640px – 1023px
Tablet

>= 1024px
Desktop
```

Mobile behavior should include:

- collapsible sidebar
- mobile navigation drawer
- responsive cards
- responsive forms
- responsive modals
- responsive charts
- usable tables
- no unintended horizontal overflow

---

# Loading & Error States

Every data-heavy screen should implement:

```text
Loading
Skeleton
Empty
Error
Retry
Success
```

Skeletons should preserve the actual page layout.

Do not use a generic full-screen spinner as the only loading experience.

---

# API Architecture

Example API structure:

```text
/api/auth/*
/api/dashboard/*
/api/medicines/*
/api/inventory/*
/api/batches/*
/api/ocr/*
/api/expiry/*
/api/sales/*
/api/purchases/*
/api/suppliers/*
/api/reorders/*
/api/returns/*
/api/quarantine/*
/api/recalls/*
/api/alerts/*
/api/analytics/*
/api/reports/*
/api/users/*
/api/settings/*
```

Routes should only be implemented when required by the actual product specification.

---

# API Response Convention

Successful response:

```json
{
  "success": true,
  "data": {}
}
```

Error response:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request"
  }
}
```

Do not expose internal stack traces or database errors.

---

# Coding Standards

Follow:

```text
code-standards.md
```

Key principles:

- TypeScript strictness
- clear naming
- reusable components
- small modules
- separation of concerns
- no duplicated business logic
- no secret leakage
- backend validation
- consistent error handling
- test important business logic

---

# Documentation

The following documents define the implementation:

```text
docs/
├── PharmaGuard_PRD.md
├── PharmaGuard_SRD.md
├── PharmaGuard_TRD.md
├── architecture.md
├── project-overview.md
├── code-standards.md
├── ui-rules.md
├── ui-tokens.md
├── library-docs.md
├── build-plan.md
├── progress-tracker.md
└── ui-registry.md
```

These files must remain synchronized with the implementation.

---

# Progress Tracking

`progress-tracker.md` is a living project document.

Statuses:

```text
[ ] Not Started
[~] In Progress
[x] Complete
[!] Blocked
[R] Requires Regression Review
```

Never mark an item complete unless it has actually been implemented and validated.

---

# AI Coding Agent Rules

AI coding agents working on PharmaGuard MUST:

1. Read all project `.md` files before major implementation.
2. Inspect the existing repository before modifying it.
3. Read the UI reference image.
4. Follow the phase order.
5. Never hallucinate dependencies.
6. Never invent undocumented APIs.
7. Never invent database structures unnecessarily.
8. Never expose secrets.
9. Never disable RLS to solve an access problem.
10. Never bypass backend authorization.
11. Never remove security controls to make tests pass.
12. Never rewrite the whole application to fix one bug.
13. Analyze dependencies before modifying shared code.
14. Perform regression checks after changes.
15. Update `progress-tracker.md`.
16. Update relevant documentation when architecture changes.
17. Update `ui-registry.md` when reusable UI components are created.
18. Keep frontend and backend responsibilities separate.
19. Use real backend/database connections.
20. Do not build a fake static dashboard.

---

# No Hallucination Policy

If the agent does not know something:

```text
DO NOT GUESS.
```

Instead:

```text
Inspect documentation
        ↓
Inspect repository
        ↓
Inspect package configuration
        ↓
Inspect database
        ↓
Inspect existing implementation
        ↓
Determine supported solution
```

If ambiguity remains, report it.

---

# UI Source of Truth

The reference image:

```text
reference-ui/PharmaGuard_UI_Reference.png
```

must be treated as the primary visual reference.

The implementation should reproduce the visual structure as closely as technically possible.

The agent must not:

- redesign the dashboard
- invent a different sidebar
- replace the design system
- randomly change spacing
- randomly change colors
- replace the layout with a generic SaaS template

Additional functionality should use the established PharmaGuard design system.

---

# Regression Protection

Before changing shared components, determine their dependents.

For example:

```text
AppShell
Sidebar
Header
Card
Table
Modal
Button
Input
Badge
Chart
```

After modifying one:

```text
Identify dependents
       ↓
Make change
       ↓
Run tests
       ↓
Check dependent pages
       ↓
Check responsive behavior
       ↓
Update progress tracker
```

---

# Deployment

The final deployment architecture should separate:

```text
Frontend
   |
   v
Web Hosting

Backend
   |
   v
API Hosting

Database
   |
   v
Supabase

AI
   |
   v
Gemini
```

Secrets must be configured using the hosting provider's secret/environment-variable system.

Never commit production credentials.

---

# Monitoring

Production monitoring should eventually cover:

- API errors
- frontend errors
- authentication failures
- rate-limit events
- OCR failures
- database errors
- slow API requests
- failed transactions
- suspicious authorization failures

Do not log sensitive data unnecessarily.

Never log:

- passwords
- access tokens
- API keys
- secret credentials

---

# Business Model

PharmaGuard follows a SaaS model.

Primary revenue:

```text
Monthly subscription
        +
Optional future transaction/distributor revenue
```

Potential pricing:

```text
Starter
PKR 1,500/month

Professional
PKR 2,500/month

Business
PKR 4,000/month
```

Pricing must remain configurable.

Do not hardcode pricing into business logic.

---

# SaaS Growth Strategy

## Stage 1

Target independent pharmacies.

Focus on:

- expiry
- inventory
- OCR
- alerts

## Stage 2

Add:

- suppliers
- purchases
- reorders
- analytics
- staff management

## Stage 3

Add:

- distributor integration
- automated ordering
- advanced reporting
- multi-branch support

## Stage 4

Build a broader pharmacy operations network.

---

# Competitive Advantage

The core wedge is:

## OCR-first inventory entry

Traditional systems may require:

```text
Search medicine
↓
Enter SKU
↓
Enter batch
↓
Enter expiry
↓
Enter quantity
↓
Save
```

PharmaGuard aims for:

```text
Upload Image
↓
AI Extraction
↓
Review
↓
Confirm
```

This reduces the largest barrier to inventory digitization:

**manual data entry.**

---

# Risks

## Technology Risks

- OCR errors
- AI hallucinations
- database mistakes
- API failures
- integration failures

Mitigation:

- validation
- human confirmation
- audit logs
- tests
- secure transactions

---

## Business Risks

- pharmacy owner reluctance
- low willingness to pay
- existing POS systems
- sales/onboarding difficulty

Mitigation:

- simple UX
- low pricing
- fast onboarding
- OCR shortcut
- clear ROI

---

## Security Risks

- cross-tenant data access
- exposed credentials
- weak RLS
- brute force
- XSS
- SQL injection
- malicious uploads

Mitigation:

- RLS
- authorization
- rate limiting
- validation
- CORS
- secure upload handling
- security testing

---

# Non-Goals

The MVP does NOT attempt to become:

- a complete hospital management system
- a medical diagnosis system
- a patient medical-record system
- a national drug-regulatory database
- a replacement for professional pharmacy judgment
- a fully autonomous medicine ordering system
- a native mobile application

The product is focused on pharmacy inventory and safety operations.

---

# Regulatory Disclaimer

PharmaGuard is a software management tool.

It should not make claims of official regulatory certification or compliance unless those claims have been independently verified and formally supported.

Regulatory workflows should be implemented based on verified requirements.

---

# Project Status

Current development status:

```text
MVP Development
████████░░░░░░░░░░░░  In Progress
```

The actual status must be maintained in:

```text
docs/progress-tracker.md
```

---

# Definition of Done

A feature is complete only when applicable:

- frontend implemented
- backend implemented
- database connected
- validation implemented
- authorization implemented
- RLS implemented
- loading state implemented
- skeleton state implemented
- empty state implemented
- error state implemented
- responsive behavior implemented
- tests implemented
- regression checks completed
- documentation updated

---

# Production Completion Checklist

## Frontend

-  UI implemented
-  UI matches reference
-  Responsive
-  Accessibility reviewed
-  Skeleton states
-  Empty states
-  Error states

## Backend

-  API routes
-  Authentication
-  Authorization
-  Validation
-  Rate limiting
-  CORS
-  Error handling

## Database

-  Migrations
-  Constraints
-  Indexes
-  Foreign keys
-  RLS
-  RLS tests
-  Transactions

## AI

-  OCR
-  Server-side API key
-  File validation
-  OCR validation
-  Human confirmation

## Security

-  Secrets protected
-  XSS protection
-  SQL injection protection
-  Authorization tests
-  Tenant isolation
-  Rate-limit tests
-  Upload security

## Testing

-  Typecheck
-  Lint
-  Unit tests
-  Integration tests
-  E2E
-  RLS tests
-  Security tests
-  Responsive testing

## Documentation

-  PRD synchronized
-  SRD synchronized
-  TRD synchronized
-  architecture synchronized
-  UI documentation synchronized
-  progress-tracker.md updated
-  ui-registry.md updated
-  remember.md created

---

# Future Roadmap

Potential future functionality:

## Distributor Integration

```text
Low Stock
   ↓
Reorder Suggestion
   ↓
Distributor API
   ↓
Order
   ↓
Confirmation
   ↓
Receiving
```

---

## Multi-Branch Pharmacy

Support:

```text
Organization
   |
   +-- Branch A
   |
   +-- Branch B
   |
   +-- Branch C
```

Potential features:

- branch-level inventory
- centralized reporting
- stock transfers
- branch permissions

---

## Advanced AI

Future AI capabilities may include:

- medicine recognition
- packaging anomaly detection
- demand forecasting
- intelligent reorder optimization
- anomaly detection
- natural-language analytics

AI must remain assistive and auditable.

---

# Long-Term Vision

PharmaGuard can evolve from an expiry tracker into a complete pharmacy operations platform.

```text
                PHARMAGUARD
                     |
       +-------------+-------------+
       |             |             |
   Inventory       Safety       Sales
       |             |             |
       +-------------+-------------+
                     |
                 Analytics
                     |
                Reordering
                     |
                 Suppliers
                     |
               Distributors
                     |
               Multi-Branch
```

The ultimate objective is:

> Make pharmacy inventory safer, simpler, and more intelligent.

---

# Contributing

Contributions should follow the project's documentation and engineering standards.

Before contributing:

1. Read the relevant `.md` files.
2. Understand the architecture.
3. Check existing components.
4. Check the UI registry.
5. Check the progress tracker.
6. Implement the smallest safe change.
7. Add tests.
8. Perform regression testing.
9. Update documentation.

---

# License

License information should be added when the project's licensing decision is finalized.

---

# PharmaGuard

**Expiry & Inventory Intelligence for Modern Pharmacies**

Built around one simple principle:

> **Know what you have. Know when it expires. Know what to reorder.**

````

### Recommended repo layout

I would keep the README at the **root**, not inside `docs`:

```text
PharmaGuard/
│
├── README.md                 ← this file
│
├── apps/
│   ├── web/
│   └── api/
│
├── packages/
│   ├── validation/
│   ├── ui/
│   ├── types/
│   └── config/
├── .env.example

