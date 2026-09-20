# ADR 003 — PostgreSQL 16 with Prisma ORM

**Date:** 2026-09-19
**Status:** Accepted

---

## Context

The platform requires a relational database capable of supporting:

- Multi-tenant data isolation (organizationId scoping)
- ACID transactions (critical for membership, role, and token operations)
- Complex queries (joins across User, Membership, Role, Permission, Module)
- JSON storage for extensible configuration (brandingConfig, OrganizationModule.config)
- Partial unique indexes (for Role name uniqueness across system/org scopes)
- Safe schema evolution via migrations

The ORM choice must integrate well with TypeScript, provide type-safe queries, and support both development migrations and production deployments.

---

## Decision

Use **PostgreSQL 16** as the database engine and **Prisma ORM** as the database access layer.

- `@platform/database` package exports a singleton `PrismaClient`.
- Prisma schema lives in `packages/database/prisma/schema.prisma`.
- Migrations live in `packages/database/prisma/migrations/`.
- The seed script lives in `packages/database/prisma/seed.ts`.

---

## Reasoning

**Why PostgreSQL?**

- Industry-standard relational database with ACID guarantees.
- Excellent JSON support (`JSONB`) for `brandingConfig` and `config` fields.
- Partial unique indexes — required for Role name uniqueness (system vs. org-specific).
- Row-level security support (future option if schema-per-tenant approach is ever needed).
- Mature ecosystem, excellent documentation, compatible with all major hosting providers (AWS RDS, Google Cloud SQL, Azure, Render, Railway, self-hosted).
- Vendor-independent: no BaaS-specific features used.

**Why Prisma?**

- Type-safe query builder with full TypeScript inference.
- Schema-as-code with migration generation and tracking.
- Excellent NestJS integration.
- The Prisma client generated from the schema produces TypeScript types used across the platform.
- Straightforward transaction support via `prisma.$transaction()`.
- Specified in the technology stack requirements.

---

## Alternatives Considered

| Option      | Rejected Reason                                                                                                            |
| ----------- | -------------------------------------------------------------------------------------------------------------------------- |
| MySQL       | Less mature JSON support; no partial unique indexes without workarounds; PostgreSQL is strictly superior for this use case |
| MongoDB     | Document model is a poor fit for relational multi-tenancy; ACID transactions are complex to coordinate                     |
| SQLite      | Not suitable for multi-tenant SaaS with concurrent writes                                                                  |
| Supabase    | BaaS — explicitly prohibited by architecture requirements; creates vendor lock-in                                          |
| Drizzle ORM | Newer, less ecosystem maturity; Prisma is specified in requirements                                                        |
| TypeORM     | More verbose; decorator-heavy; weaker type inference than Prisma                                                           |
| Knex        | Raw query builder; no schema management; too low-level                                                                     |

---

## Consequences

- **Partial unique indexes** for Role name uniqueness cannot be expressed in the Prisma schema DSL. They are applied via raw SQL in the migration file. This is documented explicitly.
- All schema changes must go through Prisma migrations. No direct DDL in production.
- The `@platform/database` package must be built before `apps/api` and `apps/worker` (Turborepo handles this dependency).
- For production, **connection pooling via PgBouncer** is recommended (not required on Day 1 for single-instance deployment).
- `DATABASE_DIRECT_URL` may be needed for Prisma migrations when PgBouncer is in use (Prisma does not support connection pooling for migration commands).

## Note on Vendor Independence

PostgreSQL is a fully open standard. The connection string format (`postgresql://`) is universal. Migrating between hosting providers requires only a `DATABASE_URL` change — no application code changes.
