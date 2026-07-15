# Project Context

Last updated: 2026-07-15

## Project Identity

This is a build-from-scratch multi-vendor commerce platform.

Important: do not treat this project as a rebuild or copy of ProjectIII. ProjectIII can be considered only as prior context if the user explicitly asks for comparison, but implementation decisions for this project should stand on their own.

## Target Role For Agents

Agents working on this project must act as a Senior Tech Lead and Technical Project Manager with strong experience in high-concurrency, distributed systems, decoupled architecture, clean code, scalability, testability, and production-oriented engineering.

## Current Architecture Direction

- Monorepo.
- Backend: NestJS modular monolith.
- Frontend: Next.js App Router.
- Database: PostgreSQL via Prisma.
- Cache/infra: Redis.
- Async foundation: RabbitMQ, planned for order/payment events.
- Shared package for common constants/types.

The architecture should remain modular-monolith first, with bounded contexts designed so they can be extracted later if needed.

## Current Scope

Included in the first 2-month plan:

- Customer web commerce flow.
- Vendor shop/product/inventory/order operations.
- Admin moderation and operational control.
- Auth/RBAC.
- Catalog.
- Inventory.
- Cart.
- Checkout.
- Order.
- Payment.
- Coupon.
- Review.

Explicitly out of scope for now:

- Shipper app.
- AI chatbot.
- Product recommendation engine.

## Completed So Far

Phase 1 foundation:

- Created monorepo structure: `apps/api`, `apps/web`, `packages/shared`, `docs`.
- Added Docker local infrastructure: PostgreSQL, Redis, RabbitMQ.
- Added Prisma schema v1 for users, shops, categories, products, inventory, cart, orders, payments, coupons, reviews.
- Added backend NestJS app shell and health endpoint.
- Added frontend Next.js operational shell and placeholder pages.
- Added roadmap, business rules, and run guide.

Phase 2 partial implementation:

- Added Prisma module/service.
- Added auth register/login with JWT.
- Added RBAC foundation: JWT guard, roles decorator, roles guard, current user decorator.
- Added shop onboarding APIs.
- Added admin shop review APIs.
- Added category APIs.
- Added public product listing.
- Added vendor product creation.
- Added inventory view/adjust/reserve APIs.
- Added frontend placeholder pages for login, vendor products, and admin shop review queue.

Governance/context:

- Added `.agents/senior-tech-lead.rules.md`.
- Added `.agents/task-template.md`.
- Added `docs/project_context.md`.
- Added `docs/execution_plan.md`.
- Added `docs/coding-standards.md`.
- Added `docs/definition-of-done.md`.
- Added `docs/testing-strategy.md`.
- Added initial ADRs:
  - `docs/adr/0001-modular-monolith-first.md`
  - `docs/adr/0002-inventory-ledger.md`
  - `docs/adr/0003-payment-separate-from-fulfillment.md`
- Clarified the project is build-from-scratch, not a rebuild of ProjectIII.
- Updated agent rules so completed functionality should include tests and relevant test execution by default.

## Current Verification Status

Verified:

- `docker compose config` is valid.
- npm workspace metadata is readable.

Not yet verified:

- `npm install`
- Prisma generate/migrate
- Backend runtime
- Frontend runtime
- TypeScript build
- Automated tests

Latest documentation verification:

- Documentation files were created/updated only.
- No code runtime/build/test command was run for this documentation-only change.

Dependencies have not been installed yet.

## Current Risks / Gaps

- No generated Prisma client yet.
- No migrations created yet.
- No seed data.
- Frontend is not connected to API yet.
- Auth has access token only; refresh-token flow is not implemented yet.
- Product update/delete APIs are not implemented yet.
- Admin category management is minimal.
- Inventory reservation API exists but checkout orchestration is not implemented yet.
- Cart/order/payment modules are still mostly placeholders.
- Test coverage is not implemented yet.
- The testing rule is now documented, but existing feature code still needs actual tests once dependencies are installed.

## Next Recommended Step

Continue Phase 2 by completing:

1. Product update/delete and vendor ownership checks.
2. Category admin update/deactivate.
3. User profile/address APIs.
4. Seed data for admin/vendor/customer/category.
5. Install dependencies, run Prisma generate/migrate, and fix compile/runtime issues.

After that, move to Phase 3:

1. Cart API.
2. Checkout transaction.
3. Order splitting by shop.
4. Inventory reserve/release/sold flow.
5. Payment abstraction.
