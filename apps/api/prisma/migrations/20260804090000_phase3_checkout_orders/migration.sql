-- Make checkout idempotency keys unique per customer and persist request fingerprints.
DROP INDEX "parent_orders_idempotency_key_key";

ALTER TABLE "parent_orders"
ADD COLUMN "checkout_fingerprint" CHAR(64);

CREATE UNIQUE INDEX "parent_orders_user_id_idempotency_key_key"
ON "parent_orders"("user_id", "idempotency_key");

-- Keep an append-only audit trail for payment state changes.
CREATE TABLE "payment_status_history" (
    "id" UUID NOT NULL,
    "payment_id" UUID NOT NULL,
    "from_status" "PaymentStatus" NOT NULL,
    "to_status" "PaymentStatus" NOT NULL,
    "actor_id" UUID,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_status_history_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "payment_status_history_payment_id_created_at_idx"
ON "payment_status_history"("payment_id", "created_at");

ALTER TABLE "payment_status_history"
ADD CONSTRAINT "payment_status_history_payment_id_fkey"
FOREIGN KEY ("payment_id") REFERENCES "payments"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
