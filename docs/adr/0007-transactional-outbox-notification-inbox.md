# ADR 0007: Transactional Outbox for the Notification Inbox

- Status: Accepted
- Date: 2026-08-06

## Context

Shop review, checkout, fulfillment, cancellation, payment and refund changes must notify the affected user. Writing business data and then calling another delivery mechanism creates a dual-write gap: the transaction can commit while notification delivery fails, or a notification can be sent for a transaction that later rolls back.

The current product needs a durable in-app inbox. It does not yet require WebSocket, email or push delivery, but the persistence boundary should allow those transports later. Multiple API replicas may run the worker, so processing must be concurrency-safe and idempotent.

## Decision

Domain services create a `notification.requested` OutboxEvent using the same Prisma transaction as the business mutation. An embedded worker polls pending events and, inside a new transaction:

1. Locks one event with `FOR UPDATE SKIP LOCKED`.
2. Validates the payload.
3. Upserts a Notification using unique `outboxEventId`.
4. Marks the event PROCESSED.

Malformed payloads are marked FAILED with an error for investigation. Infrastructure errors roll back processing so the event remains retryable. Notification endpoints always scope by the authenticated user ID; read state is represented by nullable `readAt`.

## Consequences

Positive:

- Business state and notification intent are atomic.
- Worker restart and concurrent replicas do not duplicate inbox rows.
- The inbox survives browser reload/offline periods.
- Future RabbitMQ/email/push publishers can consume the same durable intent.

Trade-offs:

- Delivery is eventually consistent by the worker interval.
- Outbox/notification tables need monitoring, retention and failed-event operations.
- The embedded worker adds database polling to every API replica; a dedicated worker may be preferable at larger scale.
- An inbox event confirms a state change but never replaces querying the business aggregate as the source of truth.

## Rejected Alternatives

- Send after transaction: can permanently lose notification on process failure.
- Send before commit: can notify about rolled-back state.
- WebSocket only: no durable offline inbox and introduces connection state without solving dual writes.
- RabbitMQ direct publish inside the database transaction: PostgreSQL and broker cannot share the current transaction, so the dual-write gap remains.

## Verification

- Integration tests prove delivery idempotency, malformed-event quarantine and read ownership.
- Commerce E2E proves shop review, order placement, new shop order and fulfillment events reach the correct users.
- Unique database constraint on `notifications.outbox_event_id` is the final duplicate guard.
