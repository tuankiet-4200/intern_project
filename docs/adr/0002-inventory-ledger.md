# ADR 0002 - Inventory Ledger For Stock Changes

Date: 2026-07-15

## Status

Accepted

## Context

Commerce systems must protect stock correctness, especially under concurrent checkout. Simple direct stock overwrites make it hard to audit changes, debug overselling, handle returns, or reconcile inventory after failures.

## Decision

Inventory will store current counters and an append-only ledger of meaningful changes.

Current counters:

- `onHand`
- `reserved`
- `sold`

Derived value:

- `available = onHand - reserved`

Every stock mutation must write an `InventoryLedger` record with reason, deltas, optional reference id, and note.

## Consequences

Benefits:

- Auditable stock history.
- Easier debugging of oversell/return/adjustment issues.
- Safer checkout and fulfillment transitions.
- Better foundation for reporting and reconciliation.

Tradeoffs:

- More code per stock mutation.
- Tests must assert ledger behavior, not only final stock numbers.

## Agent Guidance

- Never update inventory counters silently.
- Checkout must reserve inventory in a transaction.
- Cancellation/release/sold flows must create ledger rows.
