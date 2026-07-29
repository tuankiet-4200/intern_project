# Project Context

Last updated: 2026-07-29

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

Phase 2 implementation:

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
- Installed workspace dependencies and committed the lockfile.
- Generated Prisma Client and created/applied the initial migration.
- Added idempotent demo seed data for admin/vendor/customer, an approved shop, categories, products, and inventory.
- Enforced positive available inventory for public product list/detail.
- Added vendor ownership enforcement for inventory ledger reads.
- Added compare-and-swap retries for concurrent inventory adjustment/reservation.
- Added customer-to-vendor promotion when a shop is approved.
- Added ESLint flat config compatible with TypeScript and Next.js 16.
- Upgraded Next.js from 16.1.7 to 16.2.12 after production dependency audit.
- Added unit/service tests and a real PostgreSQL concurrent reservation integration test.
- Added vendor product update, explicit status change, and terminal archive APIs with ownership enforcement.
- Added admin category update/status APIs with arbitrary-depth public tree construction, cycle prevention, and dependency-safe deactivation.
- Added authenticated user profile and address CRUD APIs.
- Added default-address replacement behavior and address ownership enforcement.
- Connected frontend login, public catalog, vendor product, admin shop review, admin category, and profile/address pages to live APIs.
- Added loading, empty, and actionable error states to connected frontend workflows.
- Added PostgreSQL integration tests for product ownership/archive, category hierarchy, and default-address behavior.
- Fixed production build output so `npm run start` always executes the current compiled routes rather than a stale `dist/main`.
- Added `RefreshSession` persistence and migration `20260729051045_add_refresh_sessions`.
- Added opaque refresh-token rotation with SHA-256 hashes, HttpOnly/SameSite cookies, reuse rejection, logout, and logout-all.
- Reduced access-token default lifetime to 15 minutes.
- Restricted public registration to customer accounts; vendor role now comes from approved shop onboarding.
- Added auth/JWT/RBAC e2e coverage using the real Nest application and PostgreSQL.
- Added frontend automatic access-token refresh and one-time protected request retry.
- Added connected registration and shop onboarding pages.
- Added editable profile and product fields.

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
- `npm install` completed and `package-lock.json` exists.
- PostgreSQL, Redis, and RabbitMQ containers start locally.
- Prisma generate completed.
- Migration `20260728074437_init` was created and applied.
- Demo seed completed successfully.
- API production build passed.
- Web production build passed.
- Root lint passed for API and web.
- PostgreSQL concurrency test confirmed two competing reservations cannot oversell.
- API runtime smoke tests passed for `/api/health`, `/api/products`, and demo vendor login.
- Expanded API test suite passed: 8 suites, 15 tests.
- API/web lint and production builds passed after Phase 2 CRUD/UI integration.
- Protected runtime smoke tests passed for admin categories, vendor shops/products, and customer profile/addresses.
- Migration `20260729051045_add_refresh_sessions` was created and applied.
- Unit/integration tests passed: 8 suites, 16 tests.
- Auth/JWT/RBAC e2e tests passed: 1 suite, 2 tests.
- Production auth smoke test passed for HttpOnly cookie issuance, rotation, reuse rejection, protected access, logout, and revocation.
- Web production build passed with 14 routes.

## Current Risks / Gaps

- Inventory reservation API exists but checkout orchestration is not implemented yet.
- Cart/order/payment modules are still mostly placeholders.
- Refresh-session cleanup for expired/revoked rows should be added as a maintenance job before production.
- Access tokens remain in local storage; refresh tokens are HttpOnly. Consider in-memory access tokens plus CSP hardening in Phase 4.
- `npm audit --omit=dev` still reports high advisories through transitive Next.js/PostCSS/Sharp dependencies; npm does not currently offer a non-breaking automatic remediation for the installed release line.

## Next Recommended Step

Phase 2 is complete. Move to Phase 3:

1. Cart API.
2. Checkout transaction.
3. Order splitting by shop.
4. Inventory reserve/release/sold flow.
5. Payment abstraction.
