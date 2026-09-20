# Platform — Product Vision

## What Is This Platform?

This is a configurable, white-label, multi-tenant SaaS platform designed to be sold and deployed to startups, SMEs, agencies, and enterprise teams.

The platform is **not** a single product for a single company. It is infrastructure that any business can adopt, configure, and brand as its own.

---

## Who Does It Serve?

| Customer Type   | How They Use the Platform                                                |
| --------------- | ------------------------------------------------------------------------ |
| **Startups**    | Deploy quickly with sensible defaults; enable only the modules they need |
| **SMEs**        | Configure workflows, manage teams, white-label for their brand           |
| **Agencies**    | Run multiple client organizations from a single platform instance        |
| **Enterprises** | Custom roles, fine-grained permissions, module governance                |

---

## Core Concepts

### Multi-Tenancy

The platform is **organization-based**. Every customer is an **Organization** (tenant).

```
User
  ↓ (Membership)
Organization
  ↓ (owns)
All tenant resources
```

A single user can belong to multiple organizations with different roles in each. An organization can have many users. This is modeled explicitly via the `Membership` join entity — `organizationId` is never stored directly on `User`.

### White-Label

Every organization can configure its own:

- Name and slug
- Logo and favicon
- Primary and secondary brand colors
- Extended branding configuration (theme, navigation, future custom domain)

The platform core contains **zero hardcoded tenant branding**. All platform UI components are branding-agnostic and receive configuration from the organization's data.

### Modular Feature System

The platform supports enabling and disabling feature modules per organization. This allows:

- Subscription-based feature gating (future)
- Gradual rollout of new capabilities
- Organization-specific product configurations

Module keys are **dynamic strings** — adding a new module requires no changes to the core platform code.

```
Organization A: projects ✅  tasks ✅  invoices ❌
Organization B: projects ✅  tasks ❌  crm ✅
```

---

## MVP Philosophy

The initial version establishes the **engineering foundation** only. No business modules are built in this phase.

The foundation includes:

- Monorepo architecture
- Authentication (self-hosted JWT)
- Organization and membership management
- Role-based access control
- Module/feature enablement system
- White-label data foundation
- Developer tooling and CI

**Business modules are built on top of this foundation in subsequent phases.**

---

## What Is Explicitly Out of Scope for Day 1

- CRM
- Projects and Tasks
- Invoices and Billing
- Calendar
- Chat / Messaging
- Content Management
- Analytics
- AI features
- Payment processing
- Subscription management
- Custom domain routing
- Theme engine (CSS injection)
- Email sending
- File uploads / Media management
- WebSockets / Realtime
- Mobile applications
- Kubernetes / Terraform
- Microservices

---

## Internal Project Name

The internal codebase is named **platform** (or `@platform/*` for packages).

No specific company or customer name is hardcoded into reusable platform components. Individual tenants configure their identity through data, not code.
