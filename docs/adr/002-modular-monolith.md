# ADR 002 — NestJS Modular Monolith (No Microservices)

**Date:** 2026-09-19
**Status:** Accepted

---

## Context

The platform requires a backend that can serve multiple types of functionality (auth, user management, organizations, memberships, billing, CRM, projects, etc.) with strong module isolation, but is also simple enough to operate and reason about in the early stages of the product.

The main architectural question was whether to use microservices, a monolith, or something in between.

---

## Decision

Use a **modular monolith** built with NestJS. All backend code lives in `apps/api`. Future modules are added under `apps/api/src/modules/` as isolated NestJS modules.

The directory structure is:

```
apps/api/src/
  common/      → reusable guards, decorators, filters, interceptors
  config/      → environment variable management
  modules/
    health/
    auth/
    users/
    organizations/
    memberships/
    roles/
    feature-modules/
    [future modules...]
```

---

## Reasoning

**Why not microservices?**

- The platform is in its earliest stages. Microservices introduce enormous operational complexity: inter-service communication, service discovery, distributed tracing, independent deployments, network latency on internal calls.
- The team is small. Operating and debugging distributed systems requires significant investment.
- Premature microservice extraction often produces a "distributed monolith" — the worst of both worlds.
- NestJS modules provide the necessary isolation and can be extracted into separate services later if genuinely required.

**Why NestJS?**

- TypeScript-first framework with excellent decorator support, dependency injection, and module system.
- Guards, interceptors, pipes, and filters map cleanly to the security and transformation patterns required by the platform.
- Strong ecosystem: Passport for auth, ConfigModule for env management, BullMQ for queues.
- Specified in the technology stack requirements.

**Why a modular monolith specifically?**

- Each NestJS module is independently testable with clear boundaries.
- Module dependencies are declared explicitly (`imports: []`).
- If a specific module grows to warrant independent scaling, it can be extracted — the module boundary is already clean.
- Database migrations, transactions, and shared code are dramatically simpler with a single deployment unit.

---

## Alternatives Considered

| Option                   | Rejected Reason                                                                                       |
| ------------------------ | ----------------------------------------------------------------------------------------------------- |
| Microservices from Day 1 | Enormous operational complexity for no benefit at this scale                                          |
| Express (no framework)   | No built-in module system, DI, or guard patterns; requires manual implementation of platform concerns |
| Fastify                  | Good performance but less ecosystem maturity for auth/guards/modules                                  |
| tRPC                     | No REST API; not compatible with future mobile clients or third-party integrations                    |

---

## Consequences

- All backend code deploys as a single unit — simple to operate.
- Future extraction of a module requires: creating a new app, moving the module code, replacing in-process calls with HTTP/gRPC/message queue, and updating the API gateway. This is achievable because the module boundaries are clean from the start.
- Database transactions spanning multiple modules are straightforward (same Prisma client).
- Scaling is horizontal (run multiple instances behind a load balancer) — this is sufficient for most SaaS products.

## Future Module Roadmap

Planned modules to be added in future phases:

```
modules/
  auth/         ✅ Day 1
  users/        ✅ Day 1
  organizations/ ✅ Day 1
  memberships/  ✅ Day 1
  roles/        ✅ Day 1
  feature-modules/ ✅ Day 1
  projects/     Day 2+
  tasks/        Day 2+
  clients/      Day 2+
  invoices/     Day 2+
  calendar/     Day 2+
  chat/         Day 2+
  content/      Day 2+
  notifications/ Day 2+
  media/        Day 2+
  audit/        Day 2+
  subscriptions/ Day 2+
```
