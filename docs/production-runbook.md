# Production Runbook and Deployment Draft

Last updated: 2026-08-11

Tài liệu này là quy trình vận hành production baseline cho monorepo Multi-Vendor Commerce Platform đến Phase 6. Nó dùng cách diễn đạt platform-agnostic để có thể áp dụng trên VM, container platform hoặc PaaS. Trước khi go-live thật, đội vận hành phải thay các giá trị mẫu bằng secret/domain/resource thực tế và chạy workflow staging/restore/rollback với hạ tầng thật.

## 1. Phạm vi và trạng thái

Runbook bao phủ:

- PostgreSQL migration.
- NestJS API release.
- Next.js Web release.
- Health/smoke checks.
- Logging và request correlation.
- Rate limiting baseline.
- Backup/restore expectations.
- Rollback và incident response.

Giới hạn hiện tại:

- Distributed rate limiter đã dùng Redis. Với `RATE_LIMIT_FAILURE_MODE=closed`, Redis là critical request-path dependency và phải có HA/monitoring phù hợp.
- RabbitMQ chưa nằm trong critical business path.
- Bank transfer có signed provider-neutral webhook và refund transaction; adapter/reconciliation theo provider cụ thể chưa có.
- Persisted inbox dùng database outbox worker nhúng trong API; email/push/RabbitMQ delivery chưa nằm trong contract hiện tại.
- Access token phía Web đã memory-only; static Turbopack CSP còn cần `unsafe-inline`, nên mọi third-party script/widget phải qua security review.
- Socket.IO và AI background generation hiện phù hợp single API process. Multi-replica cần Redis adapter cho room fan-out và durable queue/worker cho AI retry/recovery.

## 2. Kiến trúc deploy đề xuất

```text
Internet
  -> TLS Load Balancer / Reverse Proxy
      -> Next.js Web
      -> NestJS API
          -> Managed PostgreSQL
          -> Managed Redis (distributed limiter)
          -> DeepSeek API (outbound HTTPS, optional per-shop AI)
          -> RabbitMQ (future domain events)
```

Production tối thiểu:

- TLS bắt buộc.
- Web và API chạy bằng non-root user/container.
- PostgreSQL không public internet.
- Secret lấy từ secret manager, không nằm trong image/repository.
- Migration chạy như release job duy nhất trước API rollout.
- Persistent logs được ship tới log platform.

## 3. Required environment variables

API:

| Variable | Requirement |
|---|---|
| `NODE_ENV=production` | Bật secure refresh cookie |
| `PORT` | API container listen port |
| `DATABASE_URL` | TLS PostgreSQL URL với application user |
| `JWT_ACCESS_SECRET` | Random secret đủ dài, nằm trong secret manager |
| `JWT_ACCESS_TTL` | Khuyến nghị `15m` |
| `REFRESH_TOKEN_TTL_DAYS` | Khuyến nghị 30 hoặc theo security policy |
| `REFRESH_SESSION_CLEANUP_ENABLED` | Production đặt `true` trừ khi dùng external maintenance worker |
| `REFRESH_SESSION_CLEANUP_INTERVAL_MS` | Khoảng chạy, mặc định 6 giờ; tối thiểu 1 phút |
| `REFRESH_SESSION_RETENTION_DAYS` | Số ngày giữ expired/revoked rows để điều tra, mặc định 7 |
| `REFRESH_SESSION_CLEANUP_BATCH_SIZE` | Rows mỗi batch, mặc định 500, cap 5000 |
| `REFRESH_SESSION_CLEANUP_MAX_BATCHES` | Work cap mỗi run, mặc định 10, cap 100 |
| `OUTBOX_WORKER_ENABLED` | Bật worker inbox; production đặt `true` trừ khi deploy worker process riêng |
| `OUTBOX_WORKER_INTERVAL_MS` | Poll interval, mặc định 2000 ms; tối thiểu 250 ms |
| `OUTBOX_WORKER_BATCH_SIZE` | Event mỗi batch, mặc định 100, cap 500 |
| `FRONTEND_URL` | Exact HTTPS Web origin cho CORS |
| `SHIPPING_FEE_PER_SHOP` | Policy phí ship hiện tại |
| `RATE_LIMIT_MAX` | Request/IP/window; tune từ traffic thật |
| `RATE_LIMIT_WINDOW_MS` | Window milliseconds |
| `RATE_LIMIT_STORE` | Production đặt rõ `redis` |
| `RATE_LIMIT_FAILURE_MODE` | `closed` để giữ protection hoặc `open` để ưu tiên availability; phải được security/operations duyệt |
| `RATE_LIMIT_KEY_PREFIX` | Namespace riêng theo app/environment |
| `RATE_LIMIT_REDIS_CONNECT_TIMEOUT_MS` | Timeout ngắn phù hợp network nội bộ, mặc định `1000` ms |
| `REDIS_URL` | TLS/authenticated managed Redis URL cho limiter |
| `TRUST_PROXY_HOPS` | Số reverse proxy đáng tin trước API; `0` khi gọi trực tiếp |
| `BANK_TRANSFER_PROVIDER` | Stable namespace, không đổi sau khi đã nhận event/reference |
| `BANK_TRANSFER_WEBHOOK_SECRET` | HMAC secret tối thiểu 32 ký tự từ secret manager |
| `PAYMENT_WEBHOOK_TOLERANCE_SECONDS` | Replay window, khuyến nghị `300`, tối thiểu `30` |
| `SEPAY_ENV` | `sandbox` khi certification; `production` chỉ sau sign-off |
| `SEPAY_MERCHANT_ID` | Merchant credential từ secret manager |
| `SEPAY_SECRET_KEY` | Merchant API/signing secret; không expose dưới `NEXT_PUBLIC_*` |
| `SEPAY_IPN_SECRET` | Secret khớp cấu hình merchant portal `X-Secret-Key` |
| `SEPAY_PAYMENT_METHOD` | `BANK_TRANSFER` hoặc `NAPAS_BANK_TRANSFER` |
| `SEPAY_RETURN_URL` | Exact HTTPS Web URL `/payments/sepay/return` của environment |
| `DEEPSEEK_API_KEY` | Secret server-side; bắt buộc trước khi shop có thể bật AI chat |
| `DEEPSEEK_BASE_URL` | Mặc định `https://api.deepseek.com`; chỉ đổi qua reviewed provider gateway |
| `DEEPSEEK_MODEL` | Model deploy được phê duyệt; baseline `deepseek-v4-flash` |
| `DEEPSEEK_TIMEOUT_MS` | Outbound timeout 1-60 giây; baseline `20000` |

Web:

| Variable | Requirement |
|---|---|
| `NODE_ENV=production` | Next production mode |
| `NEXT_PUBLIC_API_URL` | Public HTTPS URL có `/api` prefix |

Infrastructure/future integrations:

- `RABBITMQ_URL` khi publish/consume events.
- SePay IPN URL phải là public HTTPS `POST <API_ORIGIN>/api/payments/webhooks/sepay`; localhost chỉ dùng qua tunnel trong sandbox.
- Trước production, test hosted success/cancel/error, delayed/duplicate IPN, return-before-IPN, exact amount và retry từ Orders với một merchant sandbox riêng.
- Automated SePay refund chưa được hỗ trợ và bị API reject; không quảng bá refund tự động trước khi có outbound/provider runbook đã duyệt.

Không log các biến secret.

Chat production checks:

- Load balancer hỗ trợ WebSocket upgrade; polling phải vẫn hoạt động khi upgrade thất bại.
- Một API replica chỉ là baseline hiện tại. Nếu nhiều replica, không rollout trước khi Socket.IO có Redis adapter hoặc transport được thay bằng managed realtime bus.
- Alert khi source chat message ở `ai_status=PENDING` quá SLA; worker/recovery job chưa có trong baseline single-process.
- DeepSeek outbound egress chỉ cho HTTPS tới allowlist; log status/latency/model/message ID nhưng không log key, system prompt hay toàn bộ nội dung riêng tư.
- AI phải được bật có chủ đích theo shop sau khi staging kiểm tra catalog grounding; không bulk-enable bằng migration.

## 4. CI quality gate

Workflow `.github/workflows/ci.yml` chạy với PostgreSQL và Redis service:

1. `npm ci` và audit production dependency với high threshold.
2. Prisma Client generation.
3. Migrations trên PostgreSQL 16 service.
4. API/Web lint.
5. API unit/integration và Web session/CSP unit tests.
6. Auth + full commerce/payment/notification e2e.
7. API/Web production builds.

Không deploy commit có CI đỏ. Branch protection nên yêu cầu workflow `CI / verify` pass trước merge vào `main`.

## 5. Build artifact

Deployable images đã được định nghĩa tại `apps/api/Dockerfile` và `apps/web/Dockerfile`, chạy non-root và dùng repository root làm build context:

```bash
docker build -f apps/api/Dockerfile -t intern-project-api:release .
docker build -f apps/web/Dockerfile \
  --build-arg NEXT_PUBLIC_API_URL=https://api.example.com/api \
  -t intern-project-web:release .
```

API build:

```bash
npm ci
npm run prisma:generate -w @intern-project/api
npm run build -w @intern-project/api
```

Runtime API cần:

- Root production dependencies hoặc pruned workspace dependencies.
- `apps/api/dist`.
- Generated Prisma Client/native engine tương ứng target OS.
- `apps/api/prisma/migrations` để release job migrate.

API start:

```bash
npm run start -w @intern-project/api
```

Web build:

```bash
NEXT_PUBLIC_API_URL=https://api.example.com/api npm run build -w @intern-project/web
```

Web start:

```bash
npm run start -w @intern-project/web
```

`NEXT_PUBLIC_*` được bake vào client bundle khi build. Đổi API URL yêu cầu rebuild Web.

## 6. Pre-deployment checklist

- Release commit đã review và CI xanh.
- Changelog/phạm vi release rõ.
- Migration SQL đã review.
- Đã kiểm tra migration có lock/rewrite table lớn không.
- Có backup/snapshot database mới và biết restore location.
- Staging đã chạy cùng migration và full smoke flow.
- Secret/config đã tồn tại ở target environment.
- `FRONTEND_URL` và `NEXT_PUBLIC_API_URL` dùng HTTPS đúng domain.
- Capacity PostgreSQL connection/storage/CPU đủ.
- Redis endpoint/TLS/auth hoạt động, memory/connection capacity đủ và eviction policy không xóa limiter keys ngoài dự kiến.
- `RATE_LIMIT_FAILURE_MODE` đã được chọn có chủ đích; không dựa vào fallback mặc định.
- Refresh-session cleanup retention/batch/interval đã phù hợp traffic và support investigation window.
- Outbox worker interval/batch, failed-event alert và retention expectation đã được duyệt.
- Web response CSP `connect-src` chứa đúng production API origin, không có staging/localhost origin.
- On-call và rollback owner được thông báo.
- Không có maintenance/incident đang diễn ra.

## 7. Deployment order

### 7.1 Backup

Tạo managed snapshot hoặc `pg_dump` nhất quán trước migration có rủi ro. Ghi lại timestamp và restore identifier trong release ticket.

### 7.2 Run migration once

Từ artifact cùng commit sắp deploy:

```bash
cd apps/api
npx prisma migrate status
npx prisma migrate deploy
```

Không chạy `prisma migrate dev` hoặc `db push` ở production.

Sau migration:

```bash
npx prisma migrate status
```

Phải báo database up to date.

### 7.3 Deploy API

1. Deploy new API instances với readiness chưa nhận traffic nếu platform hỗ trợ.
2. Start `node dist/main` thông qua workspace start script.
3. Probe `/api/health`.
4. Chuyển traffic dần.
5. Theo dõi 5xx, latency, DB errors, memory.

Mọi API replica phải dùng cùng `REDIS_URL`, `RATE_LIMIT_KEY_PREFIX`, max/window và failure mode. Nếu cấu hình khác nhau, quota/behavior giữa replicas sẽ không nhất quán.

### 7.4 Deploy Web

1. Build đúng production API URL.
2. Deploy Next.js artifact.
3. Verify home/login/static assets.
4. Kiểm tra browser CORS/cookie.

### 7.5 Staging workflow và rollback ref

`.github/workflows/staging-release.yml` build/push immutable images lên GHCR, migrate một lần, gọi rollout webhook và chạy post-deploy smoke/load. GitHub Environment `staging` cần:

- secret `STAGING_DATABASE_URL`;
- secret `STAGING_DEPLOY_WEBHOOK_URL` và `STAGING_DEPLOY_WEBHOOK_TOKEN`;
- variable `STAGING_API_URL` có `/api` suffix.

Dispatch bằng exact `release_ref`. Khi rollback application, dispatch lại ref đã biết tốt; không reverse migration tự động. Hosting webhook phải rollout atomically hoặc canary và chỉ trả success khi deployment nhận image references.

## 8. Health and smoke checks

### 8.1 Health

```bash
curl -i https://api.example.com/api/health
```

Expected:

- HTTP 200.
- `x-request-id` response header.
- Security headers `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`.

Readiness có database ping:

```bash
curl -i https://api.example.com/api/health/ready
```

Expected HTTP 200, `status=ready`, `database=up`, `rateLimit.store=redis`, `rateLimit.status=up`. Load balancer nên dùng `/api/health` cho liveness và `/api/health/ready` cho readiness.

Nếu Redis down:

- fail-closed: readiness trả 503 vì business request cũng sẽ trả `RATE_LIMIT_UNAVAILABLE`.
- fail-open: readiness trả 200 với `status=ready_degraded`; traffic tiếp tục nhưng response được đánh dấu `X-RateLimit-Policy: bypass`.

### 8.2 Public catalog

```bash
curl -i https://api.example.com/api/products
```

Expected 200 và structured pagination.

Smoke tự động tương đương:

```bash
API_BASE_URL=https://api.example.com/api npm run smoke:api
LOAD_URL=https://api.example.com/api/health \
  LOAD_REQUESTS=500 LOAD_CONCURRENCY=25 LOAD_MAX_P95_MS=1500 \
  npm run load:smoke
```

Load smoke là bounded regression gate, không thay soak/capacity test theo traffic thật.

### 8.3 Auth smoke

- Login bằng staging smoke account.
- Xác nhận access token response.
- Xác nhận refresh cookie có `HttpOnly`, `Secure`, `SameSite=Lax`, đúng path.
- Gọi protected `/api/users/me`.
- Refresh token một lần; token cũ phải bị reject nếu reuse.
- Reload protected page: access token memory mất nhưng HttpOnly cookie phải khôi phục session qua đúng một refresh request.
- Browser localStorage không còn key `intern-commerce-session` sau login/reload.
- Logout; refresh token vừa logout phải bị reject.

### 8.4 Commerce smoke

Trên staging hoặc production test tenant được phép:

1. Product ACTIVE của approved shop xuất hiện.
2. Add một item vào cart.
3. Quote trả totals hợp lệ.
4. Checkout COD với idempotency key.
5. Retry cùng key trả cùng order ID.
6. Vendor confirm/pack/ready/deliver.
7. Customer thấy COMPLETED sau polling.
8. Customer review delivered OrderItem.
9. Inventory ledger có reserve và sold entries.
10. Customer/vendor inbox nhận đúng order/status event; mark-read của một account không ảnh hưởng account khác.

Không chạy destructive/cancel/refund smoke trên order thật của customer.

### 8.5 Refund smoke

Trên order fixture của staging:

1. COD refund không có `confirmOfflineRefund=true` phải bị reject.
2. COD có explicit confirmation tạo SUCCEEDED refund, cập nhật payment partial/full và customer order thấy record.
3. Bank transfer refund tạo PENDING/REFUND_PENDING và chỉ callback signed mới kết thúc.
4. Retry cùng idempotency key/payload trả cùng refund; khác payload trả conflict.
5. Tổng successful refund không vượt payment amount.

### 8.6 Payment webhook smoke

Chỉ chạy trên staging payment fixture:

1. Gửi exact raw JSON với timestamp hiện tại và HMAC `sha256(secret, timestamp + "." + rawBody)`.
2. Callback success trả `200`, Payment/ParentOrder thành `PAID` và có hai history rows khi đi từ `UNPAID`.
3. Gửi lại exact event trả `duplicate: true`; `payment_webhook_events` vẫn chỉ một row.
4. Cùng event ID nhưng payload khác trả `409`.
5. Signature sai hoặc timestamp ngoài tolerance trả `401` và không tạo event/payment mutation.
6. Với refund fixture, amount vượt remaining refundable phải trả `400` trước khi gọi provider.

Không dùng production secret trong local script/log/shell history. Provider-specific sandbox phải có secret riêng staging.

## 9. Observability

### 9.1 Request ID

API chấp nhận `x-request-id` an toàn từ upstream hoặc tự sinh UUID. Header được trả về và nằm trong structured logs/errors.

Reverse proxy nên forward `x-request-id`. Support team yêu cầu customer cung cấp request ID khi báo lỗi.

### 9.2 HTTP logs

Mỗi request ghi event `http_request` gồm:

- request ID.
- method/path.
- status code.
- duration milliseconds.
- authenticated user ID/role nếu có.

Không log Authorization, cookie, password, request body hoặc payment raw payload.

### 9.3 Error shape

Expected:

```json
{
  "statusCode": 400,
  "code": "BAD_REQUEST",
  "message": "Actionable message",
  "requestId": "uuid",
  "timestamp": "ISO-8601",
  "path": "/api/..."
}
```

Unknown 500 trả message generic; stack chỉ ở server log.

### 9.4 Initial alerts

Thiết lập cảnh báo baseline rồi tune theo traffic:

- 5xx rate > 1% trong 5 phút.
- p95 API latency > 1 giây trong 10 phút.
- PostgreSQL connections > 80% pool/server limit.
- Database CPU/storage > 80%.
- Redis memory/connections > 80%, evictions > 0 hoặc ping latency/error tăng.
- Process restart loop hoặc memory tăng liên tục.
- 429 tăng bất thường.
- `rate_limit_store_error`, `RATE_LIMIT_UNAVAILABLE` hoặc `X-RateLimit-Policy=bypass` xuất hiện.
- `refresh_session_cleanup_error` lặp lại hoặc bảng `refresh_sessions` tăng liên tục ngoài retention expectation.
- Checkout conflict/insufficient stock spike bất thường.
- Outbox PENDING age/count tăng liên tục, FAILED count > 0 hoặc `outbox_worker_error` lặp lại.

## 10. Rate limiting

Current default: 300 requests/IP/60 giây, health và OPTIONS được bỏ qua. Production dùng Redis Lua atomic counter để mọi API replica chia sẻ cùng quota.

Response headers:

- `X-RateLimit-Limit`.
- `X-RateLimit-Remaining`.
- `X-RateLimit-Reset`.
- `X-RateLimit-Policy`: `enforced` khi Redis/memory store quyết định quota, `bypass` khi fail-open.
- `Retry-After` khi 429.

Nếu chạy sau reverse proxy, cấu hình trusted proxy chính xác để `request.ip` không trở thành IP của proxy hoặc tin mù `X-Forwarded-For` do client giả.

Khuyến nghị production:

- `RATE_LIMIT_STORE=redis`.
- `RATE_LIMIT_FAILURE_MODE=closed` nếu abuse protection là bắt buộc; nếu chọn `open`, phải có alert và khả năng bật protection ở gateway khi Redis outage.
- Prefix khác nhau giữa production/staging/test.
- Managed Redis không public internet, có TLS/auth, HA và không dùng chung eviction-sensitive cache nếu chưa có capacity policy.

Memory store chỉ dành cho local/unit; không dùng để enforce quota toàn cluster. Fixed window có thể burst ở ranh giới window; cân nhắc gateway token bucket/sliding window nếu traffic thực tế yêu cầu.

## 11. Database safety and backup

- Bật automated backups và point-in-time recovery theo khả năng provider.
- Mã hóa at rest/in transit.
- Application DB user không có quyền superuser/create database.
- Migration user có thể tách riêng nếu policy yêu cầu.
- Diễn tập restore định kỳ; backup chưa test restore không được xem là backup đáng tin.
- Theo dõi slow queries, lock waits, table/index growth.

Repository có guarded drill script. Restore target bị overwrite và phải là database riêng:

```bash
SOURCE_DATABASE_URL='postgresql://.../source' \
RESTORE_DATABASE_URL='postgresql://.../restore_drill' \
BACKUP_RESTORE_CONFIRM=restore-target-may-be-overwritten \
npm run drill:backup-restore
```

`.github/workflows/operational-drills.yml` tự tạo target riêng, migrate/seed, smoke/load, dump/restore/verify rồi build images. Weekly schedule không thay managed backup/PITR; nó kiểm chứng công cụ và procedure.

Refresh-session maintenance:

- Mỗi API replica có timer nhưng PostgreSQL transaction advisory lock chỉ cho một cleanup run thực thi.
- Job giữ expired/revoked rows trong retention window rồi xóa theo bounded batch; không xóa active rows.
- Nếu backlog lớn hơn `batchSize * maxBatches`, để các interval sau drain dần hoặc tăng cap có review; không chạy unbounded `DELETE` giờ cao điểm.
- Theo dõi số row theo `expires_at`/`revoked_at`, autovacuum/bloat và cleanup error. Cleanup lỗi không làm API startup fail.
- Không xóa trực tiếp session gần đây đang cần cho security investigation nếu chưa export evidence theo policy.

Core invariant audit queries nên được chuẩn bị cho:

- `reserved > on_hand`.
- Order total khác sum shop totals/payment amount.
- Inventory write thiếu ledger reference.
- Duplicate provider reference/payment callback trong tương lai.

## 12. Rollback

### 12.1 Application-only rollback

Nếu schema backward-compatible:

1. Dừng rollout.
2. Chuyển traffic về artifact version trước.
3. Verify health/smoke.
4. Giữ database migration mới nếu code cũ tương thích.

### 12.2 Migration problem

Prisma migrations không tự động down migration. Không sửa/xóa migration history đã apply.

Ưu tiên:

1. Dừng traffic/write bị ảnh hưởng.
2. Tạo forward-fix migration.
3. Nếu data corruption nghiêm trọng, restore snapshot theo incident commander quyết định.
4. Reconcile orders/payments/inventory tạo trong khoảng sự cố.

Không chạy SQL rollback ad-hoc khi chưa có backup và review.

## 13. Incident playbooks

### 13.1 Elevated 5xx

1. Lấy request IDs mẫu.
2. Nhóm theo path/code/deployment version.
3. Kiểm tra DB connectivity/migration status.
4. Nếu bắt đầu ngay sau deploy, rollback app khi backward-compatible.
5. Nếu checkout/payment, dừng retry automation có thể làm tăng tác động.

### 13.2 Checkout failures/conflicts

1. Phân biệt 400 stock/coupon hợp lệ, 409 concurrency, 500 internal.
2. Query ParentOrder bằng user + idempotency key trước khi yêu cầu customer retry.
3. Kiểm tra cart, inventory và ledger trong cùng timeline.
4. Không tạo order thủ công để “bù” nếu chưa reconcile idempotency/payment.

### 13.3 Inventory inconsistency

1. Tạm khóa product khỏi public bằng DRAFT nếu có nguy cơ oversell.
2. So sánh inventory với ledger/order items.
3. Không overwrite stock trực tiếp.
4. Repair bằng audited adjustment/repair migration được review.
5. Viết regression test cho nguyên nhân gốc.

### 13.4 Payment mismatch

1. Không tự mark PAID chỉ dựa vào screenshot/customer message.
2. Kiểm tra amount, provider reference và order ID.
3. Giữ fulfillment/payment state tách biệt.
4. Tìm event theo unique `(provider,event_id)`, so payload hash, amount và provider reference.
5. Nếu callback hợp lệ bị timeout, provider có thể retry exact event; không sửa Payment/Refund trực tiếp để né replay guard.
6. Khi có provider API adapter, reconciliation chỉ xác minh/bù event thiếu qua cùng state machine.

### 13.5 Refresh/auth incident

1. Nếu secret lộ: rotate secret và buộc access JWT cũ hết hiệu lực.
2. Revoke RefreshSessions bị ảnh hưởng.
3. Kiểm tra logs không chứa token/cookie.
4. Thông báo user theo incident/security policy.

### 13.6 Redis/rate-limiter incident

1. Kiểm tra `/api/health/ready`, Redis provider health, network/TLS/auth và event `rate_limit_store_error` theo cùng deployment window.
2. Xác định policy hiện tại: fail-closed sẽ rút replica khỏi readiness/trả 503; fail-open vẫn nhận traffic nhưng không enforce application quota.
3. Không đổi sang memory khi có nhiều replica: mỗi process sẽ có quota riêng và tạo cảm giác bảo vệ sai.
4. Nếu availability bắt buộc và security owner chấp thuận, tạm chuyển fail-open bằng config rollout đồng nhất cho mọi replica, đồng thời bật/tăng gateway protection và alert bypass traffic.
5. Nếu protection bắt buộc, giữ fail-closed, phục hồi/failover Redis rồi verify Lua quota bằng nhiều API replicas trước khi mở traffic hoàn toàn.
6. Sau phục hồi, theo dõi Redis evictions/memory/latency, 429/503 và ghi rõ khoảng thời gian traffic từng bypass hoặc unavailable.

### 13.7 Refresh-session cleanup incident

1. Tìm event `refresh_session_cleanup_error`, kiểm tra migration/schema, DB permissions, lock/statement timeout và connection pressure.
2. Query số terminal rows cũ hơn retention để xác định backlog; không suy luận chỉ từ tổng row count vì active/recent rows phải được giữ.
3. Xác minh một transaction có advisory lock; nhiều replica bỏ qua do không lấy được lock là behavior bình thường, không phải lỗi.
4. Nếu cần drain backlog, tăng batch/max-batches từng bước trong maintenance window và theo dõi locks, WAL, replication lag, autovacuum.
5. Không giảm retention khẩn cấp khi security/support đang điều tra session reuse nếu chưa có approval và evidence export.

### 13.8 Notification outbox incident

1. Kiểm tra `outbox_worker_error`, PENDING oldest age, FAILED count và database connection/locks.
2. FAILED do payload invalid phải được điều tra theo aggregate/event ID; không đổi tay sang PROCESSED nếu chưa tạo inbox record đúng.
3. PENDING do outage sẽ retry; xác minh nhiều replica dùng `SKIP LOCKED` và unique `outboxEventId`, không chạy script insert Notification không idempotent.
4. Có thể tăng batch/giảm interval tạm thời trong giới hạn config sau khi DB capacity được kiểm tra.
5. Nếu inbox chậm nhưng order/payment transaction đã commit, không rollback business transaction; thông báo support bằng order state nguồn sự thật rồi drain outbox.

## 14. Security checklist

- TLS/HSTS tại reverse proxy.
- Production JWT secret không dùng fallback.
- Refresh cookie Secure/HttpOnly.
- Exact CORS origin, không wildcard với credentials.
- Access token chỉ ở memory; refresh token HttpOnly; legacy localStorage key bị xóa.
- CSP/API `connect-src` allowlist và browser security headers được smoke-test sau deploy; không mở wildcard cho widget mới.
- Dependency audit trong release cadence.
- Outbox payload không chứa secret/raw financial data; failed rows có alert và được giữ để điều tra.
- DB/network least privilege.
- Redis không public, dùng TLS/auth/least privilege; production prefix và outage policy được cấu hình rõ.
- Admin account MFA/SSO khi identity provider được bổ sung.
- Webhook secret tối thiểu 32 ký tự, exact raw-body HMAC, timestamp window, replay/idempotency tests đều pass.
- Không đưa `.env`, dumps, logs có PII/token vào Git/artifact.

## 15. Release completion checklist

- Migration status up to date.
- API/Web version đúng release commit.
- Health/public/auth/commerce smoke pass.
- 5xx/latency/DB metrics ổn trong observation window.
- Không có unexpected 429/CORS/cookie failure.
- Protected-page reload refreshes once, localStorage remains token-free và Web CSP header có đúng API origin.
- Notification worker drain bình thường; không có FAILED event hoặc PENDING quá SLA.
- Production dependency audit không có high/critical advisory.
- Readiness xác nhận Redis limiter up; nếu deliberate fail-open degraded thì release ticket phải ghi exception và alert/compensating gateway control.
- Release ticket ghi commit, migration, deploy time, operator, backup ID.
- Known gaps/risk được ghi vào `docs/project_context.md`.
- Nếu behavior thay đổi, `docs/codebase-handbook.md` đã cập nhật.
