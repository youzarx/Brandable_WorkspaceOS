# ADR 009 — Cache Consistency: PostgreSQL as Source of Truth, Redis as Cache-Only

**Date:** 2026-09-19
**Status:** Accepted

---

## Context

The platform uses Redis alongside PostgreSQL. The key question is: which data lives in Redis, and what are the consistency guarantees?

Incorrect use of Redis as an authoritative data store for security-sensitive information (membership, permissions) would create stale-authorization windows — a security vulnerability.

---

## Decision

**PostgreSQL is the authoritative source of truth for all business data.** Redis is a disposable cache layer.

### Day 1 Rules

| Data Type             | Cache?      | Source                                          |
| --------------------- | ----------- | ----------------------------------------------- |
| Membership records    | ❌ No       | PostgreSQL (live read on every request)         |
| Role records          | ❌ No       | PostgreSQL (live read on every request)         |
| Permission list       | ❌ No       | PostgreSQL (live read on every request)         |
| Module enabled status | ❌ No       | PostgreSQL (live read on every request)         |
| Organization branding | ✅ Optional | PostgreSQL → Redis (TTL: 5 min, best-effort)    |
| Rate limit counters   | ✅ Yes      | Redis (authoritative for rate limiting only)    |
| BullMQ job queues     | ✅ Yes      | Redis (authoritative for queue management only) |

**Authorization decisions are never read from Redis.** This means: if an admin removes a user's permission at T=0, the next request at T=1 is denied — no stale window.

### Cache Invalidation Pattern

When business data changes:

```
1. Prisma transaction BEGIN
2. Write to PostgreSQL
3. COMMIT
4. Invalidate Redis cache key(s)   ← after commit, outside transaction
```

If step 4 fails (Redis unavailable), the cache key will become stale. On the next read, the miss falls through to PostgreSQL, which re-populates the cache. **Stale cache is a temporary inconsistency in non-auth data — never in authorization decisions.**

### Redis Unavailability Behavior

| Component                          | Redis unavailable behavior                                     |
| ---------------------------------- | -------------------------------------------------------------- |
| Authorization                      | Unaffected (no Redis dependency)                               |
| Branding cache                     | Miss → PostgreSQL read → response (no error)                   |
| Rate limiting (security endpoints) | In-process fallback rate limiter (per-IP, conservative limits) |
| Rate limiting (general endpoints)  | Warn and allow (graceful degradation)                          |
| BullMQ queues                      | 503 on async-only endpoints; synchronous endpoints unaffected  |

---

## Reasoning

**Why not cache authorization decisions?**

- Permission revocation and membership removal must take effect immediately.
- A 1-minute TTL cache means an admin's actions take up to 60 seconds to propagate — unacceptable for a security control.
- At Day 1 scale, the authorization DB reads (2 indexed queries) are sub-millisecond. Performance cost is negligible.
- The risk of cached authorization bypassing security rules far outweighs the performance benefit.

**Why keep branding data cacheable?**

- Organization name, logo, colors — these are UI/UX concerns, not security controls.
- Staleness for 5 minutes is harmless (a logo update appearing slightly delayed is acceptable).
- These reads happen on every page load; caching reduces unnecessary DB reads.

**Why is Redis "authoritative" for rate limiting?**

- Rate limit counters are inherently ephemeral — losing them on Redis restart is acceptable.
- The "authoritative" label means: if Redis says a user is rate-limited, we trust that — we don't fall back to PostgreSQL for a second opinion.
- This is appropriate because rate limiting is a traffic control mechanism, not a business data concern.

---

## Alternatives Considered

| Option                               | Rejected Reason                                                                                 |
| ------------------------------------ | ----------------------------------------------------------------------------------------------- |
| Cache membership + short TTL (1 min) | Creates a 60-second window where revoked access remains valid; security risk                    |
| Redis as primary session store       | Redis outage terminates all user sessions; unacceptable availability tradeoff                   |
| Write-through cache                  | Complex implementation; cache and DB can still diverge on failure; not justified at Day 1 scale |
| Cache-aside with no TTL              | Stale cache without a TTL can persist indefinitely; dangerous                                   |

---

## Future Caching Considerations

If profiling shows authorization DB reads are a performance bottleneck at scale:

1. Create a new ADR documenting the specific performance data.
2. Propose a caching strategy with explicit TTL bounds (e.g., 30 seconds maximum for permission lists).
3. Design a cache invalidation event to push invalidations on admin actions.
4. Require explicit security review before enabling authorization caching.

**Never enable authorization caching without a dedicated security review and ADR.**

---

## Consequences

- Two indexed PostgreSQL reads occur on every authenticated request (membership + permissions).
- This is acceptable at current scale. At 10,000+ requests/second, re-evaluate with profiling data.
- Redis failure does not affect auth correctness — it degrades only non-critical features.
- All Redis data must be treated as disposable: the application must function correctly if Redis is flushed or restarted.
