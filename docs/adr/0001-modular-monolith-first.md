# ADR 0001 - Modular Monolith First

Date: 2026-07-15

## Status

Accepted

## Context

The project is a build-from-scratch multi-vendor commerce platform. It has several domains that may later need independent scaling: auth, catalog, inventory, cart, checkout, order, payment, coupon, review, vendor operations, and admin moderation.

Starting with full microservices would add operational cost, distributed transaction complexity, deployment overhead, and debugging friction before the business flows are stable.

## Decision

Start as a NestJS modular monolith with clear bounded contexts.

Each module should own its service layer, DTOs, and domain rules. Cross-domain workflows should be explicit and transaction-aware. Module boundaries should be designed so high-pressure domains can later be extracted if traffic, team size, or deployment needs justify it.

## Consequences

Benefits:

- Faster iteration in early phases.
- Simpler local development and testing.
- Easier transactional consistency for checkout/order/inventory/payment.
- Lower operational complexity.

Tradeoffs:

- Requires discipline to avoid tight coupling.
- Module boundaries must be maintained intentionally.
- Extraction later still requires careful event/API design.

## Agent Guidance

- Do not introduce microservices early.
- Keep bounded contexts clean.
- Use async/event concepts only where they support future extraction or real workflow needs.
