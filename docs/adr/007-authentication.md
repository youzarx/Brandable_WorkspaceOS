# ADR 007 — Self-Hosted JWT Authentication (Membership as Source of Truth)

**Date:** 2026-09-19
**Status:** Accepted

---

## Context

The platform requires a secure authentication system that:

- Identifies who the user is (authentication).
- Supports stateless API access via tokens.
- Enables secure session management with rotation and revocation.
- Does not create vendor lock-in.
- Can be replaced or extended without rewriting the business architecture.

---

## Decision

Implement **self-hosted JWT authentication** using:

- `@nestjs/passport` + `passport-jwt` for JWT strategy and guard infrastructure.
- `jsonwebtoken` for token signing and verification.
- `bcrypt` (cost factor ≥ 12) for password hashing.
- Custom refresh token management via the `RefreshToken` PostgreSQL table.

**The JWT payload contains only:**

```json
{ "sub": "userId", "email": "user@example.com", "iat": 0, "exp": 0 }
```

No `organizationId`, role, or permission claims are included.

**The Membership database record is the source of truth for organization access.** JWT is used only to identify the authenticated user. Organization context is always derived from the database at request time.

---

## Reasoning

**Why self-hosted (no Clerk, Auth0, Supabase Auth)?**

- The architecture requires complete ownership of the authentication boundary.
- BaaS auth providers create a hard dependency: user data, session management, and token format are controlled by the vendor.
- Migrating away from a BaaS auth provider is a major engineering effort (data migration, token format change, API changes).
- The platform's security model requires that authorization decisions (membership, roles, permissions) read from our own PostgreSQL database — not from a third-party JWT claim.

**Why JWT access tokens + refresh tokens (not sessions)?**

- Stateless access tokens scale horizontally without shared session storage.
- The 15-minute TTL limits the damage window if an access token is compromised.
- Refresh tokens (7-day, stored as hashed values in PostgreSQL) provide persistent sessions with revocation capability.
- httpOnly cookies for refresh tokens prevent JavaScript XSS access.

**Why is organizationId NOT in the JWT?**

- A JWT claim for `organizationId` would allow the token to authorize access to an organization even after membership is revoked — until the token expires.
- The only acceptable source of `organizationId` is the live database Membership record.
- This decision eliminates a category of authorization bypass vulnerabilities.

**Why not put roles/permissions in the JWT?**

- Same reasoning: role changes and permission revocations must take effect on the next request, not after token expiry.
- Stale JWT claims for roles are a known vulnerability pattern in RBAC systems.
- All authorization reads from live PostgreSQL on every request (see [ADR 009](009-cache-consistency.md)).

---

## Alternatives Considered

| Option                   | Rejected Reason                                                                                     |
| ------------------------ | --------------------------------------------------------------------------------------------------- |
| Clerk                    | Vendor lock-in; auth decisions controlled externally; user data stored in Clerk's system            |
| Auth0                    | Same concerns as Clerk; management API dependency                                                   |
| Supabase Auth            | Explicitly prohibited; BaaS platform                                                                |
| Keycloak (self-hosted)   | Heavy infrastructure; complex to operate; overkill for Day 1                                        |
| NextAuth.js / Auth.js    | Frontend-first; designed for Next.js sessions; not suitable for NestJS API auth                     |
| Session-only (no JWT)    | Requires shared session storage for horizontal scaling; less suitable for future mobile/API clients |
| JWT with org/role claims | Stale authorization window; role revocation not immediate; creates authorization bypass risk        |

---

## Token Architecture

```
Login → access_token (JWT, 15m) + raw_refresh_token (64 random bytes)
     → store SHA-256(raw_refresh_token) in RefreshToken table
     → set httpOnly cookie with raw token

Request → JwtAuthGuard validates access_token
        → MembershipGuard reads live Membership from DB
        → PermissionsGuard reads live RolePermission from DB

Refresh → conditional UPDATE (atomic) revokes old token
        → new raw token + hash generated
        → new httpOnly cookie set
```

See [ADR 008](008-refresh-token-security.md) for the full refresh token security model.

---

## Consequences

- The platform owns all authentication complexity: token generation, rotation, revocation, brute-force protection.
- Future enhancements (2FA, OAuth social login, magic links) can be added as additional Passport strategies without changing the core auth architecture.
- The auth module is isolated in `apps/api/src/modules/auth/`. Replacing it with a different auth provider in the future requires only changing this module and its downstream guards — not the business logic.
- Frontend must handle token management carefully: access token in memory only, refresh token via httpOnly cookie, serialized refresh calls.
