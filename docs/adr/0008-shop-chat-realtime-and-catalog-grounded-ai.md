# ADR 0008: Shop Chat Realtime and Catalog-Grounded AI

- Status: Accepted
- Date: 2026-08-17

## Context

Customers need to contact the exact selling shop from product detail, while vendors need a Messenger-like inbox and an optional AI first responder. Messages must survive refresh/reconnect, retries must not duplicate them, shop ownership must be enforced server-side, and the DeepSeek credential must never reach the browser. AI advice must be limited to the target shop's real catalog rather than general model knowledge.

## Decision

1. Keep Chat as a NestJS bounded module inside the modular monolith.
2. Persist one `ChatConversation` per `(shopId, customerId)` and append `ChatMessage` rows for CUSTOMER, SHOP and AI senders.
3. Use REST as the durable command/query path and Socket.IO rooms as a low-latency delivery channel. The Web client polls every five seconds as a convergence fallback.
4. Authenticate sockets with the access JWT, re-read account status, and authorize every room join against conversation participants/current shop owner.
5. Require a client UUID per human message and enforce `(conversationId, clientMessageId)` uniqueness.
6. Keep AI off by default per shop. Only the current shop owner may enable it and only when `DEEPSEEK_API_KEY` exists on the API server.
7. Call DeepSeek from the backend using its OpenAI-compatible chat-completions contract. Build a system prompt from only the target shop and at most 60 of its ACTIVE products, computed available stock and 20 recent messages.
8. Save the customer message before generation. Track the source as PENDING/COMPLETED/FAILED and create at most one AI reply through a unique `replyToMessageId`.

## Consequences

Positive:

- Message persistence and REST retries remain correct even when realtime transport is unavailable.
- Database uniqueness gives deterministic conversation/message idempotency.
- Vendor isolation and provider-secret boundaries are enforceable at the API layer.
- Catalog context is explicit, testable and scoped to one shop.

Trade-offs:

- Socket.IO room state is process-local; horizontal API scaling requires a Redis adapter and compatible load-balancer configuration.
- AI generation is currently best-effort inside the API process; a restart can leave PENDING work and production scale requires a durable worker/recovery job.
- A 60-product prompt is sufficient for the current demo but larger catalogs require retrieval/ranking.
- Model output is constrained but not mathematically guaranteed; the UI must identify AI answers and users need a human-shop path.

## Rejected Alternatives

- Browser-to-DeepSeek calls: rejected because they expose credentials and bypass shop/catalog authorization.
- WebSocket-only commands/history: rejected because reconnect/retry/idempotency and observability are easier with a durable REST path.
- One global marketplace bot: rejected because it risks cross-shop catalog leakage and unclear commercial responsibility.
- Auto-enable AI for all shops: rejected because secret/config readiness and vendor consent must be explicit.
