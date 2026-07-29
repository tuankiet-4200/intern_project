# Execution Plan

Last updated: 2026-07-29

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

Status: nearing completion.

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

Next implementation order:

1. Add refresh-token rotation and logout/revocation behavior.
2. Add API e2e coverage for JWT and role-protected routes.
3. Add frontend registration and shop onboarding forms.
4. Add editable profile and product detail fields in the frontend.
5. Close remaining Phase 2 security/dependency audit gaps where a non-breaking upstream fix is available.

Acceptance:

- Vendor cannot modify another vendor's shop/product.
- Product is public only when shop is `APPROVED`, product is `ACTIVE`, and available stock is positive.
- Inventory cannot become invalid.
- Every stock change writes a ledger entry.
- Admin account cannot be self-provisioned through public register.

## Phase 3 - Cart, Checkout, Order, Payment

Status: not started.

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
   - bank transfer placeholder
   - payment records
   - payment state transitions
6. Vendor order dashboard API/UI.

Acceptance:

- Concurrent checkout cannot oversell.
- Checkout retry with same idempotency key does not create duplicate order.
- Order item price/name/image are immutable snapshots.
- Invalid order/payment transitions are rejected.

## Phase 4 - Production Readiness & UX Completion

Status: not started.

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

## Backlog

Do not implement unless the user explicitly changes scope:

- Shipper app.
- AI chatbot.
- Product recommendation engine.
- Dedicated search engine.
- Microservice extraction.
