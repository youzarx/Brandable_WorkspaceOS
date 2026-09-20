# ADR 004 — Organization-Based Multi-Tenancy via Membership

**Date:** 2026-09-19
**Status:** Accepted

---

## Context

The platform must serve multiple independent customers (tenants) from a single database and deployment. Tenant data must be completely isolated — one tenant must never be able to read, modify, or even detect the existence of another tenant's data.

The key design questions were:

1. What is the unit of tenancy?
2. How are users associated with tenants?
3. How is tenant isolation enforced?
4. How do we handle users belonging to multiple organizations?

---

## Decision

The **Organization** is the tenant unit.

Users are associated with organizations through a **Membership** join entity, not by a direct `organizationId` on the `User` model.

```
User
  ↓ (one-to-many via Membership)
Membership  ← the tenant context object
  ↓
Organization  ← the tenant unit
  ↓ (owns all resources)
Project, Invoice, Task, Client, etc.
```

Every future tenant-owned resource **must** have `organizationId NOT NULL`.

---

## Reasoning

**Why Organization as the tenant unit (not User or Team)?**

- Organizations map directly to real business entities (companies, teams, accounts).
- Multiple users can collaborate within one organization.
- Organizations are the natural billing unit for B2B SaaS.
- Organization settings (branding, modules, roles) apply to all members.

**Why a separate Membership entity (not `organizationId` on User)?**

- A user can legitimately belong to multiple organizations (e.g., a consultant working for multiple clients).
- Storing `organizationId` directly on `User` would force a one-org-per-user constraint.
- `Membership` explicitly models the relationship: user X has role Y in organization Z.
- The `Membership` record is the tenant context object — it carries `organizationId` and `roleId`, which drive all authorization decisions.

**Why derive organizationId from Membership (not from JWT or request)?**

- The client cannot be trusted to provide its own `organizationId`.
- Any client-supplied `organizationId` would allow a user to impersonate membership in any organization.
- Deriving `organizationId` from the server-side `Membership` lookup after JWT verification is the only secure approach.

---

## Tenant Isolation Enforcement

The `MembershipGuard` NestJS guard implements isolation:

1. Reads `orgSlug` from the route parameter (URL-safe, non-sensitive).
2. Queries the database: `SELECT * FROM Membership JOIN Organization WHERE Organization.slug = :slug AND Membership.userId = :userId AND Membership.status = ACTIVE`.
3. If found: populates `req.membership` with the `ActiveMembership` object `{ userId, membershipId, organizationId, organizationSlug, roleId }`.
4. If not found: returns `403 Forbidden`.

All downstream services use `membership.organizationId` — never `req.body.organizationId` or any other client-supplied value.

All queries for tenant resources include: `WHERE organizationId = membership.organizationId AND id = resourceId`.

---

## Alternatives Considered

| Option                              | Rejected Reason                                                                                                                                 |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Schema-per-tenant                   | Massive operational complexity; Prisma migrations must run per schema; database connections multiplied                                          |
| Database-per-tenant                 | Prohibitively expensive at scale; complex connection management                                                                                 |
| Row-level security (PostgreSQL RLS) | Powerful but complex to audit; all Prisma queries must correctly set the RLS policy context; adds invisible security layer that is hard to test |
| `organizationId` on User            | Prevents users from belonging to multiple organizations; not suitable for agencies or consultants                                               |
| JWT-based `organizationId`          | Creates a stale authorization window; requires token refresh on org switch; cannot be immediately revoked                                       |

---

## Consequences

- Every future entity that belongs to a tenant **must** include `organizationId NOT NULL` (enforced by code review and AGENTS.md).
- Every controller that handles tenant data **must** be protected by `MembershipGuard` (enforced by the guard chain pattern).
- The `organizationId` rule must be reinforced in AGENTS.md as a non-negotiable requirement for future modules.
- Org-switching on the frontend is a URL change (the slug is in the route), not a token change.
- A user's access to an organization is immediately revocable by removing their Membership record.
