# Huong Dan Chay Du An

## Yeu cau

- Node.js 20+
- npm 10+
- Docker Desktop hoac Docker Engine

## 1. Tao file moi truong

```bash
cd /Users/kietnt/Documents/intern_project
cp .env.example .env
```

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
```

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
  -d '{"email":"vendor@example.com","password":"password123","fullName":"Vendor Demo","role":"VENDOR"}'
```

Login:

```bash
curl -X POST http://localhost:3005/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"vendor@example.com","password":"password123"}'
```

Dung `accessToken` tra ve lam Bearer token cho cac API vendor/admin.

## 7. Dung du an

```bash
docker compose down
```

Khong them `-v` neu muon giu data Postgres local.
