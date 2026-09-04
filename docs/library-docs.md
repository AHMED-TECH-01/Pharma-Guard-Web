# PharmaGuard --- Library and Dependency Guide

## 1. Rule

Only use real, verified, maintained packages.

Before adding a dependency, an AI agent must verify:

-   Package exists.
-   Package is maintained.
-   Package is compatible with the current runtime.
-   Package license is acceptable.
-   Package is not duplicating an existing dependency.
-   Package is necessary.

Never invent package names.

------------------------------------------------------------------------

## 2. Core Stack

### Frontend

Recommended:

-   Next.js.
-   React.
-   TypeScript.

### Styling

Use whichever styling system is already established in the repository.

Preferred options:

-   Tailwind CSS.
-   CSS Modules.
-   Well-structured global CSS.

Do not migrate the styling system casually.

### Backend

-   Node.js.
-   Express.
-   TypeScript.

### Database

-   Supabase PostgreSQL.

### Authentication

-   Supabase Auth where appropriate.

### Validation

-   Zod or another verified validation library.

### Charts

-   Recharts or an already installed equivalent.

### Icons

Use one established icon package consistently. Verify it before adding.

------------------------------------------------------------------------

## 3. Supabase

Required concepts:

-   Supabase URL.
-   Publishable key.
-   Server-only secret key.
-   Auth.
-   PostgreSQL.
-   RLS.

Never expose the server-only secret.

------------------------------------------------------------------------

## 4. Gemini Vision

Use Gemini Vision only through a backend-controlled integration.

Flow:

``` text
Browser
→ Backend
→ Gemini
→ Backend validation
→ Browser review
```

Do not call Gemini directly from browser code using a private API key.

------------------------------------------------------------------------

## 5. File Upload

Use established multipart/file handling already present in the backend
where possible.

Requirements:

-   MIME validation.
-   Extension validation.
-   Size limit.
-   Safe filename handling.
-   Private storage.
-   Temporary retention policy.

------------------------------------------------------------------------

## 6. Security Packages

Do not automatically add a package just because an AI model knows its
name.

Verify current package documentation and maintenance before
installation.

Potential categories:

-   Rate limiting.
-   Security headers.
-   CORS.
-   Input validation.
-   Sanitization.
-   Password hashing.

Use framework/provider-supported mechanisms when they are sufficient.

------------------------------------------------------------------------

## 7. Testing

Preferred categories:

-   Unit testing.
-   API integration testing.
-   Browser E2E testing.

Use the repository's existing test stack if one already exists.

------------------------------------------------------------------------

## 8. Package Change Protocol

Before adding a package:

``` text
Search package registry
→ Verify package
→ Check version
→ Check maintenance
→ Check compatibility
→ Install
→ Lock version
→ Run tests
```

------------------------------------------------------------------------

## 9. Documentation Rule

When an important dependency is introduced, document:

-   Why it exists.
-   Where it is used.
-   Security considerations.
-   Upgrade considerations.
