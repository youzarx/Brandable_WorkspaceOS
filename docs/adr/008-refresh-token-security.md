# ADR 008 — Refresh Token Security: Hash-Only Storage + Conservative Family Revocation

**Date:** 2026-09-19
**Status:** Accepted

---

## Context

Refresh tokens are long-lived credentials (7-day TTL) that allow users to obtain new access tokens without re-authenticating. They represent a high-value target for attackers. If a refresh token is stolen, the attacker can impersonate the user for up to 7 days.

The security model must:

- Prevent stolen tokens from being usable if detected.
- Support secure token rotation (new token issued on each use).
- Handle concurrent refresh requests safely without a distributed lock.
- Detect token theft and respond appropriately.

---

## Decision

### 1. Hash-Only Storage

Refresh tokens are never stored in plaintext or as bcrypt hashes. Only the **SHA-256 hash** of the raw token is stored in PostgreSQL:

```typescript
// Token generation
const rawToken = crypto.randomBytes(64).toString('hex'); // 128 hex chars
const tokenHash = createHash('sha256').update(rawToken).digest('hex');

// Storage
await prisma.refreshToken.create({ data: { tokenHash, familyId, userId, expiresAt } });

// Client receives raw token (via httpOnly cookie)
// Database stores only tokenHash
```

### 2. Token Families

Each refresh token belongs to a `familyId` (UUID). When a token is rotated, the new token inherits the same `familyId`. This groups the entire rotation chain of a session.

### 3. Conservative Family Revocation (No Timing Heuristic)

When a revoked token is presented, the response depends on the family state:

| Family has active tokens? | Response              | Action                                            |
| ------------------------- | --------------------- | ------------------------------------------------- |
| YES                       | `SESSION_COMPROMISED` | Revoke ALL active tokens in the family            |
| NO                        | `INVALID_TOKEN`       | No action (clean logout/expired/prior revocation) |

**No timing heuristic** (the 30-second window from earlier drafts was rejected). Timing is not a reliable signal — an attacker using a stolen token within 30 seconds of legitimate rotation would be misclassified as a concurrent request.

### 4. Concurrent Request Safety (Database-Atomicity Only)

```sql
UPDATE "RefreshToken"
SET "revokedAt" = NOW()
WHERE "tokenHash" = $hash
  AND "revokedAt" IS NULL
  AND "expiresAt" > NOW()
RETURNING id, "familyId"
```

- Only one concurrent writer succeeds (PostgreSQL row-level write lock).
- The losing concurrent request sees 0 rows updated and follows the revocation path.
- If the family has active tokens (just created by the winner), it is treated as `SESSION_COMPROMISED`.
- **Client obligation:** Serialize refresh calls. One refresh in-flight at a time. Use a singleton Promise pattern.

---

## The Five Reuse Cases

| Scenario                          | Family state            | Response                             |
| --------------------------------- | ----------------------- | ------------------------------------ |
| Concurrent race (B loses)         | Active successor exists | `SESSION_COMPROMISED` (conservative) |
| Stale tab / replay after rotation | Active successor exists | `SESSION_COMPROMISED`                |
| After logout                      | Family fully revoked    | `INVALID_TOKEN`                      |
| After password change             | All user tokens revoked | `INVALID_TOKEN`                      |
| After prior theft detection       | Family fully revoked    | `INVALID_TOKEN` (idempotent)         |

---

## Required Integration Tests

Seven integration tests are mandatory (see `docs/security.md` for the full list):

1. Concurrent refresh — one succeeds, one gets SESSION_COMPROMISED
2. Rotated token reuse — SESSION_COMPROMISED, successor revoked
3. Reuse after logout — INVALID_TOKEN, no theft alarm
4. Reuse after password change — INVALID_TOKEN
5. Reuse of fully-revoked family — INVALID_TOKEN (idempotent)
6. Valid rotation — baseline success case
7. Cross-user token attempt — INVALID_TOKEN

---

## Alternatives Considered

| Option                     | Rejected Reason                                                                                            |
| -------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Store raw token            | Plaintext DB exposure compromises all sessions on DB breach                                                |
| Store bcrypt hash          | bcrypt is intentionally slow; SHA-256 is correct for random tokens that don't need computational hardening |
| Redis-based sessions       | Redis is not a source of truth; Redis outage would invalidate all sessions                                 |
| 30-second timing heuristic | Attacker can abuse the window; timing is not a reliable signal for legitimacy                              |
| Distributed lock (Redis)   | Unnecessary; PostgreSQL atomicity is sufficient                                                            |
| No token families          | Cannot distinguish concurrent legitimate rotation from theft                                               |

---

## Consequences

- Concurrent refresh calls from the same client will cause the losing request to receive `SESSION_COMPROMISED` and force re-login. The client must serialize refresh calls.
- Token theft response (revoke active family tokens) terminates the legitimate user's session. This is intentional — the legitimate user re-authenticates and gets a new, safe session. The attacker receives nothing.
- Password change invalidates all sessions across all devices — users must re-authenticate everywhere.
- The `familyId` column enables session listing and management (future: "active sessions" UI).
