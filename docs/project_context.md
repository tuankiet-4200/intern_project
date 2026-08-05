# Project Context

Last updated: 2026-08-05

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

Phase 3 implementation:

- Added authenticated cart APIs for get, add, quantity update, remove, and clear.
- Added live customer cart UI and catalog add-to-cart action with stock/error states.
- Added checkout quote with current product/shop/inventory validation and per-shop shipping totals.
- Added global/shop coupon validation and pricing for active dates, minimum spend, maximum discount, and usage limit.
- Added a serializable checkout commit transaction that creates a parent order, splits shop orders, snapshots product name/image/price, reserves inventory, writes ledger entries, records coupon usage/payment, and clears purchased cart items.
- Added per-customer checkout idempotency and request fingerprint conflict detection.
- Added transaction retry and optimistic reservation checks so concurrent checkout cannot oversell.
- Added customer order list/detail/cancel APIs and connected order history UI.
- Added vendor shop-order list and explicit fulfillment transition APIs plus a connected vendor order dashboard.
- Added cancellation inventory release and delivery inventory sale ledger flows.
- Added COD and bank-transfer payment records, explicit admin payment transitions, and append-only payment status history.
- Added migration `20260804090000_phase3_checkout_orders` for checkout fingerprints, per-user idempotency, and payment audit history.
- Added Phase 3 PostgreSQL integration tests covering split checkout, snapshot values, coupons, idempotency, state transitions, payment audit, inventory release/sale, and concurrent checkout.

Phase 4 implementation:

- Implemented Review DTO/controller/service APIs for buyer-owned delivered OrderItems, one review per order item, public product review pagination/average, own-review listing, and owner updates.
- Added PostgreSQL Review integration coverage for buyer ownership, delivered eligibility, duplicates, public aggregate, and update ownership.
- Connected review submission and existing review state to delivered items on the customer order page.
- Added silent 15-second polling and last-updated indicators to customer and vendor order pages.
- Expanded the idempotent demo seed with a default customer address and global `WELCOME10` coupon; verified repeated seed execution.
- Added request-context middleware with request IDs and baseline security headers.
- Added configurable fixed-window per-IP rate limiting with structured 429 responses and response headers.
- Added a global structured exception filter and safe HTTP request timing logs with request correlation.
- Added PostgreSQL readiness at `/api/health/ready` while keeping `/api/health` as lightweight liveness.
- Disabled incremental API production emission and excluded e2e specs so `nest build` always recreates the complete runtime tree after clearing `dist`.
- Added full commerce HTTP e2e coverage from shop onboarding through checkout, fulfillment, and customer review, including hardened response assertions.
- Added `.github/workflows/ci.yml` with PostgreSQL migration, lint, unit/integration tests, e2e tests, and API/Web production builds.
- Added `docs/production-runbook.md` for environment, release, migration, smoke checks, observability, backup, rollback, security, and incident response.
- Updated `docs/codebase-handbook.md` so every Phase 4 flow and operational limitation is explained for fresher developers.

Phase 5A financial reliability:

- Added `PARTIALLY_REFUNDED`, Refund, RefundStatusHistory and PaymentWebhookEvent Prisma domain records.
- Added migration `20260804150000_phase5_financial_reliability` with provider/event/idempotency uniqueness.
- Enabled Nest raw-body capture for cryptographic webhook verification.
- Added provider-neutral bank-transfer webhook DTO/controller/service using HMAC-SHA256, timestamp tolerance and constant-time comparison.
- Added exact event replay behavior and same-event/different-payload conflict protection without storing raw provider payload.
- Added bank-transfer payment success/failure processing with exact Decimal amount matching and append-only payment history.
- Added admin partial/full refund requests with per-payment idempotency, remaining refundable calculation and one-pending-refund constraint.
- Added refund provider success/failure callbacks, `PARTIALLY_REFUNDED`/`REFUNDED` aggregation and ParentOrder payment summary synchronization.
- Added Serializable retry/compare-and-swap protection so concurrent refund requests cannot over-refund.
- Added PostgreSQL payment/refund integration test and raw HTTP webhook e2e security coverage.
- Updated business rules, execution plan, handbook, runbook and ADR for the implemented financial flow.

Phase 5B coupon operations:

- Added Coupons module with admin list/create/update/activate/deactivate endpoints.
- Added campaign validation for GLOBAL/SHOP scope, percentage/fixed value, shop, schedule, min/cap and limits.
- Added `Coupon.perUserLimit`, `updatedAt`, indexed `(couponId,userId)` usage lookup and database check constraints.
- Added per-customer usage validation in quote and Serializable checkout commit.
- Locked economic campaign terms after first usage and prevented limits from contradicting historical usage.
- Added operational `/admin/coupons` create/edit/status UI and linked it from the admin dashboard.
- Added PostgreSQL integration coverage for campaign rules, two customers, account exhaustion and competing checkout.

Phase 5C distributed request protection:

- Replaced the production process-local counter with a Redis-backed fixed-window quota shared across API replicas.
- Added an atomic Lua counter/expiry operation and SHA-256 client-IP keys under a configurable namespace.
- Kept an explicit memory store for local/unit use and added configurable fail-open/fail-closed Redis outage policy.
- Added structured limiter policy headers, 429 quota responses and fail-closed 503 responses.
- Extended readiness with limiter store state: fail-closed Redis failure is not ready; fail-open failure is ready but degraded.
- Added Redis health checks to Docker Compose and Redis-backed verification to CI.
- Added unit tests, readiness policy tests, real-Redis cross-instance tests and a four-instance/100-request concurrency test.

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
- Updated agent rules so completed repository changes are scoped, committed with a conventional message, and pushed to the current `origin` branch after verification; force-push and unrelated-file staging are prohibited.
- Added `docs/codebase-handbook.md`, a detailed fresher-oriented explanation of the current architecture, environment, local startup, data model, request lifecycle, every implemented business flow, frontend integration, concurrency/invariants, tests, and debugging workflow; linked it from the run guide and documented checkout shipping configuration.
- Updated agent rules, task template, coding standards, and Definition of Done so every completed feature or behavior change must update the relevant handbook sections in the same task.

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
- Migration `20260804090000_phase3_checkout_orders` was created and applied successfully.
- Phase 3 integration tests passed, including two concurrent checkouts competing for insufficient stock.
- Full API suite passed: 9 suites, 18 tests.
- API and web lint passed after Phase 3 implementation.
- API production build passed.
- Web production build passed with 15 routes, including customer cart/orders and vendor orders.
- Review PostgreSQL integration test passed.
- Demo seed ran successfully twice, confirming idempotent Phase 4 address/coupon support.
- Full API unit/integration suite passed: 11 suites, 20 tests.
- Auth and complete commerce e2e passed: 2 suites, 3 tests.
- Root API/Web lint passed after Phase 4.
- API and Web production builds passed after Phase 4.
- Production API runtime smoke passed for liveness, PostgreSQL readiness, request/security headers, structured 404, complete artifact startup, and correlated 404 logging.
- Migration `20260804150000_phase5_financial_reliability` applied successfully and Prisma Client regenerated.
- Phase 5 payment/refund PostgreSQL integration test passed, including signature, replay, partial/full and concurrent refund cases.
- Full e2e suite passed after adding webhook HTTP security coverage: 3 suites, 4 tests.
- Full API unit/integration regression suite passed after Phase 5A: 12 suites, 21 tests.
- Root API/Web lint passed after Phase 5A.
- API production build passed; Web production build passed with 15 static routes after rerunning outside the process-binding sandbox restriction.
- Migration `20260805090000_phase5_coupon_campaigns` applied; database is at 5 migrations.
- Full API unit/integration suite passed after Phase 5B: 13 suites, 22 tests.
- Full E2E regression suite remained green: 3 suites, 4 tests.
- Root lint and API production build passed after Phase 5B.
- Web production build passed with 16 static routes including `/admin/coupons`.
- Full API unit/integration suite passed after Phase 5C: 15 suites, 29 tests, including real Redis shared-quota and four-instance concurrent-load coverage.
- Full E2E regression suite passed after Phase 5C: 3 suites, 4 tests.
- Root API/Web lint, API production build and Web production build with 16 static routes passed after Phase 5C.
- Production API runtime smoke returned Redis readiness `up` and `X-RateLimit-Policy: enforced` with shared quota headers on a public request.
- `docker compose config` remained valid and the local Redis container reported healthy.

## Current Risks / Gaps

- Bank transfer has a signed provider-neutral webhook, but a provider-specific payload adapter/API reconciliation job is still pending.
- Refund API/state/audit are implemented for bank transfer, but admin/customer refund UI and COD refund policy are still pending.
- Coupon administration and per-user limits are implemented; vendor self-service campaigns and customer coupon discovery remain pending.
- Redis is now a critical API dependency when `RATE_LIMIT_FAILURE_MODE=closed`; production needs managed Redis high availability, capacity monitoring and an intentional outage policy.
- CI is implemented, but provider-specific CD and a real staging deployment/restore drill are still pending.
- Polling provides order updates, but there is no persisted notification inbox or event delivery yet.
- Refresh-session cleanup for expired/revoked rows should be added as a maintenance job before production.
- Access tokens remain in local storage; refresh tokens are HttpOnly. Consider in-memory access tokens plus CSP hardening in Phase 4.
- `npm audit --omit=dev` still reports high advisories through transitive Next.js/PostCSS/Sharp dependencies; npm does not currently offer a non-breaking automatic remediation for the installed release line.

## Next Recommended Step

The planned Phase 1-4 roadmap is complete. Recommended post-roadmap priorities:

1. Harden frontend token storage/CSP and add refresh-session cleanup.
2. Add the selected bank-transfer provider adapter/reconciliation job and refund UI.
3. Add vendor coupon self-service/customer discovery only after defining moderation rules.
4. Add persisted notifications/outbox after defining delivery semantics.
5. Deploy to staging, run backup/restore, load and rollback drills, then connect provider-specific CD.
