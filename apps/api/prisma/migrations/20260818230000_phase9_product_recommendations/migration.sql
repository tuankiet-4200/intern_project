-- Aggregate repeated signals instead of retaining an unbounded clickstream.
CREATE TYPE "InteractionType" AS ENUM ('VIEW', 'WISHLIST', 'ADD_TO_CART', 'PURCHASE');

CREATE TABLE "user_interactions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "type" "InteractionType" NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 1,
    "last_interacted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_interactions_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "user_interactions_count_positive_check" CHECK ("count" > 0)
);

CREATE UNIQUE INDEX "user_interactions_user_id_product_id_type_key"
ON "user_interactions"("user_id", "product_id", "type");

CREATE INDEX "user_interactions_user_id_last_interacted_at_idx"
ON "user_interactions"("user_id", "last_interacted_at");

CREATE INDEX "user_interactions_product_id_type_last_interacted_at_idx"
ON "user_interactions"("product_id", "type", "last_interacted_at");

ALTER TABLE "user_interactions"
ADD CONSTRAINT "user_interactions_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "user_interactions"
ADD CONSTRAINT "user_interactions_product_id_fkey"
FOREIGN KEY ("product_id") REFERENCES "products"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
