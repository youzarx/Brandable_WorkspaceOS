# Local Infrastructure Foundation (Phase 6)

This document describes the operational procedures for managing the local development infrastructure (PostgreSQL 16 and Redis 7) configured via `docker-compose.yml` in the project root.

---

## 1. Approved Service Versions

- **PostgreSQL**: `16-alpine` (Database engine)
- **Redis**: `7-alpine` (Background queues & ephemeral data)

---

## 2. Prerequisites

- Docker Desktop / Docker Engine 24.x+
- `docker compose` CLI plugin

---

## 3. Operations & Workflow Commands

### Start Infrastructure

Start PostgreSQL 16 and Redis 7 services in the background:

```bash
docker compose up -d
```

### Inspect Infrastructure Health

Check container health state:

```bash
docker compose ps
```

Both `postgres` and `redis` should report `(healthy)`.

### View Logs

Inspect service logs:

```bash
docker compose logs postgres
docker compose logs redis
docker compose logs -f    # Follow live logs for all services
```

### Stop Infrastructure

Stop containers while maintaining persistent volume data (`platform_pgdata`, `platform_redisdata`):

```bash
docker compose down
```

### Reset Local Infrastructure Data

To completely delete development volumes and reset data:

```bash
docker compose down -v
```

> ⚠️ **Warning:** Running `docker compose down -v` permanently destroys local PostgreSQL and Redis volume data. Run `pnpm db:migrate` and `pnpm db:seed` after resetting.

---

## 4. Environment Configuration & Networking

### Host Development vs. Docker Container Networking

| Environment                          | PostgreSQL URL                                               | Redis URL                |
| ------------------------------------ | ------------------------------------------------------------ | ------------------------ |
| Host App (`apps/api`, `apps/worker`) | `postgresql://platform:platform@localhost:5432/platform_dev` | `redis://localhost:6379` |
| Container Network                    | `postgresql://platform:platform@postgres:5432/platform_dev`  | `redis://redis:6379`     |

### Environment Variables (.env)

Configured variables in `.env` / `.env.example`:

- `DATABASE_URL`: PostgreSQL connection URI
- `POSTGRES_DB`: Default database name (`platform_dev`)
- `POSTGRES_USER`: Database username (`platform`)
- `POSTGRES_PASSWORD`: Database password (`platform`)
- `REDIS_URL`: Redis connection URI (`redis://localhost:6379`)
