-- Preserve historical WELCOME10 usages while removing it from customer discovery.
UPDATE "coupons"
SET "is_active" = false,
    "updated_at" = CURRENT_TIMESTAMP
WHERE "code" = 'WELCOME10';

-- Use a new code because coupon economic terms are immutable after first usage.
INSERT INTO "coupons" (
    "id",
    "code",
    "scope",
    "type",
    "value",
    "is_active",
    "created_at",
    "updated_at"
)
VALUES (
    '7e7c22e8-12f8-4f21-a45c-5ba8b3f625e2',
    'WELCOME2K',
    'GLOBAL',
    'FIXED_AMOUNT',
    2000.00,
    true,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
)
ON CONFLICT ("code") DO UPDATE
SET "is_active" = true,
    "updated_at" = CURRENT_TIMESTAMP;
