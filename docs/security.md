# Security — Platform

## Overview

Security is a first-class architectural concern. This document describes the security model, threat mitigations, and required practices for every developer and coding agent working on this platform.

Read this document before touching any code related to authentication, authorization, tenant data, or API endpoints.

---

## 1. Tenant Isolation — The Highest Priority

Multi-tenant isolation is the most critical security requirement. A breach of tenant isolation exposes one customer's data to another. This must never happen.

### The Mandatory 5-Step Check

Every request that accesses tenant-owned data MUST pass all five checks:

```
1. AUTHENTICATION
   - JWT signature verified
   - JWT not expired
   - User.id found in database
   - User.deletedAt IS NULL

2. MEMBERSHIP
   - Active Membership record found in PostgreSQL (live read — no Redis cache)
   - Membership.status = ACTIVE
   - Membership.deletedAt IS NULL
   - Organization.deletedAt IS NULL

3. ORGANIZATION SCOPE
   - organizationId is taken from Membership.organizationId (DB)
   - NEVER from: request body, query params, route params, JWT claims, headers
   - All DB queries include: WHERE organizationId = membership.organizationId

4. PERMISSION (where applicable)
   - User's roleId has the required permission key in RolePermission (live DB read)
   - Permission check is server-side only

5. RESOURCE OWNERSHIP
   - DB query: WHERE id = resourceId AND organizationId = membership.organizationId
   - If not found → NotFoundException (404) — do NOT reveal 403 for cross-tenant access
```

### What MUST Never Be Trusted

```
❌ req.body.organizationId
❌ req.query.organizationId
❌ req.params.organizationId (only used to look up org slug, not as an authorization claim)
❌ JWT claims containing organizationId
❌ Headers set by the client claiming an organizationId
❌ Frontend state / local storage
```

### Cross-Tenant IDOR Prevention

Every service-layer query for tenant-owned resources:

```typescript
// ✅ CORRECT — combines resource ID with verified organizationId
const resource = await prisma.project.findFirst({
  where: {
    id: resourceId,
    organizationId: membership.organizationId, // from DB, never from client
  },
});

if (!resource) {
  throw new NotFoundException(); // 404 — not 403. Don't reveal existence.
}

// ❌ WRONG — never query by ID alone for tenant resources
const resource = await prisma.project.findFirst({ where: { id: resourceId } });
```

---

## 2. Authentication Architecture

### Access Token

- Type: JWT (JSON Web Token)
- Algorithm: HS256 (symmetric) — `JWT_ACCESS_SECRET`
- TTL: 15 minutes
- Payload: `{ sub: userId, email, iat, exp }` — nothing else
- Storage (client): memory only (never localStorage, never sessionStorage)
- Transport: `Authorization: Bearer <token>` header

### Refresh Token

- Type: cryptographically secure random bytes — `crypto.randomBytes(64)`
- Storage (server): SHA-256 hash only — raw token is never stored
- Storage (client): `httpOnly` cookie — never accessible to JavaScript
- TTL: 7 days (enforced by `expiresAt` column)
- Cookie flags: `HttpOnly; Secure; SameSite=Strict; Path=/api/v1/auth`
- Cookie `SameSite` policy is deployment-topology dependent (see Section 7)

### Token Family and Theft Detection

Each refresh token belongs to a `familyId`. When any revoked token from a family is reused:

| Family state                  | Response              | Action                             |
| ----------------------------- | --------------------- | ---------------------------------- |
| Active tokens exist in family | `SESSION_COMPROMISED` | Revoke all active tokens in family |
| No active tokens in family    | `INVALID_TOKEN`       | No action (clean logout/expired)   |

This model is **conservative** — it may cause re-login on concurrent refresh from the same device. The client is required to serialize refresh calls.

### Refresh Token Rotation (Concurrent Safety)

PostgreSQL atomic conditional UPDATE handles race conditions:

```sql
UPDATE "RefreshToken"
SET "revokedAt" = NOW()
WHERE "tokenHash" = $hash
  AND "revokedAt" IS NULL
  AND "expiresAt" > NOW()
RETURNING id, "familyId"
```

Only one concurrent writer can succeed. The losing request sees 0 rows and follows the theft-detection path.

### Session Invalidation Events

| Event                 | Action                                                        |
| --------------------- | ------------------------------------------------------------- |
| Logout                | Revoke the current RefreshToken record                        |
| Password change       | Revoke ALL RefreshToken records for the user (in transaction) |
| Membership removal    | Access token expires naturally (15m TTL)                      |
| `SESSION_COMPROMISED` | Revoke all active tokens in the family                        |

---

## 3. Authorization Architecture

Authorization is strictly server-side. Frontend permission checks are UX convenience only — they are never a security boundary.

### Guard Chain

```
JwtAuthGuard        → Who is this user?
MembershipGuard     → Are they a member of this org? (live DB)
ModuleGuard         → Is this module enabled for this org? (live DB)
PermissionsGuard    → Do they have the required permission? (live DB)
Service layer       → Does the resource belong to this org? (DB query)
```

### No Authorization Caching (Day 1)

Authorization decisions read from PostgreSQL on every request. Redis is not used for membership, role, or permission data.

Effect: if an admin removes a user's permission at T=0, that user's next request at T=1 is denied.

This may be revisited in a future phase with explicit security review.

### Permission Keys

Format: `<resource>.<action>`

Examples: `organizations.read`, `users.invite`, `roles.manage`, `modules.configure`, `audit.read`

---

## 4. Password Security

| Property               | Implementation                                                           |
| ---------------------- | ------------------------------------------------------------------------ |
| Hashing algorithm      | bcrypt, cost factor ≥ 12                                                 |
| Verification           | `bcrypt.compare(plaintext, hash)` — constant-time comparison             |
| Storage                | Hash only — plaintext never stored, logged, or returned                  |
| Minimum requirements   | ≥ 8 characters (configurable; stronger rules recommended for production) |
| Brute-force protection | Rate limiting on login endpoint (Redis + in-process fallback)            |

**Future extension points (not Day 1):**

- Password reset via email token
- Email verification on registration
- HIBP (Have I Been Pwned) check on password change
- Two-factor authentication

---

## 5. Rate Limiting and Brute-Force Protection

Rate limiting is prepared architecturally. Implementation is Day 2.

### Endpoint Classification

**Security-sensitive endpoints** (fail-closed when Redis is unavailable):

- `POST /auth/login`
- `POST /auth/refresh`
- `POST /auth/logout`
- `POST /auth/register`
- `POST /auth/password/change`

**Non-security-sensitive endpoints** (graceful degradation when Redis is unavailable):

- All other authenticated CRUD endpoints

### Redis Failure Behavior

| Endpoint type      | Redis available     | Redis unavailable                                 |
| ------------------ | ------------------- | ------------------------------------------------- |
| Security-sensitive | Redis rate limiter  | In-process fallback (per-IP, conservative limits) |
| Non-sensitive      | Redis rate limiter  | Allow (warn and continue)                         |
| Authorization      | No Redis dependency | No Redis dependency                               |

**In-process fallback:** Node.js `Map<string, { count, windowStart }>`. Not distributed — acceptable for single-instance Day 1. For multi-instance: Redis is a hard dependency for security-sensitive endpoints.

---

## 6. Security Hardening Controls

| Control                  | Implementation                                                                      |
| ------------------------ | ----------------------------------------------------------------------------------- |
| Security headers         | `helmet` (HSTS, CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy)      |
| CORS                     | Explicit origin allowlist; `credentials: true`; no wildcard with credentials        |
| Input validation         | Global `ValidationPipe` (`whitelist: true, forbidNonWhitelisted: true`)             |
| Body size limit          | 10 MB default                                                                       |
| SQL injection            | Prisma parameterized queries                                                        |
| XSS                      | CSP headers; no innerHTML; output encoding                                          |
| Sensitive field exposure | Prisma `select` / response DTOs — `passwordHash` and `tokenHash` never in responses |
| Error exposure           | `GlobalExceptionFilter` sanitizes all errors in production — no stack traces        |
| Secrets                  | `.env` never committed; `.env.example` documents all variables                      |
| TypeScript               | Strict mode; `noExplicitAny`; no `@ts-ignore`                                       |

---

## 7. Cookie Policy

Day 1 default for same-domain deployments:

```
HttpOnly; Secure; SameSite=Strict; Path=/api/v1/auth; Max-Age=604800
```

### Deployment Topology Impact

| Topology                                               | SameSite          | Notes                                                 |
| ------------------------------------------------------ | ----------------- | ----------------------------------------------------- |
| Same domain (e.g. `platform.com` + `api.platform.com`) | `Strict` or `Lax` | Evaluate subdomain cookie sharing                     |
| Separate domains (e.g. `app.com` + `api.other.com`)    | `None`            | Requires `Secure=true` + HTTPS + explicit CORS        |
| Custom tenant domains                                  | `None`            | Same as above; requires CORS policy per tenant domain |

`COOKIE_SAME_SITE` is configured via environment variable. This is a deployment decision, not a code change. Re-evaluate explicitly for each new deployment topology.

---

## 8. Observability and Audit

- Every request carries a `X-Request-Id` (UUID v4) — generated by middleware if absent.
- Structured JSON logs include: `requestId`, `userId`, `method`, `path`, `statusCode`, `duration`.
- `AuditLog` table records security-relevant events per organization (append-only, immutable).
- Future: Sentry for error monitoring; OpenTelemetry for distributed tracing.

---

## 9. Secret Management

| Secret             | Rule                                                                         |
| ------------------ | ---------------------------------------------------------------------------- |
| `.env` files       | Never committed to version control                                           |
| `.env.example`     | Committed; shows variable names with safe placeholder values                 |
| JWT secrets        | Minimum 32 characters; cryptographically random                              |
| Cookie secrets     | Same requirements                                                            |
| Database passwords | Development-only in `.env.example`; production via secrets manager           |
| Production secrets | Managed by infrastructure secrets manager (AWS Secrets Manager, Vault, etc.) |

---

## 10. Backup and Disaster Recovery

PostgreSQL is the authoritative source of all business data.

| Concern             | Guidance                                                                                       |
| ------------------- | ---------------------------------------------------------------------------------------------- |
| Backups             | Automated daily snapshots + WAL archiving for point-in-time recovery                           |
| Restore             | Documented runbook required before production launch                                           |
| Migrations          | All schema changes via Prisma migrations (source-controlled)                                   |
| Redis data          | Disposable — all authoritative data is in PostgreSQL                                           |
| Vendor independence | Standard PostgreSQL; compatible with AWS RDS, Google Cloud SQL, self-hosted, Supabase Postgres |

---

## 11. Vendor Independence

The platform owns its entire security stack:

- Authentication (self-hosted JWT)
- Authorization (RBAC via PostgreSQL)
- Database (standard PostgreSQL)
- Business logic (NestJS)

**No BaaS platforms** (Supabase, Firebase, Clerk, Auth0, Appwrite, Convex) are used. Infrastructure providers (cloud hosts, CDNs) must remain replaceable without changing application code.

---

## Tenant Isolation Test Requirements

The following tests are mandatory and must cover negative cases (intentional unauthorized access attempts):

```
□ User from Org A cannot read Org B resources
□ User from Org A cannot update Org B resources
□ User from Org A cannot delete Org B resources
□ User cannot access another org's membership list
□ User cannot manipulate another org's roles
□ User cannot access another org's module configuration
□ Revoked membership → immediate denial on next request
□ Removed permission → immediate denial on next request
□ Token reuse after rotation → SESSION_COMPROMISED
□ Token reuse after logout → INVALID_TOKEN
□ Token reuse after password change → INVALID_TOKEN
□ Token family fully revoked → INVALID_TOKEN (idempotent)
```
