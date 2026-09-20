# Database — Platform

## Principles

- **PostgreSQL is the source of truth.** Always.
- Every tenant-owned entity has `organizationId NOT NULL`.
- Soft-deletion is used selectively — only where identity preservation matters.
- Unique constraints survive soft-deletion (emails, slugs, and memberships remain reserved).
- Critical operations are wrapped in Prisma transactions.
- `AuditLog` is append-only — no `updatedAt`, no soft-delete, no updates.

---

## Entity Reference

### `User`

Represents a human identity in the platform. A user is not tied to any single organization.

| Column            | Type          | Notes                                                    |
| ----------------- | ------------- | -------------------------------------------------------- |
| `id`              | String (cuid) | PK                                                       |
| `email`           | String        | UNIQUE NOT NULL. Reserved permanently after soft-delete. |
| `passwordHash`    | String        | bcrypt hash (cost ≥ 12). Never returned to client.       |
| `firstName`       | String        | NOT NULL                                                 |
| `lastName`        | String        | NOT NULL                                                 |
| `emailVerifiedAt` | DateTime?     | Null until email verified                                |
| `lastLoginAt`     | DateTime?     | Updated on successful login                              |
| `createdAt`       | DateTime      | DEFAULT now()                                            |
| `updatedAt`       | DateTime      | @updatedAt                                               |
| `deletedAt`       | DateTime?     | Soft delete. Email remains reserved.                     |

**Soft-delete policy:** A soft-deleted user's email is permanently reserved. Reactivate the existing record — never create a second user with the same email.

**Indexes:**

- `UNIQUE (email)`
- `INDEX (deletedAt)`

---

### `Organization`

The tenant unit. Every resource on the platform belongs to an Organization.

| Column           | Type          | Notes                                                                                |
| ---------------- | ------------- | ------------------------------------------------------------------------------------ |
| `id`             | String (cuid) | PK                                                                                   |
| `name`           | String        | NOT NULL                                                                             |
| `slug`           | String        | UNIQUE NOT NULL. URL-safe tenant identifier. Reserved permanently after soft-delete. |
| `logo`           | String?       | URL to tenant logo asset                                                             |
| `favicon`        | String?       | URL to tenant favicon asset                                                          |
| `primaryColor`   | String?       | Hex color string, e.g. `#6366f1`                                                     |
| `secondaryColor` | String?       | Hex color string                                                                     |
| `brandingConfig` | Json?         | Extensible JSON: theme, navigation, custom domain slot                               |
| `createdAt`      | DateTime      | DEFAULT now()                                                                        |
| `updatedAt`      | DateTime      | @updatedAt                                                                           |
| `deletedAt`      | DateTime?     | Soft delete. Slug remains reserved.                                                  |

**Note:** `plan` and `planExpiresAt` are intentionally absent. Billing/subscription is introduced via a separate `Subscription` model in a future phase. This avoids entangling the core tenant model with billing concerns.

**Soft-delete policy:** A soft-deleted organization's slug is permanently reserved. Reactivate the record — never create a new organization with the same slug.

**Indexes:**

- `UNIQUE (slug)`
- `INDEX (deletedAt)`

---

### `Membership`

Join entity representing a user's membership in an organization with a specific role. This is the tenant context object.

| Column           | Type          | Notes                                 |
| ---------------- | ------------- | ------------------------------------- |
| `id`             | String (cuid) | PK                                    |
| `userId`         | String        | FK → User.id NOT NULL                 |
| `organizationId` | String        | FK → Organization.id NOT NULL         |
| `roleId`         | String        | FK → Role.id NOT NULL                 |
| `status`         | Enum          | PENDING \| ACTIVE \| SUSPENDED        |
| `invitedAt`      | DateTime?     | When the invite was sent              |
| `joinedAt`       | DateTime?     | When the user accepted                |
| `createdAt`      | DateTime      | DEFAULT now()                         |
| `updatedAt`      | DateTime      | @updatedAt                            |
| `deletedAt`      | DateTime?     | Soft delete (used for member removal) |

**Soft-delete policy:** Only one Membership record may ever exist per (userId, organizationId) pair. When a member is removed, set `deletedAt` and `status = SUSPENDED`. When re-inviting a removed member, restore the existing record (`deletedAt = NULL, status = PENDING`) — never create a new row.

**Indexes:**

- `UNIQUE (userId, organizationId)` — enforces single-record policy
- `INDEX (organizationId, status)` — list members of an org
- `INDEX (userId, status)` — list orgs a user belongs to
- `INDEX (deletedAt)`

---

### `Role`

Defines a named set of permissions. Can be a system role (shared across all orgs) or an org-specific custom role.

| Column           | Type          | Notes                                     |
| ---------------- | ------------- | ----------------------------------------- |
| `id`             | String (cuid) | PK                                        |
| `name`           | String        | NOT NULL                                  |
| `organizationId` | String?       | FK → Organization.id. NULL = system role. |
| `isSystem`       | Boolean       | true for OWNER, ADMIN, MEMBER             |
| `description`    | String?       |                                           |
| `createdAt`      | DateTime      |                                           |
| `updatedAt`      | DateTime      | @updatedAt                                |

**Uniqueness (enforced at database level via partial indexes — raw SQL in migration):**

```sql
-- System roles: globally unique names
CREATE UNIQUE INDEX role_name_system_unique
  ON "Role" (name) WHERE "organizationId" IS NULL;

-- Org-specific roles: unique names within each organization
CREATE UNIQUE INDEX role_name_org_unique
  ON "Role" (name, "organizationId") WHERE "organizationId" IS NOT NULL;
```

Prisma's `@@unique` does not support partial indexes; these are applied via raw SQL in the migration.

**Indexes:**

- Partial UNIQUE on `name WHERE organizationId IS NULL`
- Partial UNIQUE on `(name, organizationId) WHERE organizationId IS NOT NULL`
- `INDEX (organizationId)` — list org's custom roles

---

### `Permission`

A named capability key. Permissions are global (not per-org) and assigned to roles via `RolePermission`.

| Column        | Type          | Notes                                      |
| ------------- | ------------- | ------------------------------------------ |
| `id`          | String (cuid) | PK                                         |
| `key`         | String        | UNIQUE NOT NULL. Format: `resource.action` |
| `description` | String?       |                                            |
| `createdAt`   | DateTime      |                                            |

**Permission key naming convention:** `<resource>.<action>`

Seed permissions:

```
organizations.read        organizations.update       organizations.delete
users.read                users.update               users.invite               users.remove
roles.read                roles.manage
permissions.read
memberships.read          memberships.manage
settings.read             settings.update
modules.read              modules.configure
audit.read
```

**Indexes:**

- `UNIQUE (key)`

---

### `RolePermission`

Join table assigning permissions to roles.

| Column         | Type   | Notes              |
| -------------- | ------ | ------------------ |
| `roleId`       | String | FK → Role.id       |
| `permissionId` | String | FK → Permission.id |

**Primary Key:** `(roleId, permissionId)` — composite, prevents duplicates.

---

### `Module`

System registry of all available platform modules. Keys are dynamic strings — no TypeScript enum.

| Column        | Type          | Notes                                            |
| ------------- | ------------- | ------------------------------------------------ |
| `id`          | String (cuid) | PK                                               |
| `key`         | String        | UNIQUE NOT NULL. e.g. `'projects'`, `'invoices'` |
| `name`        | String        | Display name                                     |
| `description` | String?       |                                                  |
| `createdAt`   | DateTime      |                                                  |

Seed modules: `projects`, `tasks`, `invoices`, `crm`, `calendar`, `chat`, `content`, `analytics`

**Indexes:**

- `UNIQUE (key)`

---

### `OrganizationModule`

Per-tenant module configuration. Controls whether a module is enabled for an organization.

| Column           | Type          | Notes                                    |
| ---------------- | ------------- | ---------------------------------------- |
| `id`             | String (cuid) | PK                                       |
| `organizationId` | String        | FK → Organization.id NOT NULL            |
| `moduleId`       | String        | FK → Module.id NOT NULL                  |
| `isEnabled`      | Boolean       | DEFAULT false                            |
| `config`         | Json?         | Future: module-specific settings per org |
| `createdAt`      | DateTime      |                                          |
| `updatedAt`      | DateTime      | @updatedAt                               |

**Note:** There is no `moduleKey` column on `OrganizationModule`. The key is resolved via JOIN: `OrganizationModule JOIN Module ON Module.id = OrganizationModule.moduleId WHERE Module.key = 'projects'`.

**Indexes:**

- `UNIQUE (organizationId, moduleId)`
- `INDEX (organizationId, isEnabled)` — list enabled modules for an org

---

### `RefreshToken`

Stores hashed refresh tokens for session management.

| Column      | Type          | Notes                                                                     |
| ----------- | ------------- | ------------------------------------------------------------------------- |
| `id`        | String (cuid) | PK                                                                        |
| `userId`    | String        | FK → User.id NOT NULL                                                     |
| `tokenHash` | String        | UNIQUE. SHA-256 hash of the raw refresh token. Raw token is never stored. |
| `familyId`  | String        | NOT NULL. Groups tokens in a rotation chain. Used for theft detection.    |
| `expiresAt` | DateTime      | NOT NULL                                                                  |
| `revokedAt` | DateTime?     | NULL = active. Set when rotated, logged out, or on security event.        |
| `ipAddress` | String?       |                                                                           |
| `userAgent` | String?       |                                                                           |
| `createdAt` | DateTime      |                                                                           |

**Token theft detection:** If a revoked token is presented and the family has active tokens, all active tokens in the family are immediately revoked (`SESSION_COMPROMISED`). If the family has no active tokens, return `INVALID_TOKEN` (clean logout/expired).

**Indexes:**

- `UNIQUE (tokenHash)`
- `INDEX (userId, expiresAt)` — cleanup + user session queries
- `INDEX (familyId)` — family-wide revocation

---

### `AuditLog`

Immutable event log. Append-only — no updates, no soft-delete.

| Column           | Type          | Notes                                           |
| ---------------- | ------------- | ----------------------------------------------- |
| `id`             | String (cuid) | PK                                              |
| `organizationId` | String        | FK → Organization.id NOT NULL                   |
| `userId`         | String?       | FK → User.id. Null for system-generated events. |
| `action`         | String        | e.g. `'membership.created'`, `'module.toggled'` |
| `resource`       | String        | e.g. `'Membership'`, `'OrganizationModule'`     |
| `resourceId`     | String?       |                                                 |
| `metadata`       | Json?         | Additional event context                        |
| `ipAddress`      | String?       |                                                 |
| `createdAt`      | DateTime      | DEFAULT now() — NO updatedAt                    |

**Indexes:**

- `INDEX (organizationId, createdAt DESC)` — tenant audit queries
- `INDEX (userId, createdAt DESC)` — user activity queries

---

## Entity Relationship Summary

```
User ──────────────────────────────────────────────────────────────────────┐
│                                                                           │
│ (1:N via Membership)                                                      │
▼                                                                           │
Membership ──────────────────────► Organization ──────────────────────────┤
│  userId (FK → User)               │                                       │
│  organizationId (FK → Org)        │ (1:N)                                 │
│  roleId (FK → Role)               ▼                                       │
│                                  OrganizationModule                       │
▼                                   │  moduleId (FK → Module)              │
Role ──────────────────────────────┘  isEnabled                            │
│  organizationId (nullable)                                                │
│                                  Module                                   │
▼                                   key (unique string)                    │
RolePermission                                                              │
│  roleId (FK → Role)               RefreshToken ◄──────────────────────────┘
│  permissionId (FK → Permission)    tokenHash (hashed)
                                     familyId
▼
Permission                          AuditLog ◄─────────────────────────────┐
  key (unique string)                organizationId (FK → Org)             │
                                     userId (FK → User, nullable)          │
                                                                            │
                                   All tenant-owned future resources ───────┘
                                   (Project, Invoice, Task, etc.)
                                   MUST have: organizationId NOT NULL
```

---

## Mandatory Transaction Boundaries

| Operation               | Steps (all atomic)                                                                                   |
| ----------------------- | ---------------------------------------------------------------------------------------------------- |
| Create Organization     | Create Org → Assign OWNER role → Create Membership (OWNER) → Enable default modules → Write AuditLog |
| Invite Member           | Assert no active membership → Create Membership (PENDING) → Write AuditLog                           |
| Reactivate Member       | Find soft-deleted membership → Restore → Update status/role → Write AuditLog                         |
| Remove Member           | Soft-delete Membership → Write AuditLog                                                              |
| Assign Role             | Assert role belongs to org or is system role → Update Membership.roleId → Write AuditLog             |
| Update Role Permissions | Delete existing RolePermissions → Insert new → Write AuditLog                                        |
| Toggle Module           | Upsert OrganizationModule → Write AuditLog                                                           |
| Deactivate Organization | Soft-delete Org → Suspend all Memberships → Write AuditLog                                           |
| Refresh Token Rotation  | Conditional UPDATE (revoke old) → INSERT (new, same familyId)                                        |
| Password Change         | UPDATE passwordHash → Revoke all user RefreshTokens                                                  |

Side effects (cache invalidation, email, queue jobs) execute **after** transaction commit — never inside.

---

## Future Entities (Not Day 1)

```
Subscription  → organizationId, plan, status, expiresAt
Entitlement   → subscriptionId, feature, limit
OutboxEvent   → id, aggregateType, aggregateId, eventType, payload, processedAt
```

Future tenant-owned entities (examples):

```
Project    → organizationId NOT NULL (compound indexes required)
Task       → organizationId NOT NULL, projectId
Invoice    → organizationId NOT NULL, clientId
Client     → organizationId NOT NULL
```
