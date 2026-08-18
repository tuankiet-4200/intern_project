# Huong Dan Chay Du An

Tai lieu giai thich kien truc va tung luong code cho developer moi: [`codebase-handbook.md`](./codebase-handbook.md).

Runbook production, migration, smoke test va incident response: [`production-runbook.md`](./production-runbook.md).

Tài khoản bốn Vendor demo và bảng phân bổ catalog: [`demo-vendor-accounts.docx`](./demo-vendor-accounts.docx).

## Yeu cau

- Node.js 20+
- npm 10+
- Docker Desktop hoac Docker Engine

## 1. Tao file moi truong

```bash
cd /Users/kietnt/Documents/intern_project
cp .env.example .env
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
```

Để dùng AI chat, đặt secret chỉ trong `apps/api/.env` rồi khởi động lại API:

```bash
DEEPSEEK_API_KEY=your_server_side_key
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-v4-flash
DEEPSEEK_TIMEOUT_MS=20000
```

Không thêm key vào biến `NEXT_PUBLIC_*`, source code hoặc commit. Nếu không có key, chat người-người vẫn hoạt động nhưng Vendor không thể bật AI.

Để hiện phương thức thanh toán SePay, cấu hình trong `apps/api/.env` rồi khởi động lại API:

```bash
SEPAY_ENV=sandbox
SEPAY_MERCHANT_ID=your_merchant_id
SEPAY_SECRET_KEY=your_merchant_secret
SEPAY_IPN_SECRET=your_configured_ipn_secret
SEPAY_PAYMENT_METHOD=BANK_TRANSFER
SEPAY_RETURN_URL=http://localhost:3000/payments/sepay/return
```

Trong merchant sandbox, IPN trỏ tới public HTTPS `POST /api/payments/webhooks/sepay`; localhost cần tunnel. Không thêm bất kỳ SePay secret nào vào `NEXT_PUBLIC_*` hoặc Web env.

Mac/Linux neu port `5433`, `6380`, `5673`, `15673`, `3000`, `3005` dang ban, hay doi port trong `.env` hoac `docker-compose.yml`.

## 2. Cai dependencies

```bash
npm install
```

## 3. Chay ha tang local

```bash
docker compose up -d
```

Kiem tra:

```bash
docker compose ps
```

## 4. Chuan bi database

```bash
npm run prisma:generate -w @intern-project/api
npm run prisma:migrate -w @intern-project/api
npm run prisma:seed -w @intern-project/api
```

Tai khoan demo sau khi seed (mat khau chung `password123`):

- `admin@example.com`
- `vendor@example.com`
- `customer@example.com`

Để thêm snapshot 60 sản phẩm CellphoneS, ba danh mục và bốn shop Vendor demo, chạy lệnh idempotent sau (có thể chạy lại mà không cộng tồn kho):

```bash
npm run seed:demo-catalog
```

Trên production, script chủ động từ chối chạy nếu operator chưa xác nhận rõ:

```bash
NODE_ENV=production ALLOW_DEMO_CATALOG_SEED=true npm run seed:demo-catalog
```

Đây là dữ liệu demo snapshot, không phải đồng bộ giá/tồn kho trực tiếp với CellphoneS. Xem username/password và lưu ý vận hành trong file DOCX phía trên.

## 5. Chay backend va frontend

Chay tat ca workspace:

```bash
npm run dev
```

Hoac chay rieng:

```bash
npm run dev -w @intern-project/api
npm run dev -w @intern-project/web
```

URL mac dinh:

- Web: `http://localhost:3000`
- API health: `http://localhost:3005/api/health`
- RabbitMQ management: `http://localhost:15673`

## 6. Thu API nhanh

Register:

```bash
curl -X POST http://localhost:3005/api/auth/register \
  -H "Content-Type: application/json" \
  -c /tmp/intern-project-cookies.txt \
  -d '{"email":"customer2@example.com","password":"password123","fullName":"Customer Demo"}'
```

Login:

```bash
curl -X POST http://localhost:3005/api/auth/login \
  -H "Content-Type: application/json" \
  -c /tmp/intern-project-cookies.txt \
  -d '{"email":"vendor@example.com","password":"password123"}'
```

Dung `accessToken` tra ve lam Bearer token cho cac API vendor/admin.

Refresh access token:

```bash
curl -X POST http://localhost:3005/api/auth/refresh \
  -b /tmp/intern-project-cookies.txt \
  -c /tmp/intern-project-cookies.txt
```

Logout va revoke refresh session:

```bash
curl -X POST http://localhost:3005/api/auth/logout -b /tmp/intern-project-cookies.txt
```

## 7. Dung du an

```bash
docker compose down
```

Khong them `-v` neu muon giu data Postgres local.
