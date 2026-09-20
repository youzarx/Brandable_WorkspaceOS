# AGENTS.md — Coding Agent Instructions

This file contains **mandatory rules** for any AI coding agent, developer, or automated tool working in this repository.

Read this file before making any changes. Violating these rules risks introducing security vulnerabilities, architectural drift, or data consistency bugs.

---

## Before You Start Any Task

1. **Read `PRODUCT.md`** — understand what this platform is and who it serves.
2. **Read `docs/architecture.md`** — understand the system structure before making structural changes.
3. **Read the relevant ADR(s)** in `docs/adr/` — understand _why_ decisions were made before changing them.
4. **Read `docs/security.md`** — understand the security model before touching auth, membership, or tenant data.
5. **Read `docs/database.md`** — understand the data model and ownership rules before adding or modifying schema.

---

## Multi-Tenancy Rules — Non-Negotiable

### The Golden Rule

> `organizationId` used in any database query MUST come from the authenticated user's verified `Membership` record — never from client input.

### What You Must Never Do

```typescript
// ❌ NEVER — organizationId from request body
async listProjects(@Body() body: { organizationId: string }) {
  return this.db.project.findMany({ where: { organizationId: body.organizationId } });
}

// ❌ NEVER — organizationId from query params
async listProjects(@Query('orgId') orgId: string) { ... }

// ❌ NEVER — organizationId from JWT claims
const orgId = jwtPayload.organizationId; // JWT contains userId only

// ❌ NEVER — querying tenant resources without organizationId scope
const project = await this.db.project.findFirst({ where: { id: projectId } });
```

### What You Must Always Do

```typescript
// ✅ CORRECT — organizationId from verified membership (populated by MembershipGuard)
@Get()
@UseGuards(JwtAuthGuard, MembershipGuard)
@RequirePermissions('projects.read')
async list(@CurrentMembership() membership: ActiveMembership) {
  return this.projectsService.findAll(membership.organizationId);
}

// ✅ CORRECT — always scope tenant queries with organizationId
const project = await this.db.project.findFirst({
  where: {
    id: projectId,
    organizationId: membership.organizationId, // ← from DB, never from client
  },
});
// Returns null → throw NotFoundException (do NOT reveal existence to other tenants)
```

### Tenant Data Ownership Checklist (Per Endpoint)

Every protected endpoint must satisfy ALL of the following:

```
□ Authentication   → JWT valid, user exists and is not soft-deleted
□ Membership       → Active Membership in DB for this user + org (live DB read, no cache)
□ Organization scope → organizationId from Membership.organizationId only
□ Module enabled   → OrganizationModule JOIN Module.key (if @RequireModule used)
□ Permission       → RolePermission JOIN Permission.key (if @RequirePermissions used)
□ Resource scope   → WHERE id = X AND organizationId = membership.organizationId
```

---

## Authorization Rules

- **Authorization is always server-side.** Frontend permission checks are UX convenience only — never a security boundary.
- **Never cache authorization decisions in Redis** (Day 1 rule). Membership, role, and permission checks always read from PostgreSQL.
- If an admin removes a permission at T=0, the user's next request at T=1 must be denied. No stale window.
- The 5-layer guard chain is: `JwtAuthGuard → MembershipGuard → ModuleGuard → PermissionsGuard → Resource scope in service`.
- **Never skip guards** on org-scoped endpoints to make development easier.

---

## Authentication Rules

- JWT payload contains only: `{ sub: userId, email, iat, exp }`. Nothing else.
- Refresh tokens are stored as **SHA-256 hashes** only. The raw token is never stored.
- Each refresh token belongs to a `familyId`. **Token family revocation** is used for theft detection.
- **The frontend MUST serialize refresh calls.** Only one refresh request may be in-flight at a time. Do not send concurrent refresh calls — this will trigger `SESSION_COMPROMISED` under the conservative revocation model.
- A reused revoked token where the family still has active tokens → `SESSION_COMPROMISED` → entire family revoked.
- A reused revoked token where the family is fully revoked → `INVALID_TOKEN` → redirect to login.

---

## What Must Never Be Returned to the Frontend

```typescript
// ❌ Never expose these fields in any API response
user.passwordHash;
refreshToken.tokenHash;
process.env.JWT_ACCESS_SECRET;
// Internal stack traces (use sanitized error messages in production)
// Database connection strings
// Internal IDs of security infrastructure
```

Use Prisma `select` or response DTOs with explicit field allowlisting to prevent accidental exposure.

---

## Module System Rules

- Module keys are **dynamic strings** — never add them to a TypeScript enum.
- Adding a new module requires only: inserting a row into the `Module` table + seeding `OrganizationModule` records.
- The `ModuleGuard` resolves module status via: `OrganizationModule JOIN Module ON Module.key = requiredKey`. There is no `moduleKey` column on `OrganizationModule`.
- Never hardcode module enablement checks inside business logic — use `@RequireModule('key')` decorator + `ModuleGuard`.

---

## Database Rules

- Every future tenant-owned entity **must** have `organizationId NOT NULL`.
- Every tenant-owned table **must** have a compound index on `(organizationId, ...)` for all important query patterns.
- Never query tenant data without `organizationId` in the WHERE clause.
- Soft-deleted records retain their unique identities:
  - `User.email` — permanently reserved after soft-delete
  - `Organization.slug` — permanently reserved after soft-delete
  - `Membership(userId, organizationId)` — unique pair, restore the record rather than creating a new one
- `AuditLog` is append-only — no `updatedAt`, no soft-delete.
- Always use Prisma transactions for operations that must be atomic (see `docs/database.md` for the full list).
- Never run a transaction that includes external side effects (API calls, emails, queue jobs) — those happen after commit.

---

## Architecture Rules

- **Frontend never accesses PostgreSQL directly.** All data flows through the API.
- **Frontend never accesses Redis directly.**
- Do not introduce microservices. The backend is a modular monolith.
- Do not add infrastructure components without explicit approval and an ADR.
- Do not bypass the API layer to read data directly from the database in the frontend.
- All new backend modules go under `apps/api/src/modules/`.
- Follow the established guard/decorator/service pattern for all org-scoped endpoints.

---

## White-Label Rules

- **Zero hardcoded branding in reusable components.** No colors, logos, or company names.
- Organization branding is data-driven — read from `Organization.brandingConfig` and related fields.
- Platform UI components accept branding via props or a branding context provider.
- The platform internal name is `platform` — do not use a specific customer/company name anywhere in shared code.

---

## Code Quality Rules

- TypeScript strict mode is enforced. Never use `// @ts-ignore` or cast to `any`.
- All ESLint rules must pass before a task is considered complete.
- All Prettier formatting must pass.
- All existing tests must pass. New features require new tests.
- Run before considering any task done:
  ```bash
  pnpm lint
  pnpm typecheck
  pnpm test
  pnpm build
  ```

---

## Dependency Rules

- Do not add new dependencies without justification.
- Prefer packages that are already in the workspace over adding new ones.
- Do not add BaaS platforms (Supabase, Firebase, Clerk, Auth0, Appwrite, Convex).
- Do not add ORM alternatives — Prisma is the only database access layer.
- Shared utilities go in `packages/` — do not duplicate logic across apps.

---

## Documentation Rules

- If you make an architectural decision, document it in an ADR (`docs/adr/`).
- If you change the database schema, update `docs/database.md`.
- If you change the security architecture, update `docs/security.md`.
- If you change the system architecture, update `docs/architecture.md`.
- Do not silently change architecture without documentation.

---

## Scope Rules

- Do not implement features outside the explicitly requested scope.
- Do not add "nice-to-have" features without approval.
- If a change requires significant architectural decisions, stop and present the decision with alternatives before proceeding.

---

## Security Incident Protocol

If you discover a potential security vulnerability:

1. Do not silently fix it.
2. Document the issue and the fix clearly in the PR/commit description.
3. Update `docs/security.md` if the security model is affected.
4. If the fix changes architectural behavior, create or update an ADR.
