# Project Context

Last updated: 2026-08-19

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
- ML/embedding recommendation infrastructure and experimentation platform; the explainable interaction-based heuristic baseline is implemented.

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

Phase 5D session lifecycle and browser hardening:

- Added `RefreshSessionCleanupService` with configurable enablement, interval, retention, batch size and maximum batches.
- Added bounded PostgreSQL CTE deletion with `FOR UPDATE SKIP LOCKED` and a transaction advisory lock that prevents concurrent multi-replica cleanup.
- Kept cleanup non-blocking at application bootstrap, logged structured outcomes/errors and stopped its unref'd timer on shutdown.
- Added PostgreSQL integration coverage proving only terminal sessions older than retention are deleted.
- Replaced browser localStorage access-token persistence with module-memory state and automatic removal of the legacy session key.
- Added refresh-on-missing-memory behavior so page reload recovers through the HttpOnly cookie, plus one shared refresh promise for concurrent requests.
- Added a session-version race guard so late refresh responses cannot restore state after logout/clear/account replacement.
- Added Web CSP/security headers with an allowlisted API origin and unit coverage for production policy construction.
- Added a Web Jest suite and CI Web unit-test step.

Phase 5E provider-neutral completion:

- Added durable `OutboxEvent` and `Notification` records plus migration `20260805225335_phase5_notifications_outbox`.
- Enqueued notifications inside the same transactions as shop review, checkout, fulfillment, cancellation, payment and refund state changes.
- Added an idempotent, multi-replica-safe outbox worker using `FOR UPDATE SKIP LOCKED`, unique delivery keys and failed-payload quarantine.
- Added user-scoped inbox/unread/mark-read APIs and connected `/notifications` UI.
- Added admin payment listing and `/admin/refunds`; bank transfer remains provider-pending while COD requires explicit offline confirmation and settles atomically.
- Exposed refund status safely on customer-owned order detail.
- Added vendor coupon ownership APIs/UI and authenticated customer coupon discovery/application.
- Extended commerce/coupon/payment/notification integration and e2e coverage.
- Added non-root API/Web Dockerfiles, smoke/load scripts, guarded backup/restore drill, scheduled operational drill and provider-neutral staging release workflow.
- Upgraded Next.js to 16.3.0; `npm audit --omit=dev` reports zero vulnerabilities.

Phase 5F role-aware frontend UX:

- Replaced the mixed global navigation with a Customer storefront and dedicated Vendor/Admin workspace shells.
- Added session-reactive navigation, role-based frontend route gating and cross-workspace access states; API JWT/RBAC/ownership remains the security boundary.
- Rebuilt the public catalog with Vietnamese marketplace content, search, category filters, responsive product cards and real API loading/error/empty/action feedback.
- Reworked login/register role selection and redirects; Customer registration now returns to the storefront instead of entering vendor onboarding automatically.
- Added polished responsive Vendor/Admin overview dashboards and shared visual tokens for buttons, fields, cards, focus and reduced motion.
- Added navigation unit coverage for each role, customer shop onboarding and protected-workspace isolation.
- Added public `/products/[slug]` detail with image fallback/gallery, price/discount, live available stock, bounded quantity, cart action, shop assurance, review summary/list and related products.
- Linked catalog product imagery/names to detail while keeping the quick add-to-cart action independent and accessible.
- Added resilient secondary loading so review/recommendation failure does not hide core product information, plus read-only Admin purchase UX.
- Added pure helper coverage for available stock, cart quantity bounds, compare-at discounts and safe product attributes.
- Fixed the catalog-card image collapse caused by converting the aspect-ratio container to an inline Link.
- Expanded product create/update DTOs and CatalogService for description, compare-at price, up to eight HTTP(S) image URLs and bounded scalar attributes.
- Rebuilt `/vendor/products` authoring with complete create/edit sections, image URL previews/removal, cover ordering, attribute rows and clearer stock-ledger separation.
- Extended Web image CSP for HTTPS product images and development-only HTTP previews; scripts/connections remain restricted.
- Added Catalog PostgreSQL coverage for merchandising persistence/validation and Web helper coverage for image/attribute form normalization.
- Fixed public product-detail navigation for legacy slugs containing spaces/Unicode by centralizing link encoding and normalizing Next.js route params before API requests, preventing `%20` from becoming `%2520`.
- Localized Profile/address and Cart/Checkout labels, placeholders, status text and primary actions into Vietnamese.
- Added a reusable address form with manual entry, Leaflet/OpenStreetMap selection and throttled Nominatim search/reverse lookup; map failure preserves the manual flow and coordinates are not persisted.
- Added an in-memory cart indicator synchronized from authenticated cart load and every add/update/remove/checkout action, with desktop/mobile header badges.
- Replaced checkout native selects with a styled reusable listbox and added inline address creation without leaving the cart.
- Added coupon discovery details for scope, discount constraints, active dates and remaining usage; selecting a coupon no longer applies it before explicit confirmation.
- Restricted CSP map access to the exact Nominatim origin and changed cross-origin referrer handling to satisfy provider identification without exposing path/query.

Phase 6 shop live chat and AI:

- Added persistent customer/shop conversations, message history, per-side read timestamps and unread counts.
- Added authenticated REST list/start/history/send/read endpoints with participant and current shop-owner enforcement.
- Added `clientMessageId` idempotency and one conversation per customer/shop at database level.
- Added JWT-authenticated Socket.IO `/chat` rooms, realtime message/AI status events and a five-second REST polling fallback.
- Added customer `/messages`, vendor `/vendor/messages`, role-aware navigation and a responsive bottom-right compact chat widget.
- Added product-detail actions that open chat for the exact product shop.
- Added per-shop AI on/off control, default off and blocked enablement when the backend DeepSeek key is missing.
- Added backend-only DeepSeek integration with configurable base URL/model/timeout and no provider credential in browser code.
- Grounded each AI request in only the exact shop's ACTIVE products, current available stock and recent history; instructions reject invented commercial facts and prompt/secret disclosure.
- Kept customer messages durable when AI generation fails and tracked `PENDING`, `COMPLETED` or `FAILED` on the source message.
- Added migration `20260817111452_phase6_shop_chat_ai`, demo conversation seed, prompt/unit tests and PostgreSQL ownership/idempotency integration coverage.
- Fixed the shared Customer/Vendor composer so Vietnamese IME completion Enter no longer sends prematurely or restores the last composed word after the draft reset; plain Enter and Shift+Enter retain their expected behavior.

Phase 7 admin governance:

- Added complete Admin user and shop list/search/filter/detail APIs with safe field projections and pagination.
- Added account lock/unlock safeguards, refresh-session revocation, immediate JWT account-status enforcement and automatic approved-shop suspension.
- Added explicit shop review/suspend/restore transition rules and blocked approval for banned owners.
- Added durable `AdminAuditLog` records for all user/shop status changes.
- Added `/admin/users` and rebuilt `/admin/shops` with Vietnamese filters, detail/audit panels and guarded confirmation dialogs.
- Added migration `20260817115846_phase7_admin_governance` plus JWT, helper and PostgreSQL governance coverage.
- Fixed submitted-search clearing across Marketplace, Admin users and Admin shops: deleting the last character now removes the active search immediately and restores the complete list under any remaining category/role/status filters.

Phase 8 customer Wishlist and catalog stock UX:

- Added persistent user-owned `WishlistItem` data with database uniqueness, cascade cleanup and lookup indexes.
- Added authenticated list/product-ID/add/remove APIs with pagination, idempotency, role checks and current purchasability/stock projection.
- Added explicit `Kho: n` stock text and account-aware Wishlist heart controls to Marketplace product cards.
- Added `/wishlist` with empty/error/loading states, pagination, unavailable-product retention, removal and cart-indicator synchronization.
- Added an account-aware Wishlist count store and desktop/mobile header badge synchronized on restore, Home add/remove and Wishlist removal.
- Added atomic Vendor editing of `stockOnHand`; every actual change writes `MANUAL_ADJUSTMENT` ledger and cannot reduce on-hand below reserved stock.
- Added migration `20260818090000_phase8_customer_wishlist`, PostgreSQL integration coverage and Web helper/navigation coverage.

Phase 9 selective Cart and dedicated Checkout:

- Added selected CartItem IDs to quote/commit with UUID/list validation, current-user ownership checks and backward-compatible all-cart fallback for old clients.
- Scoped pricing, coupon, shop shipping, order snapshots, inventory reservations and CartItem deletion to the exact selected set.
- Included sorted selection IDs in the idempotency fingerprint so one key cannot represent two different baskets.
- Rebuilt `/cart` as a product-selection/quantity screen with a single Checkout action; moved address/map, payment, coupon and final order submission to `/checkout`.
- Kept unselected items in Cart after successful commit and reconciled the header badge from the remaining cart.
- Added canonical Product Detail links in Cart, Checkout and customer Orders; order responses expose current slug while historical name/price/image remain snapshots.
- Added PostgreSQL selective-checkout assertions and Web selection/navigation helper coverage.

Phase 10 SePay electronic payment:

- Studied the ProjectIII SePay hosted-checkout flow, then integrated the same provider without copying its browser-trusted direct order update.
- Added `SEPAY` PaymentMethod, migration `20260818213000_add_sepay_payment_method` and official `sepay-pg-node` dependency.
- Added signed one-time hosted checkout creation with Payment UUID invoice identity, VND validation and owner-scoped retry.
- Added SePay `ORDER_PAID` IPN authentication, captured/approved/currency/amount checks, replay audit and exact state-machine settlement.
- Added direct SePay order-detail reconciliation as a return-page fallback; browser callback parameters never settle a payment by themselves.
- Hardened the first real Production return: nullable IPN customer is accepted, delayed order-detail transactions return pending, and the Web performs bounded polling with manual retry instead of exposing a missing-status parser error.
- Added `/payments/sepay/return`, Checkout SePay selection, Orders retry action and strict hosted-form CSP/URL allowlisting.
- Added targeted SDK/Web tests plus PostgreSQL IPN integration coverage for wrong secret, exact replay and amount mismatch.
- Applied the tenth migration locally and verified API/Web compilation; automated SePay refunds remain explicitly rejected until a provider-supported refund workflow is selected.

Phase 11 interaction-based product recommendations:

- Added aggregated per-account VIEW, WISHLIST, ADD_TO_CART and PURCHASE signals with unique user/product/type storage.
- Added explainable ranking using intent weight, actual-time recency decay, bounded frequency, category/shop affinity, sold-stock popularity and freshness.
- Added public trending cold-start plus authenticated personalized recommendation APIs, both restricted to public in-stock Catalog products.
- Wired Product Detail view tracking and transactionally wired Wishlist, Cart and Checkout signals.
- Added Home recommendation shelf, existing Cart/Wishlist actions and a visibility switch that hides/shows the shelf without deleting current-account personalization.
- Added migration `20260818230000_phase9_product_recommendations`, ranking unit tests and PostgreSQL integration coverage.
- Fixed the async VIEW/Home navigation race by publishing an in-memory frontend invalidation only after interaction persistence succeeds; active or restored Home state reloads recommendations immediately.
- Added multi-category shelf diversification after score ranking: preferred categories receive representation and one category is capped at 75% when enough public candidates exist, while narrow catalogs still fill available slots.

Phase 12 demo catalog and public shop storefront:

- Added four approved demo Vendor accounts/shops and documented their credentials in `docs/demo-vendor-accounts.docx`.
- Added a static 2026-08-19 CellphoneS reference snapshot: 20 phones, 20 tablets and 20 laptops with source URLs and remote image URLs.
- Distributed those 60 products deterministically across the four demo shops, giving every shop five products in each category.
- Added the idempotent `npm run seed:demo-catalog` workflow with production-only explicit opt-in and duplicate-safe initial inventory/ledger creation.
- Added the public shop storefront API with approved-shop, active-product and positive-available-stock visibility enforcement, search, category filtering and pagination.
- Added customer `/shops/[slug]` storefronts and linked seller names from Home and Product Detail.
- Added fixture, service and Web route/helper coverage plus live database/API/login/distribution smoke tests.

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
- Full API unit/integration suite passed after Phase 5D: 16 suites, 31 tests, including retention deletion and competing cleanup-worker lock coverage.
- Web unit suite passed after Phase 5D: 2 suites, 6 tests for memory-only tokens, reload recovery, concurrent/stale refresh races and CSP construction.
- Full E2E regression remained green after Phase 5D: 3 suites, 4 tests.
- Root API/Web lint, API production build and Web production build with 16 static routes passed after Phase 5D.
- Web production runtime smoke returned the configured CSP/COOP/Permissions/Referrer/nosniff/frame headers and no `X-Powered-By` header.
- Browser hydration/console smoke could not run because no in-app/Chrome browser instance was available; production build, HTTP runtime smoke and unit tests passed.
- Migration `20260805225335_phase5_notifications_outbox` applied and Prisma Client regenerated.
- Notification integration passed: 1 suite, 3 tests for idempotent delivery, read ownership, invalid-payload quarantine and deleted-recipient quarantine.
- Coupon/payment focused integration passed: 2 suites, 3 tests including vendor ownership/discovery and COD partial/full refund.
- Commerce e2e passed with persisted shop/order/status notifications and read-all verification.
- Final API unit/integration regression passed: 17 suites, 35 tests.
- Final HTTP E2E regression passed: 3 suites, 4 tests with no outbox worker errors.
- Web production build passed on Next.js 16.3.0 with 19 static routes including notifications, refunds and vendor coupons.
- API and Web production Docker images built successfully; API Prisma generation detected OpenSSL correctly.
- Final API image uses production-only dependencies, explicitly generates Prisma Client and reports zero image-stage vulnerabilities; runtime smoke passed for liveness/readiness/products/security headers.
- Bounded 500-request/25-concurrency load smoke passed with zero failures and p95 23 ms on the local machine.
- Guarded backup/restore drill passed against an isolated local restore database: 6 migrations and 6 user rows matched the source; the temporary database was removed afterward.
- Production dependency audit passed with zero vulnerabilities.
- Phase 5F Web lint passed; Web unit suite passed with 3 suites/10 tests after role-aware navigation coverage.
- Phase 5F Web production build passed with 19 static routes using webpack; default Turbopack build was blocked by the execution environment's internal process-port restriction rather than a source/type error.
- Local runtime HTTP smoke returned 200 for the redesigned storefront, public products and categories, and confirmed the new storefront content in rendered HTML.
- Product detail Web lint passed; Web unit suite passed with 4 suites/14 tests; production build passed with 19 static routes plus dynamic `/products/[slug]`.
- Runtime smoke returned 200 for `/products/modular-desk-lamp`, its public product API and public reviews API using seeded data.
- Expanded Catalog integration test and full API regression passed against PostgreSQL/Redis: 17 suites, 35 tests.
- API/Web lint passed; Web unit suite passed with 5 suites/20 tests; API and Web production builds passed for product authoring/card repair.
- Product slug routing regression passed with 5 Web suites/22 tests and Web lint; Web production build passed with the dynamic detail route, the exact MacBook API URL returned its public product, and the production frontend route returned HTTP 200.
- Runtime HTTP smoke returned 200 for catalog and Vendor products; a fresh production Web process confirmed `img-src 'self' blob: data: https:`. The pre-existing dev process retains its old CSP until restarted because Next config is startup-loaded.
- Address/cart UX Web regression passed: 7 suites, 26 tests; Web lint passed without warnings; Web production build passed with 19 static routes and dynamic `/products/[slug]` using webpack. Default Turbopack remained blocked by the environment's internal process-port restriction.
- Fresh production `/cart` HTTP smoke returned 200 with the Nominatim-only connect allowlist and `strict-origin-when-cross-origin`; production dependency audit returned zero vulnerabilities after pinning patched transitive `nanoid` 3.3.18.
- Fixed map search reloading Cart/Profile by removing the nested search form inside `AddressForm`; search button and Enter now invoke geocoding without submitting the address form. Web regression is 8 suites/27 tests.
- Fixed geocoding blocked by a stale/direct browser CSP path: search and reverse lookup now use validated same-origin Next route proxies with an identifying server User-Agent, one-request-per-second process queue and 24-hour cache. Live local smoke returned Hà Nội search and reverse results; Web regression is 9 suites/29 tests and the build exposes 21 routes.
- Phase 6 API/Web lint and API production build passed; Web production build passed with 23 routes using webpack. Default Turbopack remains blocked by the environment's internal process-port restriction.
- DeepSeek prompt/service tests passed: 1 suite, 3 tests. Chat PostgreSQL integration passed: 1 suite, 3 tests for conversation/message idempotency, read state, realtime publication and ownership boundaries.
- Chat Web helper/navigation regression passed: 2 suites, 6 tests for deduplication, ordering, labels and role-aware routes.
- Local API runtime smoke passed for demo customer/vendor login, both inbox views and vendor-owned AI settings: HTTP 200, one seeded thread per side, AI disabled/unconfigured as expected without a local key.
- Local Socket.IO runtime smoke passed with a customer JWT: authenticated namespace connection succeeded and ownership-checked `chat:join` acknowledged `{ok:true}`. Authentication now runs as namespace middleware before the client receives `connect`, avoiding an initial room-join race.
- Phase 6 visual browser click-through could not run because browser discovery returned no connected instance; route production compilation, localhost HTTP/API smoke and automated frontend/backend tests remain green.
- Final Phase 6 regression passed: API 20 suites/43 tests, HTTP E2E 3 suites/4 tests and Web 10 suites/31 tests. API/Web lint and API build passed; Web webpack production build generated 23 routes including `/messages` and `/vendor/messages`.
- Production dependency audit after adding Socket.IO client/server packages returned zero vulnerabilities.
- Fixed Vendor shop onboarding's post-success `Cannot read properties of null (reading 'reset')`: the form element is captured before `await`, reset only after successful creation, submit is guarded against double-click, and the same latent lifecycle bug was removed from Admin category creation. Web regression now has 11 suites/33 tests.
- Browser click-through for the form fix could not run because browser discovery again returned no connected instance; lint/unit/build verification is used. Because the old failure happened after the successful POST, a request created before the reset error remains persisted and appears after reload.
- Phase 7 migration applied locally and Prisma Client regenerated.
- Phase 7 API regression passed: 22 suites, 49 tests; API lint and production build passed.
- Phase 7 Web regression passed: 12 suites, 36 tests; Web lint passed without warnings and webpack production build generated 24 routes including `/admin/users` and `/admin/shops`.
- Phase 7 HTTP E2E regression passed: 3 suites, 4 tests. Local runtime returned 200 for both Admin pages and for paginated Admin user/shop APIs; the same endpoints returned 403 to the demo customer.
- Phase 7 visual Browser click-through could not run because no connected browser instance was available after connection retry; route compilation, runtime HTTP smoke and automated API/Web tests remain green.
- Search-clear regression passed Web lint, 13 suites/38 tests and the 24-route webpack production build. Browser discovery again found no connected instance, so interaction QA is covered by the shared state-transition test and compiled page handlers in this session.
- Phase 8 Wishlist migration applied successfully; Prisma reports all 9 migrations up to date.
- Phase 8 API regression passed: 23 suites/51 tests; targeted Wishlist PostgreSQL integration passed 1 suite/2 tests; API lint and production build passed.
- Phase 8 Web regression passed: 14 suites/40 tests; Web lint passed and webpack production build generated 25 routes including `/wishlist`.
- Full HTTP E2E remained green: 3 suites/4 tests. Local runtime verified login, public product discovery, Wishlist add/list/ID/remove, current `available=48`, `isPurchasable=true`, and HTTP 200 for `/` plus `/wishlist`.
- Phase 8 visual Browser click-through could not run because no connected browser instance was available after required setup/troubleshooting/retry; automated tests, production compilation and localhost HTTP/API smoke are green.
- Phase 9 selective Checkout integration passed: 1 suite/2 tests proving foreign/stale selection rejection, selected-only pricing/order/reservation and preservation of the unselected CartItem.
- Final API regression remained 23 suites/51 tests; Web regression is now 15 suites/43 tests; HTTP E2E remained 3 suites/4 tests. API/Web lint and both production builds passed; Web generated 26 routes including `/checkout`.
- Local runtime smoke returned 200 for login, Cart API, Orders API, `/cart`, `/checkout?items=...` and `/orders`; selected quote returned one requested item and customer OrderItem response included its current product slug.
- Phase 9 visual Browser click-through could not run because no connected browser instance was available after setup, troubleshooting lookup and retry; runtime HTTP, transaction coverage and production compilation are green.
- Chat IME regression passed the complete Web suite at 15 suites/44 tests, Web lint and the 26-route webpack production build. Browser discovery had no connected instance after troubleshooting/retry, so direct Vietnamese composition click-through remains covered by the composition-state/key-code helper regression and should be repeated when a browser is attached.
- SePay migration `20260818213000_add_sepay_payment_method` applied successfully; Prisma Client regenerated and the API production build passed.
- SePay gateway unit tests passed (2 tests), Web hosted-form/CSP tests passed (5 tests) and PostgreSQL payment integration passed (3 tests), including secret rejection, idempotent IPN replay and exact amount enforcement.
- Web webpack production build generated 27 routes including `/payments/sepay/return`; default Turbopack remained blocked by the execution environment's PostCSS process-port restriction.
- Final SePay regression passed: API 24 suites/54 tests, Web 16 suites/46 tests and HTTP E2E 3 suites/5 tests; API/Web lint and API build passed, and production dependency audit reported zero vulnerabilities.
- Local runtime smoke returned HTTP 200 with the expected cancelled state for `/payments/sepay/return`; an unsigned/unconfigured IPN failed closed with HTTP 503. Browser discovery had no connected instance after the required retry, so route compilation, HTTP smoke and automated tests cover this session's UI verification.
- Phase 11 recommendation migration `20260818230000_phase9_product_recommendations` applied successfully and Prisma Client regenerated.
- Recommendation ranking unit tests passed 4/4; PostgreSQL recommendation/Wishlist/Checkout/Coupon integration passed 4 suites/8 tests.
- Public recommendation runtime smoke returned HTTP 200 with `personalized=false`, `reason=TRENDING` and only current ACTIVE/APPROVED/in-stock products.
- Final Phase 11 regression passed: API 26 suites/61 tests, HTTP E2E 3 suites/5 tests and Web 17 suites/49 tests. API/Web lint, API build and the 27-route Web webpack production build passed; Prisma reports all 11 migrations up to date. Default Turbopack remained blocked by the environment's PostCSS process-port restriction.
- Authenticated localhost smoke returned login 200, view tracking 201 and recommendation 200 with `personalized=true`, `reason=INTERACTIONS`; no access token was printed.
- Phase 11 visual Browser click-through could not run because browser runtime discovery found no browser and its installed troubleshooting reference pointed to a removed plugin version; automated UI tests, production compilation and localhost API smoke are green.
- Phase 12 demo fixture tests passed with exactly 60 unique products, 20 per category and 15 per Vendor.
- The demo-catalog seed ran twice successfully against local PostgreSQL without duplicates; all four Vendor credentials returned HTTP 200 from login.
- Public storefront runtime smoke returned HTTP 200 for all four shops. Each shop returned five phones, five tablets and five laptops from the new snapshot; North Studio also retained its three pre-existing products.
- Final Phase 12 regression passed: API 27 suites/65 tests and Web 17 suites/50 tests. API/Web lint and both production builds passed; Web generated 27 routes including dynamic `/shops/[slug]`.
- No connected browser instance was available for visual storefront click-through; route compilation, unit/service coverage and live localhost API smoke are green. The credential DOCX passed OOXML archive/accessibility checks and a macOS Quick Look visual preview; canonical LibreOffice rendering was unavailable because `soffice` is not installed.
- Recommendation refresh/diversity regression passed: ranking unit tests 6/6, Web refresh/recommendation tests 4/4 and PostgreSQL recommendation integration tests 4/4. The mixed-intent case keeps three high-intent-category items plus one newly viewed-category item in a four-product shelf.
- Final recommendation-fix regression passed: API 27 suites/68 tests sequentially and Web 18 suites/51 tests; API/Web lint, API build and the 27-route Web webpack production build passed. The first parallel API run hit one transient PostgreSQL deadlock in an unrelated Checkout integration test; the complete sequential rerun passed without source changes to Checkout.
- Recommendation visual click-through could not run because browser discovery returned no connected browser; post-persist refresh is covered by the frontend subscriber regression, mixed-category behavior by pure ranking and PostgreSQL integration tests, and the full Web production route compiled successfully.
- SePay production-return hardening passed nullable-customer HTTP E2E plus delayed-transaction PostgreSQL reconciliation; payment E2E is 2/2 and the focused Catalog/Payment integration run is 5/5.
- Vendor stock editing regression proved Product + Inventory + `MANUAL_ADJUSTMENT` ledger commit together and a below-reserved request changes neither Product nor Inventory.
- Wishlist badge/recommendation visibility Web tests passed; final regression is API 27 suites/69 tests and Web 19 suites/53 tests.
- API/Web lint passed and both production builds passed; Web generated 27 routes including `/payments/sepay/return`, `/vendor/products` and `/wishlist`.
- Browser runtime discovery returned no connected browser for this change; toggle/badge/form rendering is therefore verified by TypeScript production compilation, Web regression and source review rather than automated click-through.

## Current Risks / Gaps

- SePay payment initiation/IPN/reconciliation is implemented and the first real Production transfer exposed/fixed nullable-customer plus delayed-transaction handling. A complete post-deploy payment rerun with the configured HTTPS IPN and successful `PAID` observation is still required before calling merchant certification complete.
- Automated refund for SePay bank-transfer payments is intentionally rejected because the selected SePay flow does not expose the same provider refund completion contract; define an audited outbound-transfer/refund policy before enabling it.
- Admin audit rows are retained indefinitely and deliberately restrict deletion of their actor account; define retention/anonymization and legal-support policy before adding permanent user deletion.
- Redis is now a critical API dependency when `RATE_LIMIT_FAILURE_MODE=closed`; production needs managed Redis high availability, capacity monitoring and an intentional outage policy.
- Repository CD/drill automation is implemented, but real staging execution still needs the chosen hosting/database, GitHub Environment URL/secrets and rollout webhook.
- Notification inbox is persisted and transactionally reliable; external email/push delivery is not part of the current product scope.
- Access tokens are memory-only and refresh sessions are cleaned after retention; active-page XSS can still access runtime state, so CSP must remain restrictive and third-party scripts require security review.
- The static Turbopack-compatible CSP still requires `script-src 'unsafe-inline'`; strict nonce/SRI CSP is deferred until Next.js supports a stable Turbopack/static-generation path or the project accepts dynamic rendering/webpack trade-offs.
- Browser hydration/console QA could not run in this session because browser discovery returned no available browser; production build, HTTP/container runtime smoke and automated tests remain green.
- Visual click-through remains to be rerun when an in-app/Chrome browser is attached; this session again reported no available browser after the required connection troubleshooting.
- Product detail currently uses client-side data loading, so per-product server metadata/SEO and review pagination controls remain optional UX follow-ups; purchase and authorization correctness are unaffected.
- Product images currently use Vendor-managed URLs. Direct binary upload remains pending selection of object storage/CDN and a signed upload/scanning policy; container filesystem/base64 persistence is intentionally not used.
- Existing products may contain human-readable slugs with spaces/Unicode. Public routing now supports them safely; enforcing canonical lowercase hyphenated slugs would require an explicit compatibility/redirect migration rather than silently changing live URLs.
- Browser discovery again returned no available in-app/Chrome instance, so the card fix was verified by the block/aspect-ratio source invariant, builds/tests and HTTP runtime rather than an automated screenshot.
- Public OpenStreetMap/Nominatim endpoints are intentionally a low-volume local/demo integration. Production traffic requires a managed or self-hosted tile/geocoding service with reviewed quota, caching, attribution and privacy terms.
- The current Nominatim proxy limiter/cache is process-local; a multi-replica production deployment must replace it with distributed enforcement or a provider contract.
- Socket.IO room fan-out is process-local. Before horizontally scaling the API, add a Redis Socket.IO adapter and load-balancer WebSocket/sticky-session configuration.
- AI generation currently runs as a best-effort background promise in the API process. A process restart can leave a source message `PENDING`; production should move generation to a durable queue/worker with timeout recovery.
- Catalog grounding limits the prompt to 60 most recently updated ACTIVE products and 20 recent messages. Large shops need retrieval/search rather than sending their full catalog.
- Chat content currently has retention/storage but no moderation, attachment upload or end-to-end encryption policy; define retention/privacy/abuse controls before public launch.
- `GET /wishlist/product-ids` intentionally returns a compact full ID set for instant heart state; if individual wishlists grow to thousands of products, replace it with bounded membership checks or page-level authenticated projection.
- Checkout selection is encoded in the URL for reload/share-safe navigation and capped at 99 UUIDs (about 4 KB worst case). Production proxies must permit that request-target size; a future very-large-cart design should use a short-lived server-side checkout session instead.
- Recommendation ranking is an explainable in-request heuristic capped at 100 interaction aggregates and 80 candidates. Before large-catalog rollout, add offline retrieval/cache, exposure metrics, diversity/fairness guardrails and a reviewed privacy/retention policy rather than increasing query limits indefinitely.
- The current diversity rule is a deterministic 75% category cap, not an experimentally tuned merchandising policy. Validate its effect with exposure/conversion metrics before changing weights or quota for production traffic.
- Demo product prices are a dated test snapshot and are not synchronized with CellphoneS. Remote image hotlinks may expire and require source/licensing review; production should copy approved assets into owned object storage/CDN instead of depending on third-party URLs.

## Next Recommended Step

The agreed application baseline, including shop chat, catalog-grounded AI, Admin governance, Wishlist, selective dedicated Checkout, recommendations and public demo shop storefronts, is complete. Remaining follow-up depends on external choices/access or scale requirements:

1. Deploy the SePay return/IPN hardening, confirm `https://demoserver.io.vn/api/payments/webhooks/sepay` is active with matching secret, then rerun a real transfer through final `PAID` status and inspect SePay IPN logs.
2. Define the operational/provider contract for SePay refunds before implementing automated outbound money movement.
3. Configure `DEEPSEEK_API_KEY` in the API secret manager, enable AI per shop and verify answers against staging catalog data.
4. Add Redis Socket.IO fan-out and a durable AI job worker before multi-replica production rollout.
5. Configure staging environment secrets/URLs and execute the supplied staging/backup/restore/load/rollback workflows on real infrastructure.
6. Collect recommendation exposure/conversion metrics and define an A/B/privacy policy before considering collaborative or ML ranking.
7. Before using demo catalog data beyond testing, replace remote image hotlinks with reviewed assets in owned storage and establish an authorized product-feed/update policy.
