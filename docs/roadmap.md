# Roadmap 2 Thang - Commerce Rebuild

## Role & Product Direction

Vai tro Tech Lead/TPM: rebuild he thong thuong mai dien tu multi-vendor theo tung buoc, uu tien business correctness, testability, observability va kha nang scale sau nay.

Nguyen tac:
- Modular monolith truoc, tach boundary nhu microservice de giam do phuc tap van hanh.
- Order, payment, inventory la core domain, phai co transaction va audit.
- Frontend moi uu tien workflow that: customer mua hang, vendor xu ly don, admin duyet va kiem soat.
- Bo shipper app, AI chatbot, recommendation trong 2 thang dau.

## Phase 1 - Foundation & Domain Baseline (Tuan 1-2)

Muc tieu:
- Khoi tao repo moi, coding standard, docker local, env convention.
- Chot domain model v1: user, shop, category, product, inventory, cart, order, payment, coupon, review.
- Thiet ke status machine cho shop/order/payment.
- Dung khung Next.js + NestJS.

Deliverables:
- Monorepo `apps/api`, `apps/web`, `packages/shared`.
- Prisma schema v1 co quan he va enum ro rang.
- API health check, module boundaries.
- UI shell moi: customer/vendor/admin navigation.
- Business rules document.

Acceptance:
- `docker compose up -d` co Postgres/Redis/RabbitMQ.
- API co the start va expose `/health`.
- Schema pass generate/migrate sau khi cai dependencies.

## Phase 2 - Identity, Catalog, Shop Operations (Tuan 3-4)

Muc tieu:
- Auth email/password + JWT access/refresh.
- Role: CUSTOMER, VENDOR, ADMIN.
- Shop onboarding: pending/approved/rejected/suspended.
- Catalog: category tree, product CRUD, product media metadata, search/filter/sort.
- Inventory ledger: stock on hand, reserved, sold, adjustment.

Deliverables:
- API auth + RBAC guard.
- Vendor product management.
- Admin approve shop/category.
- Customer browse/search product.
- Unit tests cho auth/catalog/inventory.

Acceptance:
- Vendor chi sua product cua shop minh.
- Product chi public khi shop approved va product active.
- Ton kho khong am, moi thay doi ton kho co ledger.

## Phase 3 - Cart, Checkout, Order, Payment (Tuan 5-6)

Muc tieu:
- Cart stable theo user, validate gia va ton kho luc checkout.
- Checkout tao order bang DB transaction.
- Order split theo shop nhung giu parent order cho customer payment.
- Payment abstraction: COD + bank transfer/SePay adapter sau.
- Coupon rule: global/shop, min spend, max discount, usage limit.

Deliverables:
- Cart API + customer cart UI.
- Checkout API + order creation transaction.
- Order status transition service.
- Payment intent/payment record.
- Vendor order dashboard.

Acceptance:
- Checkout dong thoi khong oversell.
- Gia tai thoi diem mua duoc snapshot.
- Trang thai order/payment chi di theo transition hop le.
- Cart duoc clear dung item sau checkout thanh cong.

## Phase 4 - Production Readiness & UX Completion (Tuan 7-8)

Muc tieu:
- Hoan thien customer/vendor/admin flows.
- Review sau giao hang.
- Notification co ban bang polling hoac WebSocket nhe.
- Observability, seed data, CI, deployment guide.

Deliverables:
- E2E happy paths: register, create shop, approve shop, create product, checkout, vendor fulfill, review.
- Admin dashboard basic metrics.
- Error handling standard response.
- Logging, request id, rate limit, validation pipe.
- Docker production draft.

Acceptance:
- Demo duoc full business flow khong can thao tac DB tay.
- Co seed data cho demo.
- Co test suite cho core domain.
- Co runbook local/prod.

## Backlog Sau 2 Thang

- Shipper app va logistics assignment.
- AI chatbot.
- Recommendation engine.
- Search engine rieng nhu Meilisearch/Elasticsearch.
- Tach service theo bounded context neu traffic/nhan su can.
