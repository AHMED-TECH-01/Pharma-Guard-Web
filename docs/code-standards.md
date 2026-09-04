# PharmaGuard --- Code Standards

## 1. General Rule

Write production-quality TypeScript.

Do not create quick hacks merely to make a screen render.

Every implementation must be:

-   Typed.
-   Validated.
-   Modular.
-   Testable.
-   Secure.
-   Responsive.
-   Consistent with existing architecture.

------------------------------------------------------------------------

## 2. Frontend/Backend Boundary

### Frontend may

-   Render UI.
-   Call approved APIs.
-   Manage form state.
-   Display errors.
-   Display loading states.

### Frontend must never

-   Contain Supabase secret key.
-   Contain Gemini private key.
-   Connect to the database using private credentials.
-   Decide authorization.
-   Calculate authoritative inventory mutations.
-   Trust client-provided pharmacy IDs.
-   Bypass backend validation.

### Backend must

-   Validate all input.
-   Authenticate requests.
-   Authorize actions.
-   Resolve tenant.
-   Apply business rules.
-   Perform secure database operations.
-   Write audit events.

------------------------------------------------------------------------

## 3. Naming

Use:

-   `PascalCase` for React components/classes.
-   `camelCase` for variables/functions.
-   `SCREAMING_SNAKE_CASE` for enum constants where appropriate.
-   Descriptive names.

Avoid:

``` text
data
temp
x
foo
bar
stuff
```

unless scope makes meaning obvious.

------------------------------------------------------------------------

## 4. TypeScript

Avoid `any`.

Prefer:

``` ts
unknown
```

followed by validation/narrowing.

Define shared domain types.

Do not duplicate interfaces in multiple files.

------------------------------------------------------------------------

## 5. API Contracts

Use consistent response envelopes.

Success:

``` json
{
  "success": true,
  "data": {}
}
```

Failure:

``` json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid expiry date"
  }
}
```

Never return raw database/provider errors.

------------------------------------------------------------------------

## 6. Validation

Validate at both:

-   Client.
-   Server.

Server validation is authoritative.

Validate:

-   Types.
-   Length.
-   Formats.
-   Ranges.
-   Enum values.
-   Relationships.
-   Tenant ownership.

Sanitize where output contexts require it.

Use parameterized queries/ORM methods.

------------------------------------------------------------------------

## 7. SQL Injection

Never concatenate user input into SQL.

Bad:

``` ts
`SELECT * FROM medicines WHERE name = '${name}'`
```

Good:

-   Parameterized queries.
-   Supabase query builders.
-   Validated filter values.

------------------------------------------------------------------------

## 8. XSS

-   Never inject unsanitized HTML.
-   Avoid `dangerouslySetInnerHTML`.
-   If rich text is genuinely required, sanitize with a verified
    maintained package.
-   Escape user-generated values in generated documents where required.

------------------------------------------------------------------------

## 9. Rate Limiting

Apply rate limiting at the backend.

Suggested initial policy:

### Authentication

-   Login: 5 attempts / 15 minutes / IP + account key.
-   Password reset: 3 requests / hour / IP + email.
-   Signup: 5 requests / hour / IP.

### AI OCR

-   20 requests / hour / user for normal plan.
-   Enforce plan-specific usage server-side.

### General APIs

-   120 requests / minute / authenticated user.
-   Lower limits for expensive endpoints.

### Public APIs

-   60 requests / minute / IP.

Use a distributed limiter in production if multiple backend instances
are deployed.

Do not claim rate limiting prevents all DDoS attacks; use an upstream
WAF/CDN for volumetric attacks.

------------------------------------------------------------------------

## 10. CORS

Allow only known frontend origins.

Example:

``` text
https://app.pharmaguard.example
https://www.pharmaguard.example
http://localhost:3000
```

Do not use:

``` text
Access-Control-Allow-Origin: *
```

for authenticated production APIs.

Never dynamically reflect arbitrary `Origin` values.

------------------------------------------------------------------------

## 11. Authentication

-   Hash passwords through the selected auth provider.
-   Use secure sessions.
-   Never log tokens.
-   Never put secrets in URL parameters.
-   Enforce session expiration policy.
-   Protect sensitive routes.

------------------------------------------------------------------------

## 12. Authorization

Use capability checks.

Examples:

``` text
inventory.read
inventory.write
sales.create
sales.reverse
purchases.write
reports.read
users.manage
settings.manage
```

Authorization is enforced server-side.

------------------------------------------------------------------------

## 13. Error Handling

Do not expose internal details.

Use stable error codes:

``` text
VALIDATION_ERROR
UNAUTHORIZED
FORBIDDEN
NOT_FOUND
CONFLICT
RATE_LIMITED
OCR_FAILED
EXTERNAL_SERVICE_ERROR
INTERNAL_ERROR
```

------------------------------------------------------------------------

## 14. Logging

Log:

-   Request ID.
-   Route.
-   Duration.
-   Status.
-   Error code.
-   User ID when safe.
-   Pharmacy ID when safe.

Never log:

-   Passwords.
-   API keys.
-   Tokens.
-   Database passwords.
-   Full private images.

------------------------------------------------------------------------

## 15. Database Mutations

Inventory mutations must be atomic.

Never:

``` text
update quantity
then create sale
```

without transactional protection.

Preferred:

``` text
transaction:
  lock relevant batch
  validate quantity
  update stock
  insert transaction
  insert audit event
commit
```

------------------------------------------------------------------------

## 16. React Rules

-   Use reusable components.
-   Keep pages thin.
-   Move business logic into hooks/services.
-   Avoid giant components.
-   Avoid duplicated markup.
-   Handle loading/error/empty states.
-   Use stable keys.
-   Avoid unnecessary effects.

------------------------------------------------------------------------

## 17. CSS Rules

-   Use shared design tokens.
-   Do not scatter arbitrary hex values.
-   Do not introduce a new spacing scale without approval.
-   Keep responsive behavior in the design system.
-   Match the supplied UI before adding stylistic enhancements.

------------------------------------------------------------------------

## 18. Package Policy

Before adding a package:

1.  Verify package exists.
2.  Verify current maintenance/activity.
3.  Verify license suitability.
4.  Verify compatibility.
5.  Check whether existing dependencies already solve the problem.
6.  Pin/lock dependency versions through the package manager.

Never invent package names.

------------------------------------------------------------------------

## 19. Bug-Fix Protocol

Before fixing a bug:

``` text
Inspect
→ Map dependencies
→ Identify affected features
→ Define regression checklist
→ Patch minimally
→ Typecheck
→ Test
→ Verify dependent UI
```

Never delete unrelated functionality to solve a local problem.

------------------------------------------------------------------------

## 20. Pull Request / Commit Style

Prefer small commits:

``` text
feat(auth): add signup flow
feat(inventory): add batch management
fix(expiry): correct day calculation
security(api): add rate limiting
ui(dashboard): add KPI skeletons
```

------------------------------------------------------------------------

## 21. Definition of Done

A feature is not complete until:

-   It works.
-   It is typed.
-   It is validated.
-   It is authorized.
-   It has loading state.
-   It has error state.
-   It has empty state where appropriate.
-   It is responsive.
-   Critical mutations are audited.
-   Tests pass.
-   No unrelated feature regressed.
