# ADR 0004: Signed Payment Webhook And Explicit Refund Ledger

Date: 2026-08-04

Status: accepted

## Context

Bank-transfer checkout previously created an `UNPAID` Payment that an admin could transition manually. Refund enum values existed, but opening direct `PAID -> REFUNDED` updates would hide partial refunds, provider retries and financial audit details.

Provider callbacks are untrusted public HTTP requests. They can arrive more than once, out of order, concurrently or with a reused transaction reference. JSON reserialization also cannot be used for HMAC verification because whitespace/key-order bytes may differ from the signed provider payload.

## Decision

- Keep payment/refund ownership in the existing Payments bounded context.
- Capture exact raw HTTP body bytes and verify `HMAC-SHA256(secret, timestamp + "." + rawBody)` with constant-time comparison.
- Reject timestamps outside a configurable short tolerance.
- Use a provider-neutral callback contract until a concrete provider adapter is selected.
- Persist only event identity/type/payload hash and relations; do not persist or log raw financial callback payload by default.
- Enforce unique `(provider,eventId)` and unique `(provider,providerRef)` identities.
- Treat exact event replay as a successful idempotent response; reject event ID reuse with another payload hash.
- Model Refund as a separate aggregate with amount, status, idempotency key, provider reference and append-only status history.
- Use `PARTIALLY_REFUNDED` as an explicit Payment/ParentOrder summary when successful refunds are below the paid amount.
- Allow one pending refund per Payment. Create/settle refund in Serializable transactions with conditional payment updates and bounded retry.
- Never delete or rewrite existing PaymentStatusHistory when refund state changes.

## Consequences

Positive:

- Provider retry does not duplicate financial effects.
- Partial/full/failed refunds remain queryable and auditable.
- Concurrent requests cannot intentionally over-refund through the application path.
- Provider-specific adapters can map into one tested state machine.

Trade-offs:

- Raw-body capture must stay enabled in every production/test bootstrap.
- A concrete provider may require a different signature envelope or fields; that belongs in an adapter, not duplicated payment logic.
- Only bank-transfer provider refunds are enabled now. COD refunds need a separately approved cash-return policy.
- A reconciliation job and operational refund UI remain necessary before a real provider launch.
