# Platform

A configurable, white-label, multi-tenant SaaS platform foundation.

> **Status:** Foundation phase — core infrastructure only. Business modules are built on top in subsequent phases.

---

## Prerequisites

| Tool    | Minimum Version |
| ------- | --------------- |
| Node.js | 20.x            |
| pnpm    | 9.x             |
| Docker  | 24.x            |
| Git     | 2.x             |

---

## Quick Start

### 1. Clone and install

```bash
git clone <repository-url> platform
cd platform
pnpm install
```

### 2. Configure environment

```bash
cp .env.example .env
# Edit .env — the defaults work for local development without changes
```

### 3. Start infrastructure (PostgreSQL + Redis)

```bash
docker compose up -d
```

Verify containers are healthy:

```bash
docker compose ps
```

### 4. Set up the database

```bash
# Generate Prisma client
pnpm db:generate

# Run migrations
pnpm db:migrate

# Seed development data
pnpm db:seed
```

The seed creates:

- 1 development organization (`slug: dev-org`)
- 1 development user (`dev@platform.local` / `Dev1234!`)
- 1 Owner membership
- System roles (OWNER, ADMIN, MEMBER) with permissions
- All platform modules registered

### 5. Start development servers

```bash
pnpm dev
```

| Service       | URL                                 |
| ------------- | ----------------------------------- |
| Web (Next.js) | http://localhost:3000               |
| API (NestJS)  | http://localhost:3001               |
| API Health    | http://localhost:3001/api/v1/health |

---

## Project Structure

```
platform/
├── apps/
│   ├── web/          # Next.js 15 — App Router frontend
│   ├── api/          # NestJS — REST API (modular monolith)
│   └── worker/       # NestJS standalone — background job processor
│
├── packages/
│   ├── database/     # Prisma schema, migrations, seed
│   ├── types/        # Shared TypeScript interfaces
│   ├── validation/   # Shared Zod schemas
│   ├── config/       # Shared constants and environment types
│   └── ui/           # Shared React component library (shadcn/ui)
│
├── docs/
│   ├── adr/          # Architecture Decision Records
│   ├── architecture.md
│   ├── database.md
│   ├── security.md
│   └── product-vision.md
│
├── infrastructure/   # Reserved for Terraform/K8s (future)
├── .github/
│   └── workflows/    # GitHub Actions CI
│
├── AGENTS.md         # Rules for AI coding agents
├── PRODUCT.md        # Product vision and scope
└── docker-compose.yml
```

---

## Common Commands

### Development

```bash
pnpm dev               # Start all apps in development mode
pnpm build             # Build all apps and packages
pnpm lint              # Lint all workspaces
pnpm typecheck         # Type-check all workspaces
pnpm test              # Run all tests
pnpm format            # Format all files with Prettier
pnpm format:check      # Check formatting without writing
```

### Database

```bash
pnpm db:generate       # Regenerate Prisma client after schema changes
pnpm db:migrate        # Apply pending migrations (production)
pnpm db:migrate:dev    # Create and apply new migration (development)
pnpm db:seed           # Seed development data
pnpm db:studio         # Open Prisma Studio (database browser)
pnpm db:reset          # Reset database and re-seed (development only)
```

### Infrastructure

```bash
docker compose up -d            # Start PostgreSQL + Redis
docker compose down             # Stop containers (data preserved)
docker compose down -v          # Stop containers and delete volumes
docker compose ps               # Check container status
docker compose logs postgres    # View PostgreSQL logs
```

---

## Architecture Overview

- **Frontend:** Next.js 15 (App Router, TypeScript, Tailwind CSS, shadcn/ui)
- **Backend:** NestJS modular monolith (REST API, TypeScript)
- **Database:** PostgreSQL 16 via Prisma ORM
- **Cache/Queue:** Redis (non-auth caching + BullMQ jobs)
- **Monorepo:** pnpm workspaces + Turborepo
- **Authentication:** Self-hosted JWT (15-minute access tokens, 7-day hashed refresh tokens)

See [`docs/architecture.md`](docs/architecture.md) for the full architecture document.

---

## Documentation

| Document                                       | Purpose                                       |
| ---------------------------------------------- | --------------------------------------------- |
| [`PRODUCT.md`](PRODUCT.md)                     | Product vision, scope, and out-of-scope items |
| [`AGENTS.md`](AGENTS.md)                       | Rules for AI coding agents and contributors   |
| [`docs/architecture.md`](docs/architecture.md) | Full technical architecture                   |
| [`docs/database.md`](docs/database.md)         | Database schema and relationships             |
| [`docs/security.md`](docs/security.md)         | Security model and tenant isolation           |
| [`docs/adr/`](docs/adr/)                       | Architecture Decision Records                 |

---

## Development Credentials (Local Only)

> ⚠️ These credentials exist only for local development. Never use them in any deployed environment.

| Resource            | Value                |
| ------------------- | -------------------- |
| PostgreSQL DB       | `platform_dev`       |
| PostgreSQL User     | `platform`           |
| PostgreSQL Password | `platform`           |
| Dev User Email      | `dev@platform.local` |
| Dev User Password   | `Dev1234!`           |
| Dev Org Slug        | `dev-org`            |

---

## CI

GitHub Actions runs on every push to `main` and every pull request:

- `pnpm install`
- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- `pnpm build`

All checks must pass before merging.

---

## Contributing

1. Read `AGENTS.md` before making changes.
2. Follow conventional commit style: `feat:`, `fix:`, `refactor:`, `docs:`, `chore:`, `test:`.
3. Run `pnpm lint && pnpm typecheck && pnpm test` before pushing.
4. Document architectural decisions in `docs/adr/`.
