# Intern Project - Build Commerce Platform


## Pham vi

Giữ trong 2 tháng đầu:
- Customer web: browse, cart, checkout, orders, profile.
- Vendor portal: shop onboarding, product, inventory, order handling.
- Admin portal: user/shop/category moderation, basic operations dashboard.
- Backend commerce core: auth, catalog, cart, order, payment, inventory, coupon, review.

## Tech direction

- Web: Next.js App Router, TypeScript, Tailwind CSS.
- API: NestJS modular monolith, TypeScript, Prisma.
- Data: PostgreSQL, Redis.
- Async: RabbitMQ cho order events/payment events khi bước sang Phase 2.
- Architecture: modular monolith trước, domain boundary rõ để có thể tách microservice sau.

## Phase 1 Deliverables

- Roadmap 2 tháng trong `docs/roadmap.md`.
- Business rules ban đầu trong `docs/business-rules.md`.
- Data model v1 trong `apps/api/prisma/schema.prisma`.
- API skeleton trong `apps/api/src`.
- Web skeleton trong `apps/web`.
- Docker compose local cho Postgres/Redis/RabbitMQ.

## Chay local sau khi cai dependencies

```bash
npm install
docker compose up -d
npm run dev
```

Phase 1 hiện là foundation/skeleton. Chua cai dependencies trong turn nay de tranh download network ngoai y muon.

## Phase 2 Progress

- Auth API: register/login voi JWT.
- RBAC foundation: JWT guard, roles decorator, roles guard.
- Shop onboarding: create shop, my shops, admin review queue, approve/reject/suspend.
- Catalog: category API, public product listing, vendor product creation.
- Inventory: product inventory view, vendor adjustment, reserve API cho checkout Phase 3.
- Run guide: `docs/run-guide.md`.
