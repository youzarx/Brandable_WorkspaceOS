# ADR 006 — Open Dynamic Module Key System (No TypeScript Enum)

**Date:** 2026-09-19
**Status:** Accepted

---

## Context

The platform supports enabling and disabling feature modules per organization (e.g., `projects`, `tasks`, `invoices`, `crm`). This system needs to:

- Allow new modules to be added without changing the core platform architecture.
- Support per-tenant module configuration and future subscription-based entitlements.
- Be queryable and auditable (which modules does organization X have enabled?).
- Not require a code change every time a new module is introduced.

---

## Decision

Module keys are **dynamic strings** stored in the `Module` database table. There is no TypeScript enum enumerating all possible modules.

```typescript
// ❌ REJECTED — closed enum requires code change for every new module
enum PlatformModule {
  PROJECTS = 'projects',
  TASKS = 'tasks',
  INVOICES = 'invoices',
}

// ✅ ADOPTED — module key is a plain string, validated against DB
// Module.key: 'projects' | 'tasks' | ... (open set, lives in database)
```

The `@RequireModule('projects')` decorator accepts a string key. The `ModuleGuard` resolves it by joining `OrganizationModule` with `Module` on `Module.key`:

```typescript
// Correct ModuleGuard query:
prisma.organizationModule.findFirst({
  where: {
    organizationId: membership.organizationId,
    isEnabled: true,
    module: { key: requiredModuleKey }, // JOIN through relation
  },
});
```

There is **no `moduleKey` column on `OrganizationModule`**. The key lives on `Module` and is resolved through the relation.

---

## Reasoning

**Why no enum?**

- Adding a new module with an enum requires: (1) adding the enum value, (2) rebuilding the application, (3) deploying. This couples the module catalog to the codebase.
- Dynamic string keys allow new modules to be registered by inserting a row into the `Module` table — no code change required.
- The module catalog is an operational concern, not a code concern.

**Why string keys over integer IDs?**

- String keys (e.g., `'projects'`) are human-readable in URLs, logs, API responses, and configuration.
- They are stable across environments (no ID synchronization needed between development and production databases).

**Why the JOIN through Module (not a moduleKey column on OrganizationModule)?**

- `Module.key` is the canonical identifier. Denormalizing it into `OrganizationModule` would create a synchronization problem if a key ever changes.
- The JOIN is a simple indexed lookup and adds negligible overhead.

---

## Module System Architecture

```
Module (system registry)
  key: 'projects'        ← unique string, source of truth
  name: 'Projects'
  description: '...'

OrganizationModule (per-tenant config)
  organizationId: <id>
  moduleId: FK → Module.id  ← never moduleKey directly
  isEnabled: true
  config: {}             ← future: per-org module settings

@RequireModule('projects') decorator
  → ModuleGuard
  → JOIN: OrganizationModule JOIN Module WHERE Module.key = 'projects'
  → isEnabled = true check
```

**Future subscription layer (not Day 1):**

```
Subscription → Entitlements → OrganizationModule.isEnabled → Permissions
```

The `OrganizationModule.isEnabled` field is the correct insertion point for future billing/entitlement logic. No core architecture changes are needed.

---

## Alternatives Considered

| Option                             | Rejected Reason                                                                     |
| ---------------------------------- | ----------------------------------------------------------------------------------- |
| TypeScript enum                    | Closed — requires code change for every new module                                  |
| Feature flags (LaunchDarkly, etc.) | Vendor dependency for a core architectural concern; overkill for Day 1              |
| Hardcoded conditional checks       | `if (org.plan === 'enterprise') { ... }` — not auditable, not configurable, brittle |
| Separate config file               | Not queryable; cannot be managed via admin UI; not per-tenant                       |

---

## Consequences

- Module keys are not type-safe at the TypeScript level (they are strings). String constants are defined in `packages/config/src/modules.ts` and used consistently across the codebase to prevent typos.
- Adding a new module requires: (1) inserting a `Module` row (in a migration or seed), (2) seeding `OrganizationModule` records for existing orgs if it should be enabled by default, (3) implementing the module feature in `apps/api/src/modules/`.
- The `ModuleGuard` must always use the JOIN pattern — never a `moduleKey` column. This is documented in AGENTS.md.
