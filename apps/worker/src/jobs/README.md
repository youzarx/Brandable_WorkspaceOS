# Worker Jobs Architecture & Future Execution Contract

This directory represents the future job processor boundary for the platform's asynchronous worker infrastructure.

## Phase 5 Status

In accordance with Phase 5 architecture rules:

- **0 Business Processors**: No business processors are implemented.
- **0 Business Queues**: No business queues are defined.
- **0 Fake Jobs**: No placeholder job implementations exist.

## Future Job Contract Specification

When business background jobs are introduced in future feature phases, all processors MUST adhere to the following architectural requirements:

### 1. Idempotency

Every job handler must be idempotent. Re-processing a job with the same `jobId` or business payload must produce the exact same system state without duplicate side-effects.

### 2. Retry & Exponential Backoff

Failed jobs must use deterministic BullMQ retry strategies:

- Default attempts: 3 to 5 depending on job criticality.
- Backoff strategy: Exponential backoff with jitter (`backoff: { type: 'exponential', delay: 1000 }`).

### 3. Failure & Dead-Letter Handling

- Non-retryable errors (e.g. fatal validation errors) must fail fast without consuming retry attempts.
- Exhausted retry jobs move to the BullMQ failed set / dead-letter inspection boundary.

### 4. Structured Logging & Context

Every job execution must log:

- `timestamp`
- `level` (`info`, `error`, `warn`)
- `queueName`
- `jobId`
- `attempt` count

No sensitive credentials, passwords, tokens, or PII must ever be logged.
