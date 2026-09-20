# ADR 010 — Future Outbox Pattern for Event Consistency

**Date:** 2026-09-19
**Status:** Planned (Not Implemented on Day 1)

---

## Context

As the platform grows, business operations will need to trigger side effects:

- Sending notification emails (membership invite, password reset).
- Publishing events to other services or integrations.
- Pushing realtime updates to connected clients.
- Triggering background jobs that depend on committed business data.

A naive approach — commit the DB transaction, then publish the event — creates a consistency problem:

```
BEGIN TRANSACTION
  Update business data          ← succeeds
COMMIT

publish_event(...)              ← fails (network error, Redis down, etc.)

Result: DB has updated data, event system does not.
        The system is permanently inconsistent.
```

---

## Decision

Adopt the **Outbox Pattern** as the standard mechanism for reliable event publishing when it is introduced.

The Outbox Pattern resolves the DB/event consistency problem by writing the event into the same transaction as the business data:

```
BEGIN TRANSACTION
  Update business data           ← primary operation
  INSERT INTO OutboxEvent(...)   ← event recorded atomically
COMMIT

Worker polls OutboxEvent
  → Processes event (idempotent)
  → Marks event as processed
  → Publishes to downstream (email, WebSocket, webhook, queue)
```

Either both the business data and the event are committed, or neither is. The event system catches up asynchronously. The worker must implement idempotent processing to handle retries safely.

---

## Future `OutboxEvent` Table

```
OutboxEvent
  id              String    PK (cuid)
  aggregateType   String    e.g. 'Membership', 'Organization'
  aggregateId     String    e.g. membershipId
  eventType       String    e.g. 'membership.invited', 'org.created'
  payload         Json      event-specific data
  processedAt     DateTime? null until processed
  failedAt        DateTime? null until permanently failed
  attempts        Int       DEFAULT 0
  createdAt       DateTime  DEFAULT now()
```

---

## Why Not Implemented on Day 1

- No side-effect-triggering operations exist yet (no email, no webhooks, no realtime).
- The Outbox Pattern adds schema complexity and a polling worker loop.
- Adding it before it's needed would be premature engineering.
- The architecture (Worker app, BullMQ, PostgreSQL) is fully compatible with this pattern.

The Worker app placeholder (`apps/worker`) exists specifically to house the OutboxEvent polling loop when this pattern is introduced.

---

## Reasoning

**Why Outbox over direct event publishing?**

- Atomic consistency: business data and event publication are in the same transaction.
- No lost events: if the event publisher fails, the OutboxEvent record persists and is retried.
- Idempotent processing: the worker can safely retry without duplicating business effects.
- Decoupled: the business logic does not need to know about downstream consumers.

**Why not 2-Phase Commit (2PC)?**

- 2PC is extremely complex and fragile in distributed systems.
- The Outbox Pattern achieves the same consistency guarantee using standard SQL transactions.

**Why not Saga pattern?**

- Sagas are appropriate for distributed transactions across multiple services.
- Our modular monolith runs in a single database transaction — the Outbox Pattern is simpler and sufficient.

---

## Alternatives Considered

| Option                                    | Rejected Reason                                                                   |
| ----------------------------------------- | --------------------------------------------------------------------------------- |
| Fire-and-forget event publishing          | DB and event system can permanently diverge on any failure                        |
| 2-Phase Commit                            | Prohibitive complexity; not supported by most infrastructure                      |
| Change Data Capture (Debezium)            | Powerful but requires additional infrastructure (Kafka/Pulsar) before it's needed |
| In-memory event bus (NestJS EventEmitter) | Lost on process restart; no durability; not suitable for critical events          |

---

## Integration with Future Realtime

When WebSockets are introduced:

```
Database write
  → OutboxEvent INSERT (same transaction)
  → COMMIT
  → Worker polls OutboxEvent
  → Worker publishes to Redis pub/sub
  → WebSocket gateway subscribes to Redis pub/sub
  → Gateway pushes to connected clients
```

The NestJS WebSocket gateway connects as a separate module in `apps/api`. No architecture changes to existing modules are required.

---

## Consequences

- When this pattern is introduced: add `OutboxEvent` table via a new Prisma migration.
- The Worker app's main loop becomes the OutboxEvent processor.
- All operations with side effects must be refactored to use `$transaction([businessOp, outboxInsert])`.
- Worker jobs must be designed to be idempotent (check `processedAt` before processing).
- The `processedAt` field plus a unique constraint on `(aggregateId, eventType)` enables exactly-once semantics.
