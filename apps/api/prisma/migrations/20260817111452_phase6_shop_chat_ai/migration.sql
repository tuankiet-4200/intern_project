-- CreateEnum
CREATE TYPE "ChatSenderType" AS ENUM ('CUSTOMER', 'SHOP', 'AI');

-- CreateEnum
CREATE TYPE "ChatAiStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED');

-- AlterTable
ALTER TABLE "shops" ADD COLUMN     "ai_chat_enabled" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "chat_conversations" (
    "id" UUID NOT NULL,
    "shop_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "customer_last_read_at" TIMESTAMP(3),
    "shop_last_read_at" TIMESTAMP(3),
    "last_message_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "chat_conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_messages" (
    "id" UUID NOT NULL,
    "conversation_id" UUID NOT NULL,
    "sender_user_id" UUID,
    "sender_type" "ChatSenderType" NOT NULL,
    "content" TEXT NOT NULL,
    "client_message_id" UUID,
    "reply_to_message_id" UUID,
    "ai_status" "ChatAiStatus",
    "ai_model" TEXT,
    "ai_prompt_tokens" INTEGER,
    "ai_completion_tokens" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "chat_conversations_customer_id_last_message_at_idx" ON "chat_conversations"("customer_id", "last_message_at");

-- CreateIndex
CREATE INDEX "chat_conversations_shop_id_last_message_at_idx" ON "chat_conversations"("shop_id", "last_message_at");

-- CreateIndex
CREATE UNIQUE INDEX "chat_conversations_shop_id_customer_id_key" ON "chat_conversations"("shop_id", "customer_id");

-- CreateIndex
CREATE UNIQUE INDEX "chat_messages_reply_to_message_id_key" ON "chat_messages"("reply_to_message_id");

-- CreateIndex
CREATE INDEX "chat_messages_conversation_id_created_at_id_idx" ON "chat_messages"("conversation_id", "created_at", "id");

-- CreateIndex
CREATE INDEX "chat_messages_sender_user_id_idx" ON "chat_messages"("sender_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "chat_messages_conversation_id_client_message_id_key" ON "chat_messages"("conversation_id", "client_message_id");

-- AddForeignKey
ALTER TABLE "chat_conversations" ADD CONSTRAINT "chat_conversations_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "shops"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_conversations" ADD CONSTRAINT "chat_conversations_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "chat_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_sender_user_id_fkey" FOREIGN KEY ("sender_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_reply_to_message_id_fkey" FOREIGN KEY ("reply_to_message_id") REFERENCES "chat_messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;
