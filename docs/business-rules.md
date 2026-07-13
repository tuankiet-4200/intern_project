# Business Rules V1

## Users & Roles

- CUSTOMER mua hang, quan ly dia chi, review san pham da mua.
- VENDOR quan ly shop, product, inventory va shop orders.
- ADMIN duyet shop, quan ly category, moderation user/shop/product.
- Mot user co the co vai tro VENDOR khi da tao shop duoc duyet.

## Shop

- Shop moi tao co trang thai `PENDING_REVIEW`.
- Chi shop `APPROVED` moi duoc ban san pham public.
- `SUSPENDED` khong duoc tao product moi va khong nhan order moi.

## Product & Inventory

- Product co status rieng: `DRAFT`, `ACTIVE`, `ARCHIVED`.
- San pham public khi product `ACTIVE`, shop `APPROVED`, inventory available > 0.
- Khong update truc tiep stock bang overwrite im lang. Moi thay doi di qua inventory ledger.
- Available stock = on_hand - reserved.

## Cart

- Cart luu product id va quantity, gia chi la preview.
- Luc checkout phai doc lai product, price, shop status, inventory.
- Neu product het hang/gia doi, checkout tra loi ro item nao khong hop le.

## Checkout & Order

- Parent order dai dien mot lan checkout cua customer.
- Shop order dai dien phan don hang cua tung shop.
- Order item snapshot ten, gia, anh, shop, tax/shipping neu co.
- Tao order va reserve stock phai trong transaction.
- Don hang co idempotency key de tranh double checkout khi user refresh/retry.

## Payment

- Payment status doc lap voi fulfillment status.
- COD: payment pending cho toi khi delivered/collected.
- Bank transfer/SePay: chi mark paid khi webhook/confirm hop le va amount khop.
- Refund la transaction rieng, khong sua nguoc payment record cu.

## Status Transitions

Parent order:
- `DRAFT` -> `PLACED` -> `COMPLETED`
- `PLACED` -> `CANCELLED`

Shop order:
- `PENDING_CONFIRMATION` -> `CONFIRMED` -> `PACKING` -> `READY_TO_HANDOFF` -> `DELIVERED`
- `PENDING_CONFIRMATION` -> `CANCELLED`
- `CONFIRMED` -> `CANCELLED` neu chua handoff

Payment:
- `UNPAID` -> `AUTHORIZED` -> `PAID`
- `UNPAID` -> `FAILED`
- `PAID` -> `REFUND_PENDING` -> `REFUNDED`

## Coupon

- Coupon co scope `GLOBAL` hoac `SHOP`.
- Kiem tra active, expiry, min order amount, max discount, usage limit.
- Usage duoc ghi khi checkout thanh cong, can unique theo coupon/user/order tuy campaign.

## Review

- Customer chi review product da giao thanh cong.
- Moi customer moi product/order item chi review mot lan.
