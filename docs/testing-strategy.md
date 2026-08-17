# Testing Strategy

Last updated: 2026-08-17

## Testing Pyramid

- Unit tests: pure business rules, status transitions, validators, calculation helpers.
- Service tests: module services with mocked dependencies where DB is not required.
- Integration tests: Prisma/database transactions and cross-module workflows.
- E2E tests: critical user journeys through API or UI.

## What Must Be Tested

Auth/RBAC:

- Register rejects duplicate email.
- Register rejects public admin creation.
- Login rejects invalid credentials.
- Protected routes require JWT.
- Role-protected routes reject unauthorized roles.
- Refresh token rotates and the old token cannot be reused.
- Logout revokes the active refresh session.
- Public registration cannot provision vendor/admin roles.
- Cleanup deletes only expired/revoked sessions older than retention and preserves recent/active sessions.
- Multiple cleanup workers use a database lock and bounded batches rather than racing unbounded deletes.

Shop:

- Customer/vendor can create a shop request.
- Admin can approve/reject/suspend.
- Non-admin cannot review shop.
- Vendor cannot manage another vendor's shop.

Catalog:

- Product public listing only includes active products from approved shops.
- Vendor can create/list own products.
- Vendor cannot modify another vendor's product.
- Category tree handles parent/child rules.
- Product create/update persists description, compare-at price, images and scalar attributes; compare-at price must remain greater than selling price.

Inventory:

- Available stock equals `onHand - reserved`.
- Adjustment cannot make on-hand lower than reserved.
- Every stock change creates a ledger row.
- Reservation fails when stock is insufficient.

Cart/Checkout/Order:

- Cart validates product availability.
- Checkout snapshots product name, image, and price.
- Checkout creates parent order and shop orders in one transaction.
- Checkout with same idempotency key does not duplicate orders.
- Concurrent checkout cannot oversell.
- Cart clears only purchased items after successful checkout.

Payment:

- Payment transitions are explicit and valid.
- Payment amount must match order amount.
- COD and bank transfer flows remain separate from fulfillment.
- Refund records do not mutate historical payment records silently.
- COD refund requires explicit offline confirmation and updates partial/full summary atomically.
- Bank-transfer refund remains pending until a valid signed callback.

Coupon:

- Admin campaign DTO/service rejects invalid money, dates, scope/shop and limits.
- Used campaign economic terms cannot be rewritten.
- Quote and commit enforce global and per-customer limits.
- Competing checkout cannot create usage beyond a per-customer limit.
- Vendor cannot create global coupons or mutate another vendor's campaign.
- Discovery hides inactive, expired, exhausted and account-exhausted campaigns.

Notifications:

- Business transaction and outbox event commit or roll back together.
- Two workers cannot create duplicate inbox rows for one outbox event.
- Invalid event payload becomes FAILED without blocking valid events.
- Inbox list/read operations are scoped to current user.

Infrastructure/request protection:

- Memory limiter returns structured 429 responses and bypasses health probes.
- Redis limiter enforces one atomic quota across independent API instances.
- Concurrent requests cannot admit more than the configured shared quota.
- Redis outage behavior is explicit: fail-open bypasses with a policy header; fail-closed returns structured 503.
- Readiness reports ready, degraded or unavailable consistently with the configured failure mode.

Frontend:

- Critical pages render.
- Forms show validation and API errors.
- Vendor/admin pages enforce expected workflow states.
- Full happy path is covered once API is wired.
- Access tokens are not written to localStorage and the legacy persisted key is removed.
- A protected request after reload restores memory state through the HttpOnly refresh cookie.
- Concurrent protected requests share one refresh call.
- A late refresh response cannot restore memory state after logout/session clear.
- Production CSP allows only the configured API connection origin and blocks object/frame embedding.
- Notification, refund and vendor-coupon pages compile and expose loading/error/empty states.
- Role-aware navigation exposes only the current actor's workspace, permits customer shop onboarding, and hides protected navigation before session recovery or on cross-workspace access.
- Product detail route is public; available stock cannot display negative, cart quantity stays within stock, compare-at discount requires valid prices, and nested attributes are not rendered as scalar specs.
- Product detail links and API requests keep slugs with spaces/Unicode single-encoded so `%20` never becomes `%2520` between Next.js routing and the Catalog API.
- Vendor product form trims/deduplicates HTTP(S) image URLs and rejects incomplete/duplicate attribute rows; catalog image links preserve their aspect-ratio block.
- Nominatim address fields map into the internal Vietnamese address shape, while omitted provider fields preserve manual input.
- Cart indicator normalizes item counts, notifies only on change and formats counts over 99 as `99+`.
- Production CSP explicitly allows only the Nominatim geocoder origin in addition to the application API, and uses a provider-compatible origin-only cross-site referrer policy.
- Address map search renders no nested `<form>` and its search control is an explicit non-submitting button, preventing Cart/Profile reload on search.

Operations:

- Production dependency audit has no high/critical advisory.
- API/Web Docker images build from the repository root.
- Runtime smoke validates readiness body and security headers.
- Bounded load smoke has no failures and remains under the configured p95 threshold.
- Backup restore uses a distinct target and verifies restored migration/business row counts.

## Default Commands

After dependencies are installed:

```bash
npm run test
npm run lint
npm run build
```

Workspace-specific examples:

```bash
npm run test -w @intern-project/api
npm run build -w @intern-project/api
npm run build -w @intern-project/web
npm audit --omit=dev --audit-level=high
npm run smoke:api
npm run load:smoke
```

## When Tests Cannot Run

If dependencies, database, or generated Prisma client are missing:

1. Do not pretend tests passed.
2. Record the blocker in `docs/project_context.md`.
3. Record the exact command that should be run later.
4. Keep the implementation small enough to review manually.
