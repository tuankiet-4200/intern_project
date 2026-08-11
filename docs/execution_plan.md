# Execution Plan

Last updated: 2026-08-11

This is the implementation source of truth for the build-from-scratch commerce platform. Agents must read this file together with `docs/project_context.md` before editing.

## Operating Rules

1. Read `docs/project_context.md` and this file before every implementation session.
2. Read `docs/coding-standards.md`, `docs/definition-of-done.md`, and `docs/testing-strategy.md`.
3. Read relevant source files before changing them.
4. Keep work aligned to the active phase unless the user explicitly changes priority.
5. After meaningful changes, add/update tests and run the nearest relevant test command.
6. After changes, update `docs/project_context.md`.
7. Preserve core business invariants:
   - no overselling
   - explicit status transitions
   - inventory ledger for stock changes
   - idempotent order creation
   - payment state separate from fulfillment state
   - order item price/name/image snapshots

## Phase 1 - Foundation & Domain Baseline

Status: complete.

Done:

- Monorepo structure exists.
- Docker compose exists.
- Prisma schema v1 exists.
- Backend health endpoint exists.
- Frontend shell exists.
- Roadmap/business rules/run guide exist.
- Agent rules, coding standards, definition of done, testing strategy, task template, and ADRs exist.
- Dependencies and lockfile exist.
- Prisma Client generates successfully.
- Initial migration exists and applies successfully.
- PostgreSQL, Redis, and RabbitMQ start locally.
- Backend and frontend production builds pass.
- API health endpoint was verified at runtime.

Acceptance:

- `docker compose up -d` starts infrastructure.
- API exposes `/api/health`.
- Prisma generate/migrate works.

## Phase 2 - Identity, Catalog, Shop Operations

Status: complete.

Done:

- Register/login API.
- JWT strategy.
- JWT guard.
- Roles guard.
- Shop create/list/review APIs.
- Category create/list APIs.
- Public product list/detail APIs.
- Vendor product create/list APIs.
- Inventory get/adjust/reserve APIs.
- Login, vendor products, and admin shop queue UI placeholders.
- Idempotent demo seed for admin/vendor/customer, approved shop, categories, products, and inventory.
- Product list/detail visibility enforces active product, approved shop, and positive available stock.
- Inventory ledger access enforces vendor ownership.
- Inventory adjust/reserve uses compare-and-swap retries to protect concurrent writes.
- Shop approval promotes a customer owner to vendor.
- Auth, ownership, catalog visibility, inventory ledger, and concurrent reservation tests.
- Vendor product update, status transition, and terminal archive APIs.
- Category update, activate/deactivate, arbitrary-depth tree, and cycle/dependency validation.
- User profile and address CRUD APIs with ownership and default-address handling.
- Live frontend integration for login, public catalog, vendor products, admin shop review, admin categories, and profile/addresses.
- Catalog and address integration tests against PostgreSQL.
- Production build output is pinned to `src` and stale artifacts are removed before build.
- Opaque refresh sessions store SHA-256 token hashes and rotate through HttpOnly/SameSite cookies.
- Refresh-token reuse is rejected; logout and logout-all revoke active sessions.
- Public registration cannot self-provision vendor/admin roles.
- API e2e coverage verifies refresh rotation, logout revocation, JWT authentication, and RBAC.
- Frontend automatically refreshes expired access tokens once and retries the protected request.
- Frontend registration, shop onboarding, editable profile, and editable product fields are connected.

Acceptance:

- Vendor cannot modify another vendor's shop/product.
- Product is public only when shop is `APPROVED`, product is `ACTIVE`, and available stock is positive.
- Inventory cannot become invalid.
- Every stock change writes a ledger entry.
- Admin account cannot be self-provisioned through public register.
- Vendor role cannot be self-provisioned without shop approval.
- Refresh-token rotation rejects reuse and logout revokes the active session.

## Phase 3 - Cart, Checkout, Order, Payment

Status: complete.

Done:

- Authenticated cart get/add/update/remove/clear APIs with active product, approved shop, and stock validation.
- Checkout quote recalculates current product price and validates product/shop/inventory state.
- Global/shop coupon calculation supports active dates, minimum spend, maximum discount, and usage limits.
- Serializable checkout transaction creates the parent order, shop orders, immutable order-item snapshots, payment record, coupon usage, inventory reservations/ledger rows, and clears purchased cart items.
- Checkout idempotency is unique per customer and rejects reuse with a different request fingerprint.
- Optimistic inventory reservation plus transaction retry prevents concurrent checkout overselling.
- Customer order list/detail/cancel and vendor shop-order list/status APIs.
- Explicit shop-order transitions release cancelled reservations and convert delivered reservations to sold stock with ledger entries.
- Parent fulfillment status and payment summary remain separate.
- COD and bank-transfer payment records plus explicit admin payment transitions and append-only status history.
- Customer catalog/cart/checkout/order UI and vendor order dashboard are connected to live APIs.
- Migration `20260804090000_phase3_checkout_orders` adds checkout fingerprints, per-user idempotency, and payment status history.
- Integration coverage verifies split checkout, snapshots, coupon pricing, idempotency, invalid transitions, inventory release/sale, payment audit, and concurrent no-oversell behavior.

Implementation order:

1. Cart module:
   - get cart
   - add item
   - update quantity
   - remove item
   - clear cart
2. Checkout quote:
   - validate product status
   - validate shop status
   - validate available stock
   - calculate subtotal/discount/shipping/total
3. Checkout commit transaction:
   - idempotency key
   - create parent order
   - create shop orders
   - create order item snapshots
   - reserve inventory
   - record coupon usage
   - clear purchased cart items
4. Order status transition service.
5. Payment module:
   - COD
   - bank transfer payment record; signed provider settlement is completed in Phase 5A
   - payment records
   - payment state transitions
6. Vendor order dashboard API/UI.

Acceptance:

- Concurrent checkout cannot oversell.
- Checkout retry with same idempotency key does not create duplicate order.
- Order item price/name/image are immutable snapshots.
- Invalid order/payment transitions are rejected.

## Phase 4 - Production Readiness & UX Completion

Status: complete.

Done:

- Implemented Review APIs with delivered-order eligibility, buyer ownership, one-review-per-order-item enforcement, public rating aggregates, owner updates, and PostgreSQL integration tests.
- Connected delivered-item review forms and existing review state to the customer order UI.
- Added 15-second silent polling with last-updated state to customer and vendor order dashboards.
- Expanded the idempotent demo seed with a customer default address and `WELCOME10` global coupon.
- Added global request IDs, security headers, structured errors, safe HTTP timing logs, and configurable per-IP rate limiting.
- Added liveness and PostgreSQL readiness endpoints.
- Fixed API production compilation to always emit the complete runtime tree and exclude e2e specs from `dist`.
- Added a complete HTTP e2e journey covering registration, shop approval, product activation, cart, checkout, fulfillment, and review.
- Added GitHub Actions CI with PostgreSQL migrations, lint, unit/integration tests, e2e tests, and production builds.
- Added a production runbook covering configuration, migration/deployment order, health/smoke checks, observability, backup, rollback, security, and incident response.
- Updated the codebase handbook with all Phase 4 flows, invariants, failure cases, tests, and operational limitations.

Implementation order:

1. Full happy-path UI:
   - register/login
   - create shop
   - admin approve shop
   - create product
   - customer checkout
   - vendor fulfill
   - customer review
2. Review module implementation.
3. Notification approach:
   - polling first, WebSocket only if needed
4. API hardening:
   - request id
   - structured error response
   - rate limiting
   - logging
5. Test coverage:
   - unit tests for domain rules
   - integration tests for checkout
   - e2e happy path
6. Production runbook and deployment draft.

Acceptance:

- Demo flow works without manual database editing.
- Seed data supports local demo.
- Core domain tests pass.
- Runbook is clear enough for a new developer/agent.

## Phase 5 - Post-Roadmap Reliability & Operations

Status: complete for the agreed provider-neutral scope. The only excluded product integration is the selected payment provider adapter/reconciliation.

Phase 5A financial reliability completed:

- Added `PARTIALLY_REFUNDED` payment summary and explicit Refund/RefundStatusHistory records.
- Added PaymentWebhookEvent audit with unique provider event identity and payload hash.
- Added reviewed migration `20260804150000_phase5_financial_reliability`.
- Added HMAC-SHA256 bank-transfer webhook over exact raw request bytes.
- Added timestamp tolerance, constant-time signature comparison, replay detection and same-event/different-payload rejection.
- Added payment amount matching and provider-reference uniqueness before settlement.
- Added idempotent admin refund creation with remaining-refundable validation.
- Added Serializable transaction, compare-and-swap and retry protection for competing refunds.
- Added partial/full/failed refund state aggregation without rewriting payment history.
- Added PostgreSQL integration and HTTP e2e coverage for signature, replay, audit and concurrent refunds.

Phase 5A acceptance:

- Unsigned, stale or tampered webhook cannot mutate payment data.
- Exact provider event retry is idempotent.
- A provider transaction reference cannot settle two payments/refunds in the same namespace.
- Concurrent refund requests cannot make successful refunds exceed paid amount.
- Partial and full refund outcomes remain auditable through append-only histories.

Phase 5B coupon operations completed:

- Added admin coupon list/create/update/status APIs and `/admin/coupons` workflow UI.
- Added GLOBAL/SHOP, percentage/fixed, date, min/cap and positive-limit validation.
- Added per-customer campaign limit and indexed CouponUsage lookup.
- Enforced per-customer limit in both quote and Serializable checkout commit.
- Locked code/scope/shop/type/value after first usage and prevented limits below historical usage.
- Added database check constraints and PostgreSQL integration coverage including competing checkout.

Phase 5C distributed request protection completed:

- Replaced process-local production quota with a Redis-backed fixed-window limiter shared by all API replicas.
- Added an atomic Lua `INCR`/`PEXPIRE` operation, hashed client-IP keys and configurable key namespaces.
- Added explicit fail-open/fail-closed behavior, structured 503/429 responses and policy response headers.
- Added Redis-aware readiness: fail-closed outages reject readiness while fail-open outages report degraded readiness.
- Added Redis health checks locally and a Redis service in CI.
- Added unit, real-Redis multi-instance and 100-request concurrent load coverage.

Phase 5D session lifecycle and browser hardening completed:

- Added periodic, retention-aware RefreshSession cleanup with bounded batches.
- Added a PostgreSQL transaction advisory lock and `SKIP LOCKED` candidate selection so multiple API replicas cannot clean concurrently.
- Preserved recent expired/revoked rows for investigation while deleting terminal sessions older than the configured retention.
- Moved Web access tokens from localStorage to module memory and remove the legacy persisted token key.
- Added automatic HttpOnly-cookie refresh when a protected request starts without an in-memory token after page reload.
- Added shared refresh deduplication for concurrent protected requests.
- Added a session-version guard so a late refresh response cannot resurrect a cleared/replaced session.
- Added restrictive Web CSP and complementary browser security headers while preserving Turbopack static generation.
- Added PostgreSQL cleanup integration coverage and Web unit coverage for memory sessions, reload recovery, concurrent refresh and CSP construction.

Phase 5E product and operational completion:

- Added persisted Notification/OutboxEvent models and migration with indexed pending/read paths.
- Added transactional notification enqueue to shop review, checkout, order, payment and refund transactions.
- Added a multi-replica-safe `FOR UPDATE SKIP LOCKED` outbox worker with unique delivery idempotency and malformed-event quarantine.
- Added authenticated inbox list/unread/read-one/read-all APIs and `/notifications` UI.
- Added admin payment listing and complete `/admin/refunds` workflow.
- Added explicit COD offline-refund confirmation with atomic partial/full refund histories and customer order visibility.
- Added vendor-owned coupon APIs/UI and customer coupon discovery/application in cart.
- Added integration/e2e coverage for vendor ownership, coupon discovery, COD refunds and notification delivery/read state.
- Added non-root API/Web Docker images, API smoke/load scripts and guarded backup/restore drill.
- Added scheduled operational-drill workflow and provider-neutral staging build/push/migrate/rollout/smoke workflow.
- Upgraded Next.js to 16.3.0; production dependency audit now reports zero vulnerabilities.

Phase 5F role-aware frontend experience completed:

- Replaced the shared mixed-role header with separated Customer storefront, Vendor workspace and Admin workspace shells.
- Added role-derived navigation and frontend route gates without weakening backend JWT/RBAC/ownership enforcement.
- Rebuilt the catalog around product search, category filtering, responsive product cards and actionable loading/error/empty states.
- Reworked login/register to explain and redirect each role correctly; new customers now return to the storefront and opt into shop onboarding explicitly.
- Added dedicated Vendor/Admin overview dashboards, shared visual tokens and responsive desktop/mobile navigation.
- Added Web unit coverage for navigation visibility, customer onboarding access and cross-workspace denial.

Remaining external integration:

1. Provider-specific bank-transfer adapter and reconciliation job.
2. Configure staging GitHub Environment secrets/URLs and a hosting rollout webhook, then execute the supplied workflow against the selected infrastructure.

## Backlog

Do not implement unless the user explicitly changes scope:

- Shipper app.
- AI chatbot.
- Product recommendation engine.
- Dedicated search engine.
- Microservice extraction.
