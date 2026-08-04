ALTER TABLE "coupons"
ADD COLUMN "per_user_limit" INTEGER,
ADD COLUMN "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX "coupon_usages_coupon_id_user_id_idx"
ON "coupon_usages"("coupon_id", "user_id");

ALTER TABLE "coupons"
ADD CONSTRAINT "coupons_usage_limit_positive_check"
CHECK ("usage_limit" IS NULL OR "usage_limit" > 0),
ADD CONSTRAINT "coupons_per_user_limit_positive_check"
CHECK ("per_user_limit" IS NULL OR "per_user_limit" > 0),
ADD CONSTRAINT "coupons_used_count_non_negative_check"
CHECK ("used_count" >= 0),
ADD CONSTRAINT "coupons_limit_consistency_check"
CHECK ("usage_limit" IS NULL OR "per_user_limit" IS NULL OR "per_user_limit" <= "usage_limit");
