# ADR 0003 - Payment State Separate From Fulfillment State

Date: 2026-07-15

## Status

Accepted

## Context

Payment and fulfillment progress independently. An order can be unpaid but preparing for COD, paid but not delivered, delivered but pending COD collection, or refunded after completion. Combining these states causes ambiguous logic and brittle transitions.

## Decision

Keep payment state separate from order/fulfillment state.

Payment state lives on payment records and parent order payment summary.
Fulfillment state lives on shop orders.

Payment records should preserve provider references, amount, status, timestamps, and raw payload where appropriate. Refunds should be modeled as explicit records/transitions rather than silently mutating history.

## Consequences

Benefits:

- Clearer business workflows.
- Easier support for COD and bank transfer.
- Safer reconciliation with external payment providers.
- Better auditability.

Tradeoffs:

- UI and APIs must combine two dimensions of status.
- More explicit transition handling is required.

## Agent Guidance

- Do not infer fulfillment from payment status.
- Do not infer payment from fulfillment status except through explicit business rules such as COD collection.
- Validate provider payment amount before marking paid.
