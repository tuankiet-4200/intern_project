# Coding Standards

Last updated: 2026-07-15

## Core Principles

- Build from scratch; do not copy ProjectIII implementation patterns blindly.
- Prefer simple, explicit code over clever abstractions.
- Keep business rules testable and close to the domain service that owns them.
- Controllers should be thin: parse input, call services, return output.
- Services own business logic, transactions, authorization checks that depend on ownership, and domain invariants.
- DTOs validate all external input.
- Avoid hidden side effects. If a method writes data, its name should make that clear.

## Backend Standards

- Use NestJS modules as bounded contexts.
- Keep each module responsible for one domain capability.
- Use Prisma transactions for workflows that update multiple aggregates.
- Never update inventory stock directly without writing an inventory ledger row.
- Never create an order without immutable item snapshots.
- Never mix payment state with fulfillment state.
- Never expose internal fields such as password hash, provider raw payloads, or security tokens.
- Use explicit status transition helpers for order/payment state changes.
- Prefer domain-specific errors/messages over generic failures where the user can act on the error.

## Prisma Standards

- Use clear relation names and indexes for common query paths.
- Add unique constraints for idempotency and natural uniqueness.
- Preserve money as `Decimal`, not floating point.
- Store snapshots for order items instead of relying on current product state.
- Add audit-style records for critical financial/inventory changes.

## Frontend Standards

- Build workflow-first screens, not marketing pages.
- Prioritize customer purchase flow, vendor operations, and admin moderation.
- Keep forms explicit, validated, and mapped to real API states.
- Show useful loading, empty, and error states.
- Do not hide business complexity behind decorative UI.
- Use compact operational layouts for admin/vendor surfaces.

## Testing Standards

- New business behavior requires tests.
- Every completed feature should include the nearest useful test type:
  - unit test for pure rules/helpers
  - service test for module logic
  - integration test for DB transaction or cross-module behavior
  - e2e test for critical user journeys
- If tests cannot be run because dependencies or environment are missing, record that clearly in `docs/project_context.md`.

## Documentation Standards

- Update `docs/project_context.md` after meaningful edits.
- Update `docs/execution_plan.md` if the phase sequence, acceptance criteria, or implementation order changes.
- Add an ADR for architecture decisions that affect more than one module or future scalability.
