# Execution Plan

Last updated: 2026-08-19

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

Status: complete for the provider-neutral core and the selected SePay payment-initiation/settlement adapter. Provider refund automation and real staging credentials remain external follow-up.

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
- Added public `/products/[slug]` detail with gallery/fallback, live inventory, quantity/cart action, approved-shop context, reviews and related products; catalog cards now deep-link to it.
- Added unit coverage for product availability, quantity bounds, valid compare-at discount and safe scalar attributes.
- Fixed collapsed catalog image cards after the detail-link conversion by preserving a block-level aspect-ratio container.
- Expanded Vendor product authoring and API validation for description, compare-at price, up to eight image URLs and scalar attributes, while keeping post-create stock changes in Inventory Ledger flows.

Remaining external integration:

1. Configure real SePay sandbox/production merchant credentials, a public HTTPS IPN URL and staging return URL, then run an end-to-end money-flow certification.
2. Define a reviewed SePay bank-transfer refund/outbound-transfer process before enabling automated refunds for `SEPAY` payments.
3. Configure staging GitHub Environment secrets/URLs and a hosting rollout webhook, then execute the supplied workflow against the selected infrastructure.

## Phase 6 - Shop Live Chat & Catalog-Grounded AI

Status: complete for the application-level single-region baseline. Production multi-replica event fan-out and durable AI jobs remain operational hardening items.

Done:

- Added one persistent conversation per customer/shop and append-only customer/shop/AI messages.
- Added participant and shop-owner authorization for inbox, history, send, read state and AI settings.
- Added client-generated message IDs with a database unique constraint so REST retries do not duplicate messages.
- Added Socket.IO room delivery with JWT handshake validation and a five-second REST polling fallback.
- Added Customer and Vendor messenger pages plus the bottom-right compact chat modal.
- Added product-detail entry points that open a conversation for the exact selling shop.
- Added a per-shop, default-off AI toggle visible only to that shop's owner.
- Integrated DeepSeek through a backend-only OpenAI-compatible request; configurable endpoint/model/key/timeout.
- Grounded the AI system prompt using only that shop's approved active catalog, current available inventory and recent conversation history.
- Preserved the customer message when DeepSeek is unavailable and exposed pending/completed/failed generation state.
- Made the shared Customer/Vendor composer IME-safe so Enter used to finish Vietnamese text cannot send early or restore the final composed word after the draft is cleared.
- Added migration `20260817111452_phase6_shop_chat_ai`, idempotent demo chat seed, unit/integration coverage and fresher documentation.

Acceptance:

- A non-participant cannot read, join or send to a conversation.
- A vendor cannot read another vendor's inbox or change another shop's AI setting.
- Retrying the same `clientMessageId` creates one message.
- Realtime delivery and REST polling converge without duplicate rendering.
- AI is off by default and cannot be enabled without a backend DeepSeek key.
- AI receives no product catalog outside the target shop and may not invent missing commercial facts.
- DeepSeek failure never rolls back or deletes the customer's message.
- A successful send clears the complete draft; plain Enter sends, Shift+Enter inserts a line break and IME-composition Enter never submits.

## Phase 7 - Admin User & Shop Governance

Status: complete.

Done:

- Added paginated Admin user search/filter/detail APIs without exposing password hashes or refresh tokens.
- Added audited account lock/unlock; self-lock and locking the last active Admin are rejected.
- Account lock atomically revokes refresh sessions and suspends every approved shop owned by that account.
- Hardened JWT validation to reload current role/status so a banned account loses API access immediately even with an unexpired access token.
- Added paginated Admin shop search/filter/detail APIs and explicit review/suspend/restore transitions.
- Added durable `AdminAuditLog` rows for every user/shop status mutation.
- Replaced the pending-only Admin shop page and added a dedicated Admin user page with filters, detail panels, confirmation dialogs and Vietnamese operational states.
- Added Admin navigation/dashboard entries plus unit, PostgreSQL integration and regression coverage.

Acceptance:

- Non-Admin requests cannot access any `/admin/users` or `/admin/shops` endpoint.
- Sensitive list/detail responses expose only approved safe fields.
- Ban/reject/suspend requires an operational reason and creates an audit record.
- Banned accounts cannot continue using an existing access JWT; their refresh sessions are revoked.
- Re-enabling an account does not silently restore its shops.
- Invalid shop status transitions and approval of a banned owner are rejected.

## Phase 8 - Customer Wishlist & Catalog Stock UX

Status: complete.

Done:

- Added persistent `WishlistItem` ownership with a unique user/product constraint and indexed list paths.
- Added authenticated, paginated Wishlist APIs plus a compact product-ID endpoint for storefront heart state.
- Made add/remove idempotent, restricted new saves to public products and retained previously saved products when they become unavailable.
- Added independent heart actions and explicit `Kho: n` information to Marketplace product cards.
- Added a role-aware `/wishlist` page with unavailable state, removal, pagination and add-to-cart synchronization.
- Added an immediate desktop/mobile Wishlist badge synchronized on session restore, Home heart actions and Wishlist removal.
- Added atomic Vendor product + on-hand stock editing with a mandatory `MANUAL_ADJUSTMENT` ledger row and reserved-stock protection.
- Added migration `20260818090000_phase8_customer_wishlist`, PostgreSQL integration tests and Web state/navigation tests.

Acceptance:

- Wishlist data survives reload/login and is isolated by account.
- Repeated add/remove requests do not create duplicates or errors.
- Home heart controls do not navigate to product detail and reflect the current account's saved IDs.
- Stock on each Home card is derived from `onHand - reserved` and never shown as a negative number.
- Unavailable saved products remain visible but cannot be added to cart.
- Wishlist badge reports unique saved products and changes without a page reload.
- Editing on-hand stock cannot reduce it below reserved inventory or bypass Inventory Ledger.

## Phase 9 - Selective Cart & Dedicated Checkout

Status: complete.

Done:

- Added validated optional `cartItemIds` to Checkout quote/commit for backward-compatible selective checkout.
- Scoped pricing, coupon eligibility, per-shop shipping, order snapshots, reservations and cart cleanup to the exact owned selection.
- Included normalized selected IDs in the checkout idempotency fingerprint.
- Rebuilt `/cart` around valid item selection, select-all, quantity management and a single Checkout action.
- Moved address/map, payment method, coupon details, quote and order submission to protected `/checkout`.
- Linked product names/images in Cart and product names in customer Orders to public Product Detail.
- Added PostgreSQL partial-cart coverage and Web selection/navigation helper coverage.

Acceptance:

- A user cannot quote or commit another account's CartItem ID.
- A partial checkout creates an order for only selected items and leaves all unselected CartItems unchanged.
- Coupon and shipping totals are calculated only from selected shops/items.
- Idempotency treats a changed item selection as a different checkout request.
- Cart contains no address/payment/coupon form; Checkout owns those steps.
- Cart, Checkout and Orders product names navigate through the canonical product-detail path.

## Phase 10 - SePay Electronic Payment Provider

Status: application implementation complete; real merchant certification remains external.

Done:

- Added `SEPAY` as a distinct PaymentMethod and migration `20260818213000_add_sepay_payment_method`.
- Added the official `sepay-pg-node` adapter for signed one-time hosted checkout fields in sandbox or production.
- Used the internal Payment UUID as `order_invoice_number`, exact whole-number VND amount and owner-scoped checkout/retry endpoints.
- Added public SePay IPN handling authenticated by constant-time `X-Secret-Key` comparison.
- Required `ORDER_PAID`, `CAPTURED`, `APPROVED`, VND and exact Decimal amount before settlement.
- Routed IPN and direct API reconciliation through the existing PaymentWebhookEvent/history/state-machine transaction instead of updating ParentOrder directly.
- Added a dedicated return page that reconciles server-to-server and never trusts browser query parameters as proof of payment.
- Made bank-transfer IPN accept SePay's documented nullable customer and made return reconciliation tolerate delayed transaction details with bounded polling/manual retry.
- Added retry payment on customer Orders and CSP/form-action allowlisting for only the official SePay hosted origins.
- Explicitly rejected unsupported SePay automated refunds so no refund remains permanently pending without a provider completion path.
- Added SDK/unit, Web URL/form/CSP and PostgreSQL IPN replay/amount/security coverage.

Acceptance:

- Missing SePay credentials fail before checkout commits an order.
- Another user cannot create or reconcile a SePay checkout for an order they do not own.
- IPN with wrong secret, wrong state, currency or amount cannot mutate payment state.
- Exact IPN replay returns idempotently and cannot create a second webhook audit row.
- Browser success callback alone cannot mark a payment paid.
- A captured order whose transaction detail has not propagated remains UNPAID/pending and can be reconciled again without surfacing a schema error.
- An unpaid SePay order can reopen hosted checkout from Orders.

## Phase 11 - Interaction-Based Product Recommendations

Status: complete for the in-application heuristic baseline. Large-catalog retrieval, experimentation and ML ranking remain optional scale work.

Done:

- Studied ProjectIII's view/cart/purchase weighted recommendation flow and retained its explainable heuristic direction.
- Added aggregated `UserInteraction` signals for VIEW, WISHLIST, ADD_TO_CART and PURCHASE with one bounded row per user/product/type.
- Recorded cart, wishlist and checkout signals in the owning business transaction; product-detail view tracking is non-blocking.
- Added 30-day half-life recency decay, bounded repeat-event influence, category/shop affinity, sold-stock popularity and freshness scoring.
- Added public trending cold-start and authenticated personalized APIs with search/limit validation.
- Enforced the same ACTIVE product, APPROVED shop and positive available-stock visibility rule as public Catalog.
- Added account-owned personalization reset and cascade cleanup without storing search text, IP address, user agent or guest fingerprint.
- Added the Home recommendation shelf with cold-start/personalized explanation, existing Cart/Wishlist actions and a visibility switch that does not delete preference data.
- Added post-persist frontend invalidation so successful VIEW/Cart/Wishlist signals refresh a cached/mounted Home shelf without waiting for another stronger action.
- Added deterministic category diversity: when multiple affinity categories have candidates, one category cannot occupy more than 75% of the shelf unless the catalog is too narrow.
- Added migration `20260818230000_phase9_product_recommendations`, pure ranking tests and PostgreSQL integration coverage.

Acceptance:

- Anonymous/cold-start users receive only currently public, in-stock trending products.
- Authenticated recommendations use only that account's interactions and never expose another user's signals.
- Repeated view/add requests cannot create unbounded interaction rows or unbounded score influence.
- Product/detail, Cart, Wishlist and Checkout remain successful only when their own domain transaction succeeds.
- A newly viewed category becomes visible on the next Home shelf refresh while earlier stronger-intent categories remain represented.
- Reset deletes only the current account's personalization data and falls back to trending products.
- Hiding/showing the shelf does not delete or alter the current account's personalization data.

## Phase 12 - Demo Catalog & Public Shop Storefront

Status: complete.

Done:

- Added four approved demo Vendor accounts and shops with documented credentials.
- Added a reviewed static CellphoneS snapshot containing exactly 20 phones, 20 tablets and 20 laptops.
- Distributed the snapshot deterministically across four shops: five products per category and 15 snapshot products per shop.
- Added an idempotent `seed:demo-catalog` command that upserts users, shops, categories, products and initial inventory without duplicating stock ledger entries.
- Added an explicit `ALLOW_DEMO_CATALOG_SEED=true` production guard so demo data cannot be inserted accidentally.
- Added public `GET /api/shops/public/:slug` storefront data with public-product visibility, shop-specific categories, search and pagination.
- Added `/shops/[slug]` for customers and linked shop names from Home and Product Detail.
- Added unit, service, Web routing and live PostgreSQL/API smoke coverage.
- Added `docs/demo-vendor-accounts.docx` with credentials, distribution, deployment command and manual checks.

Acceptance:

- Re-running the seed does not duplicate users, shops, categories, products, inventory or initial-stock ledger entries.
- Every demo shop receives exactly five CellphoneS snapshot products in each of the three categories.
- A suspended/unapproved shop or inactive/out-of-stock product never appears in its public storefront.
- Customer search/category filters are scoped to the selected shop and clearing search restores the full storefront.
- Demo catalog insertion in production requires an explicit operator opt-in.

## Backlog

Do not implement unless the user explicitly changes scope:

- Shipper app.
- Dedicated search engine.
- Microservice extraction.
