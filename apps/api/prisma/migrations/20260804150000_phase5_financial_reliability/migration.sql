-- Add explicit partial-refund state without rewriting historical payment rows.
ALTER TYPE "PaymentStatus" ADD VALUE 'PARTIALLY_REFUNDED';

CREATE TYPE "RefundStatus" AS ENUM ('PENDING', 'SUCCEEDED', 'FAILED');
CREATE TYPE "PaymentWebhookType" AS ENUM (
    'PAYMENT_SUCCEEDED',
    'PAYMENT_FAILED',
    'REFUND_SUCCEEDED',
    'REFUND_FAILED'
);

-- Provider references are financial idempotency keys and must be unique per provider.
DROP INDEX "payments_provider_ref_idx";
CREATE UNIQUE INDEX "payments_provider_provider_ref_key"
ON "payments"("provider", "provider_ref");

CREATE TABLE "refunds" (
    "id" UUID NOT NULL,
    "payment_id" UUID NOT NULL,
    "requested_by_id" UUID NOT NULL,
    "idempotency_key" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "status" "RefundStatus" NOT NULL DEFAULT 'PENDING',
    "reason" TEXT,
    "provider" TEXT,
    "provider_ref" TEXT,
    "failure_reason" TEXT,
    "refunded_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "refunds_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "refund_status_history" (
    "id" UUID NOT NULL,
    "refund_id" UUID NOT NULL,
    "from_status" "RefundStatus",
    "to_status" "RefundStatus" NOT NULL,
    "actor_id" UUID,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refund_status_history_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "payment_webhook_events" (
    "id" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "type" "PaymentWebhookType" NOT NULL,
    "payload_hash" CHAR(64) NOT NULL,
    "payment_id" UUID NOT NULL,
    "refund_id" UUID,
    "processed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_webhook_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "refunds_payment_id_created_at_idx"
ON "refunds"("payment_id", "created_at");

CREATE UNIQUE INDEX "refunds_payment_id_idempotency_key_key"
ON "refunds"("payment_id", "idempotency_key");

CREATE UNIQUE INDEX "refunds_provider_provider_ref_key"
ON "refunds"("provider", "provider_ref");

CREATE INDEX "refund_status_history_refund_id_created_at_idx"
ON "refund_status_history"("refund_id", "created_at");

CREATE INDEX "payment_webhook_events_payment_id_created_at_idx"
ON "payment_webhook_events"("payment_id", "created_at");

CREATE INDEX "payment_webhook_events_refund_id_idx"
ON "payment_webhook_events"("refund_id");

CREATE UNIQUE INDEX "payment_webhook_events_provider_event_id_key"
ON "payment_webhook_events"("provider", "event_id");

ALTER TABLE "refunds"
ADD CONSTRAINT "refunds_payment_id_fkey"
FOREIGN KEY ("payment_id") REFERENCES "payments"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "refunds"
ADD CONSTRAINT "refunds_requested_by_id_fkey"
FOREIGN KEY ("requested_by_id") REFERENCES "users"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "refund_status_history"
ADD CONSTRAINT "refund_status_history_refund_id_fkey"
FOREIGN KEY ("refund_id") REFERENCES "refunds"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "payment_webhook_events"
ADD CONSTRAINT "payment_webhook_events_payment_id_fkey"
FOREIGN KEY ("payment_id") REFERENCES "payments"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "payment_webhook_events"
ADD CONSTRAINT "payment_webhook_events_refund_id_fkey"
FOREIGN KEY ("refund_id") REFERENCES "refunds"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
