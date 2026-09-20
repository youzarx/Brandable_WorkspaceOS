# Architecture — Platform

## Overview

This platform is a multi-tenant SaaS foundation built as a **modular monolith** inside a **monorepo**. The architecture is designed to support significant growth without requiring a full rewrite. Every decision prioritizes correctness, security, and maintainability over premature optimization.

---

## Monorepo Structure

```
platform/
├── apps/
│   ├── web/        # Next.js 15 frontend (App Router)
│   ├── api/        # NestJS backend (modular monolith)
│   └── worker/     # NestJS standalone (background jobs)
│
├── packages/
│   ├── database/   # Prisma schema, client, migrations, seed
│   ├── types/      # Shared TypeScript interfaces
│   ├── validation/ # Shared Zod schemas (used by api + web)
│   ├── config/     # Shared constants (permission keys, env var names)
│   └── ui/         # Shared React component library (shadcn/ui wrapper)
│
├── docs/adr/       # Architecture Decision Records
├── infrastructure/ # Reserved: Terraform/K8s (future)
└── .github/        # GitHub Actions CI
```

**Why a monorepo?** See [ADR 001](adr/001-monorepo.md). Short answer: shared code between apps, atomic cross-app changes, and consistent tooling without the overhead of package publishing.

**Build system:** Turborepo handles task dependency resolution and caching (`build → typecheck → test`). pnpm workspaces handle dependency installation and linking.

---

## Frontend — `apps/web`

**Stack:** Next.js 15, TypeScript strict, Tailwind CSS, shadcn/ui.

**Routing pattern:** App Router with route groups:

```
app/
├── (auth)/           # Unauthenticated routes (login, register)
│   ├── login/
│   └── register/
└── (platform)/       # Authenticated routes (requires active membership)
    └── [orgSlug]/    # Tenant-scoped — slug validated server-side
        └── dashboard/
```

**Auth on the frontend:**

- Short-lived access token (15 min) held in memory only — never in `localStorage`.
- Long-lived refresh token in an `httpOnly` cookie (scope: `/api/v1/auth`).
- `middleware.ts` intercepts all protected routes and redirects unauthenticated users.
- The frontend **never** accesses PostgreSQL or Redis directly.

**Client-side refresh serialization:**
The frontend must ensure only one refresh request is in-flight at a time. Use a singleton Promise that all callers await during token rotation. Concurrent refresh calls with the same token will trigger `SESSION_COMPROMISED` under the conservative revocation model.

---

## Backend — `apps/api`

**Stack:** NestJS, TypeScript strict, REST.

**Architecture pattern:** Modular Monolith — see [ADR 002](adr/002-modular-monolith.md).

```
apps/api/src/
├── main.ts                  # Bootstrap: global pipes, filters, versioning
├── app.module.ts            # Root module: imports all feature modules
├── config/                  # ConfigModule with environment validation
├── common/
│   ├── decorators/          # @CurrentUser, @CurrentMembership, @RequirePermissions, @RequireModule
│   ├── guards/              # JwtAuthGuard, MembershipGuard, PermissionsGuard, ModuleGuard
│   ├── interceptors/        # LoggingInterceptor (correlation ID), TransformInterceptor (response envelope)
│   ├── filters/             # GlobalExceptionFilter (sanitized errors)
│   ├── pipes/               # ValidationPipe configuration
│   └── services/            # TenantService (shared tenant-scoped query helpers)
└── modules/
    ├── health/              # GET /api/v1/health
    ├── auth/                # POST login, refresh, logout; password change
    ├── users/               # GET /me; update profile
    ├── organizations/       # CRUD scaffold (org-scoped)
    ├── memberships/         # List, invite, remove, reactivate
    ├── roles/               # List, create (org-specific roles)
    └── feature-modules/     # List enabled modules for an org
```

**API versioning:** All routes are prefixed `/api/v1/`. Future breaking changes use `/api/v2/`.

**Request lifecycle:**

```
Request
  → Correlation ID middleware (adds/echoes X-Request-Id)
  → JwtAuthGuard (validates access token)
  → MembershipGuard (validates org membership from DB)
  → ModuleGuard (checks OrganizationModule.isEnabled via JOIN)
  → PermissionsGuard (checks RolePermission from DB)
  → Controller
  → Service (tenant-scoped DB queries)
  → TransformInterceptor (response envelope)
  → Response
```

---

## Worker — `apps/worker`

NestJS standalone application for background jobs. Uses BullMQ (Redis) for job queuing.

**Status:** Shell only in Day 1. No actual jobs implemented. Architecture prepared for:

- Email notifications
- Audit log processing
- Expensive async operations
- Future Outbox Pattern event processing (see [ADR 010](adr/010-outbox-pattern.md))

---

## Database Architecture

**Database:** PostgreSQL 16 via Prisma ORM — see [ADR 003](adr/003-postgresql.md).

The database package (`@platform/database`) is imported by both `apps/api` and `apps/worker`. It exports a singleton `PrismaClient` instance.

See [`database.md`](database.md) for the full entity reference and relationship diagram.

---

## Multi-Tenancy

**Model:** Organization-based. See [ADR 004](adr/004-multi-tenancy.md).

```
User
  ↓ (Membership — join entity)
Organization (the tenant unit)
  ↓ (owns all resources)
Project, Invoice, Task, Client, ... (future)
```

**Key rules:**

1. `organizationId` in any query comes from `Membership.organizationId` (DB) — never from client input.
2. Every tenant-owned entity has `organizationId NOT NULL`.
3. Every query for tenant data includes `WHERE organizationId = membership.organizationId`.
4. Cross-tenant access returns `404` (not `403`) to avoid disclosing existence of other tenants' resources.

The `MembershipGuard` populates `req.membership` (an `ActiveMembership` object) for all org-scoped endpoints. All controllers and services consume this object via the `@CurrentMembership()` decorator.

---

## Authentication

**Strategy:** Self-hosted JWT. See [ADR 007](adr/007-authentication.md).

- Access token: JWT, 15-minute TTL, signed with `JWT_ACCESS_SECRET`.
- Refresh token: cryptographically random 64-byte value; only its SHA-256 hash is stored in PostgreSQL.
- Refresh tokens belong to a `familyId` for theft detection.
- Token rotation: conservative family-revocation model (revoke-on-any-reuse if active successor exists).
- httpOnly Secure cookie carries the raw refresh token (path: `/api/v1/auth`).

The JWT payload is minimal: `{ sub: userId, email, iat, exp }`. No `organizationId` or role claims.

---

## Authorization — RBAC

**Model:** Roles + Permissions. See [ADR 005](adr/005-rbac.md).

```
Membership → roleId → Role → RolePermission → Permission.key
```

**Role types:**

- System roles (`organizationId = NULL`): `OWNER`, `ADMIN`, `MEMBER` — created at seed time.
- Org-specific roles (`organizationId = <id>`): custom roles created by ADMIN/OWNER per organization.

**Guard chain (5 layers):**

1. `JwtAuthGuard` — verify JWT, populate `req.user`
2. `MembershipGuard` — verify active membership, populate `req.membership`
3. `ModuleGuard` — verify OrganizationModule enabled (JOIN through Module.key)
4. `PermissionsGuard` — verify permission in RolePermission
5. Service-layer resource scope — `WHERE id = X AND organizationId = membership.organizationId`

**Authorization is always server-side.** Frontend permission checks are UX only.

**Authorization decisions are never cached in Redis** (Day 1). Every request reads live from PostgreSQL. This ensures immediate effect of permission/membership revocation.

---

## Module / Feature System

**Model:** Dynamic string keys, no TypeScript enum. See [ADR 006](adr/006-modular-feature-system.md).

```
Module (system registry — rows in DB)
  ↓
OrganizationModule (per-tenant configuration)
  isEnabled: boolean
  config: JSON  ← future module-specific settings
```

Enabling a new module requires only a new row in the `Module` table. No code changes to the platform core.

**Future subscription layer** sits above this:

```
Subscription → Entitlements → OrganizationModule.isEnabled → Permissions → Business logic
```

---

## White-Label Strategy

Organization branding is entirely data-driven. The `Organization` model stores:

- `name`, `slug` — identity
- `logo`, `favicon` — asset URLs
- `primaryColor`, `secondaryColor` — theme colors
- `brandingConfig` — extensible JSON for future theme/navigation/custom domain config

**Zero hardcoded tenant values** in any shared platform component. All UI components accept branding via props or a branding context provider populated from the API.

Future additions (custom domains, theme injection, custom navigation) extend `brandingConfig` — no schema migrations required for initial iterations.

---

## Data Consistency and Caching

- **PostgreSQL is the source of truth.** Always.
- **Redis is cache-only.** Never an authoritative data store for business data.
- Authorization decisions: PostgreSQL direct reads only (no Redis cache).
- Cache invalidation pattern: DB commit first, then cache invalidation.
- Redis failure: auth unaffected; branding cache falls through to DB; rate limiting degrades gracefully for non-sensitive endpoints; security-sensitive endpoints use in-process fallback.

---

## Observability

Every request receives a `X-Request-Id` (UUID v4) header — generated by middleware if absent. This ID propagates through logs, error responses, and (future) distributed tracing.

Structured JSON logging from day 1. Extension points for Sentry, OpenTelemetry, and Prometheus are prepared in the NestJS application structure.

---

## Future Scalability

The architecture is designed to scale without a rewrite:

| Concern        | Day 1                | Future                                                    |
| -------------- | -------------------- | --------------------------------------------------------- |
| Backend        | Modular monolith     | Extract hot modules to dedicated services if needed       |
| DB connections | Direct Prisma        | PgBouncer connection pooler                               |
| Caching        | Redis (minimal)      | Expand cache scope with explicit security review          |
| Events         | None                 | Outbox Pattern → BullMQ → WebSocket/webhook               |
| Realtime       | Not implemented      | WebSocket gateway as NestJS module                        |
| Multi-instance | Single instance      | Horizontal scaling; Redis required for auth rate limiting |
| Custom domains | Data foundation only | Domain verification + routing layer                       |
