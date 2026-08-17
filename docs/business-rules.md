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
- Bank-transfer refund cho callback provider hop le; COD refund chi thanh cong ngay khi admin xac nhan da hoan tien offline.
- Tong Refund `SUCCEEDED` khong duoc vuot Payment amount; moi transition co append-only history.

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
- `PAID` hoặc `PARTIALLY_REFUNDED` -> `REFUND_PENDING`
- `REFUND_PENDING` -> `PARTIALLY_REFUNDED` hoặc `REFUNDED`
- Refund provider fail đưa payment về `PAID` hoặc `PARTIALLY_REFUNDED` theo tổng refund đã thành công.

## Coupon

- Coupon co scope `GLOBAL` hoac `SHOP`.
- Kiem tra active, expiry, min order amount, max discount, usage limit.
- Campaign co the gioi han tong luot va luot theo tung customer; quote va commit deu phai kiem tra lai.
- Usage duoc ghi khi checkout thanh cong, can unique theo coupon/user/order tuy campaign.
- Khong doi code/scope/shop/type/value sau khi da co usage; deactivate thay vi xoa campaign da dung.
- Vendor chi tao/sua coupon scope SHOP cua shop APPROVED do minh so huu; chi ADMIN quan ly GLOBAL coupon.
- Customer discovery chi hien campaign active, dung schedule, con tong luot va con luot cua account; checkout van revalidate cart.

## Notification

- Business mutation va notification request phai commit cung transaction qua outbox.
- Moi outbox event chi tao mot inbox notification; worker retry khong duoc duplicate.
- User chi doc/mark-read notification cua chinh minh.
- Payload notification khong chua secret, token hoac raw payment webhook data.

## Review

- Customer chi review product da giao thanh cong.
- Moi customer moi product/order item chi review mot lan.

## Shop Chat & AI

- Mỗi cặp customer/shop chỉ có một conversation; lịch sử message được giữ theo thời gian.
- Chỉ customer của conversation và owner hiện tại của shop được đọc, gửi, đánh dấu đã đọc hoặc join realtime room.
- `clientMessageId` là UUID do client tạo và unique trong conversation để retry không sinh message trùng.
- AI chatbot tắt mặc định theo từng shop; chỉ owner shop bật/tắt và chỉ bật khi server đã có `DEEPSEEK_API_KEY`.
- Chỉ tin nhắn CUSTOMER mới được phép kích hoạt AI; tin nhắn SHOP/AI không tự kích hoạt vòng lặp.
- AI chỉ nhận sản phẩm `ACTIVE` của đúng shop, kèm giá, mô tả, thuộc tính và `onHand - reserved`; không được suy đoán dữ liệu chưa có.
- AI/API provider lỗi không rollback tin nhắn customer. Source message đổi `PENDING -> COMPLETED|FAILED`; AI reply tham chiếu source qua `replyToMessageId` unique.
- DeepSeek key và system prompt chỉ tồn tại ở backend, không trả về WebSocket/REST response hoặc log.
