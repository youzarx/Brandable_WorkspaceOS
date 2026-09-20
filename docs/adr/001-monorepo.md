# ADR 001 — Monorepo with pnpm Workspaces and Turborepo

**Date:** 2026-09-19
**Status:** Accepted

---

## Context

We are building a multi-tenant SaaS platform with multiple deployment units: a Next.js frontend, a NestJS API, a background worker, and several shared packages (types, validation schemas, UI components, database client). These units share code and need consistent tooling across the entire codebase.

The key questions were:

1. Should these live in one repository or several?
2. If one, how do we manage builds and dependencies?

---

## Decision

Use a **monorepo** managed by **pnpm workspaces** (for dependency installation and package linking) and **Turborepo** (for build orchestration, task caching, and pipeline definition).

Project structure:

```
platform/
  apps/    → deployable applications (web, api, worker)
  packages/ → shared libraries (types, validation, config, ui, database)
```

All packages use the `@platform/*` namespace.

---

## Reasoning

**Why a monorepo?**

- Shared TypeScript types and Zod schemas can be imported across `api`, `web`, and `worker` without publishing to npm.
- Cross-cutting changes (e.g., adding a field to `User`) can be made atomically in one commit across all affected packages.
- A single CI pipeline validates the entire system.
- Consistent tooling (ESLint, Prettier, TypeScript config) without duplication.

**Why pnpm?**

- Efficient disk usage via content-addressable storage (no duplicate `node_modules`).
- Strict workspace dependency resolution (no phantom dependencies).
- Fast install times compared to npm.
- Specified in the technology stack requirements.

**Why Turborepo?**

- Remote and local caching of build outputs — unchanged packages are not rebuilt.
- Correct task dependency resolution (`build` must run before `typecheck`).
- Designed specifically for pnpm monorepos with Next.js and NestJS; widely adopted.
- Minimal configuration overhead compared to Nx.

---

## Alternatives Considered

| Option                | Rejected Reason                                                                                      |
| --------------------- | ---------------------------------------------------------------------------------------------------- |
| Separate repositories | No shared code without npm publishing; cross-repo changes require multiple PRs; inconsistent tooling |
| npm/yarn workspaces   | pnpm is strictly specified; pnpm has better performance and strict dependency enforcement            |
| Nx                    | More powerful but significantly more complex configuration; Turborepo is sufficient for our needs    |
| Lerna                 | Legacy tool; largely superseded by Turborepo + pnpm for this use case                                |

---

## Consequences

- Setup complexity is higher than a single-app repository (mitigated by a well-documented README).
- Turborepo caching requires careful `inputs`/`outputs` configuration to avoid stale cache.
- All developers must use pnpm (enforced via `packageManager` field in `package.json`).
- CI must use pnpm and Turborepo (handled in `.github/workflows/ci.yml`).
