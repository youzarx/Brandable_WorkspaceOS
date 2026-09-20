# ADR 005 — Role-Based Access Control (RBAC): Roles + Permissions

**Date:** 2026-09-19
**Status:** Accepted

---

## Context

The platform needs an authorization model that can:

- Distinguish between different levels of access within an organization (owner, admin, regular member).
- Allow organizations to create custom roles with specific permission subsets.
- Support system-wide default roles shared across all organizations.
- Be enforceable server-side on every request.
- Be auditable (who has what permission, and when did it change).
- Scale to hundreds of permission keys without becoming unmanageable.

---

## Decision

Implement **Role-Based Access Control (RBAC)** with the following entities:

```
User
  ↓ (via Membership)
Role
  ↓ (via RolePermission)
Permission (key: 'resource.action')
```

**Role types:**

- **System roles** (`organizationId = NULL, isSystem = true`): `OWNER`, `ADMIN`, `MEMBER` — created at seed time, shared across all organizations.
- **Org-specific roles** (`organizationId = <id>, isSystem = false`): created per organization by ADMIN/OWNER users.

**Permission format:** `<resource>.<action>` — e.g., `organizations.read`, `users.invite`, `modules.configure`.

---

## Reasoning

**Why RBAC over ABAC (Attribute-Based Access Control)?**

- RBAC is simpler to understand, implement, and audit.
- For SaaS team management, roles (owner, admin, member) map naturally to how organizations think about access.
- ABAC is more powerful but significantly more complex; it can be layered on top of RBAC later if specific use cases require it.

**Why separate Permission entities (not hardcoded permission checks)?**

- Permission keys are strings; adding new permissions requires no code changes to the authorization infrastructure.
- Permissions can be assigned and revoked from roles at runtime (admin UI in future).
- The permission key format (`resource.action`) is self-documenting and consistent across the platform.
- Permissions are queryable (which users have `audit.read`?).

**Why support both system roles and org-specific roles?**

- System roles (`OWNER`, `ADMIN`, `MEMBER`) provide sensible defaults for every organization without requiring setup.
- Org-specific roles allow advanced organizations to create fine-grained access controls (e.g., "Finance Manager", "Project Viewer").
- The nullable `organizationId` on `Role` cleanly distinguishes the two types.

**Why is authorization caching disabled on Day 1?**

- Correctness over performance: if an admin removes a permission, the next request must be denied immediately.
- At Day 1 scale, the indexed DB reads are sub-millisecond.
- Caching authorization may be introduced in a future ADR with explicit security review.

---

## Alternatives Considered

| Option                              | Rejected Reason                                                                             |
| ----------------------------------- | ------------------------------------------------------------------------------------------- |
| ABAC                                | Overly complex for current needs; RBAC is sufficient and more auditable                     |
| Simple `isAdmin` flag on Membership | Cannot support multiple access levels or custom roles                                       |
| Hardcoded permission checks in code | Permissions are not auditable or configurable; adding new permissions requires code changes |
| JWT role claims                     | Stale authorization window; role changes require token refresh; not immediately enforceable |
| Permission-per-user (ACL)           | Extremely verbose at scale; RBAC via roles is cleaner                                       |

---

## Role Uniqueness

Role names are unique within their scope, enforced at the database level via PostgreSQL partial unique indexes:

```sql
-- System roles: globally unique
CREATE UNIQUE INDEX role_name_system_unique
  ON "Role" (name) WHERE "organizationId" IS NULL;

-- Org roles: unique within the organization
CREATE UNIQUE INDEX role_name_org_unique
  ON "Role" (name, "organizationId") WHERE "organizationId" IS NOT NULL;
```

Prisma's `@@unique` does not support partial indexes; these are applied via raw SQL in the migration.

---

## Seed Permissions

```
organizations.read      organizations.update      organizations.delete
users.read              users.invite              users.remove
roles.read              roles.manage
permissions.read
memberships.read        memberships.manage
settings.read           settings.update
modules.read            modules.configure
audit.read
```

## Default Role Permission Assignments

| Permission        | OWNER | ADMIN          | MEMBER    |
| ----------------- | ----- | -------------- | --------- |
| `organizations.*` | ✅    | ✅ (no delete) | ❌        |
| `users.*`         | ✅    | ✅             | read only |
| `roles.*`         | ✅    | ✅             | read only |
| `memberships.*`   | ✅    | ✅             | read only |
| `settings.*`      | ✅    | ✅             | ❌        |
| `modules.*`       | ✅    | ✅             | read only |
| `audit.read`      | ✅    | ✅             | ❌        |

---

## Consequences

- Every org-scoped endpoint that requires authorization must use `@RequirePermissions()` decorator + `PermissionsGuard`.
- Adding a new permission requires: inserting a `Permission` row, assigning it to the appropriate roles via `RolePermission`, and using `@RequirePermissions('new.permission')` in the controller.
- Authorization is always 2 DB reads per request: (1) Membership lookup, (2) RolePermission lookup. Both are indexed and fast.
- Future: introduce a permission caching layer (with Redis + short TTL) once profiling shows it's necessary.
