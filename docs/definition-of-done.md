# Definition Of Done

Last updated: 2026-07-15

A task is not done until all applicable items below are satisfied.

## Required For Every Meaningful Change

- The agent read `docs/project_context.md` and `docs/execution_plan.md` before editing.
- The change follows the active phase unless the user explicitly changed priority.
- Relevant source files were read before modification.
- Implementation is scoped to the requested feature or plan step.
- `docs/project_context.md` is updated after the change.
- The final response states what was changed and what verification was run.

## Required For Backend Features

- DTO validation exists for external input.
- Authorization and ownership checks are explicit.
- Business logic lives in services/domain helpers, not controllers.
- Critical writes use transactions where consistency requires it.
- Domain invariants are preserved:
  - no overselling
  - inventory ledger for stock changes
  - idempotent order creation
  - explicit status transitions
  - payment state separated from fulfillment state
- Sensitive fields are not returned.

## Required For Frontend Features

- UI maps to real workflow states.
- Loading, empty, and error states are considered.
- Text fits on mobile and desktop.
- Components remain operational and clean, especially vendor/admin surfaces.
- API integration errors are visible and actionable.

## Required For Tests

- New completed functionality includes tests by default.
- Relevant tests are run after implementation.
- If tests cannot be written yet, the agent must explain why and add a follow-up in `docs/project_context.md`.
- If tests cannot be run, the agent must record the blocker and exact command that should be run later.

## Required Before Calling A Phase Complete

- Acceptance criteria in `docs/execution_plan.md` are satisfied.
- Core happy path is demonstrable.
- Known gaps are documented.
- Tests for high-risk domain behavior exist and pass.
