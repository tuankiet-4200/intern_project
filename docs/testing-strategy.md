# Testing Strategy

Last updated: 2026-07-15

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

Coupon:

- Admin campaign DTO/service rejects invalid money, dates, scope/shop and limits.
- Used campaign economic terms cannot be rewritten.
- Quote and commit enforce global and per-customer limits.
- Competing checkout cannot create usage beyond a per-customer limit.

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
```

## When Tests Cannot Run

If dependencies, database, or generated Prisma client are missing:

1. Do not pretend tests passed.
2. Record the blocker in `docs/project_context.md`.
3. Record the exact command that should be run later.
4. Keep the implementation small enough to review manually.
