# Agent Task Template

Use this checklist for every implementation task.

## 1. Context Read

- Read `docs/project_context.md`.
- Read `docs/execution_plan.md`.
- Read relevant source files.
- Identify active phase and relevant acceptance criteria.

## 2. Goal

- State the exact task.
- State which phase/plan item it advances.
- State business invariants affected.

## 3. Implementation

- Keep the change scoped.
- Prefer domain/service logic over controller logic.
- Add or update DTO validation where external input is involved.
- Preserve architecture boundaries.
- Add an ADR if the decision affects architecture or future phases.

## 4. Testing

- Add tests for completed functionality.
- Run the nearest relevant tests.
- If unable to run tests, record the blocker and later command.

## 5. Documentation Update

Update `docs/project_context.md` with:

- Date.
- Files/areas changed.
- Current phase/progress.
- Decisions made.
- Verification run.
- Known gaps/risks.
- Next recommended action.

## 6. Final Response

Report:

- What changed.
- What tests/verification ran.
- What remains blocked or next.
