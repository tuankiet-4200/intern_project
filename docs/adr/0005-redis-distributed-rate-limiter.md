# ADR 0005: Redis-Backed Distributed Rate Limiter

Date: 2026-08-05

Status: accepted

## Context

The original fixed-window rate limiter stored counters in one NestJS process. Two API replicas therefore enforced two independent quotas, and restarting a replica erased its counters. This was acceptable as a Phase 4 single-process baseline but unsafe as cluster-wide protection.

Redis is already part of the local infrastructure. Request protection needs one atomic shared decision, an explicit answer for Redis outages, and readiness behavior that matches that decision.

## Decision

- Keep the limiter at the NestJS HTTP boundary and inject it as an application provider so lifecycle cleanup and readiness use the same store instance.
- Use Redis as the production store and retain the memory store only as an explicit local/unit option.
- Execute `INCR`, first-write `PEXPIRE` and `PTTL` in one Lua script so concurrent replicas share one fixed-window counter without a read/write race.
- Hash the resolved client IP with SHA-256 before placing it in a Redis key and isolate environments with `RATE_LIMIT_KEY_PREFIX`.
- Preserve health/OPTIONS bypass and standard quota headers; add `X-RateLimit-Policy` to distinguish enforced from fail-open bypassed traffic.
- Support `RATE_LIMIT_FAILURE_MODE=closed` for strict production protection and `open` only as an explicit availability trade-off.
- Return structured 503 responses when fail-closed Redis access fails. Fail-open traffic proceeds and is marked `bypass`.
- Include the limiter store in readiness. A closed-policy outage rejects readiness; an open-policy outage reports `ready_degraded`.
- Verify behavior with unit tests, two independent middleware instances and a four-instance concurrent load test against real Redis.

## Consequences

Positive:

- Every API replica consumes the same quota and restarts do not reset a client's cluster-wide counter.
- The Lua operation prevents admitted traffic from exceeding the configured quota under application-level concurrency.
- Operators can observe whether traffic is protected, bypassed or unavailable.
- Production rollout can keep multiple replicas without delegating rate limiting to a gateway first.

Trade-offs:

- With fail-closed policy, Redis becomes a critical dependency and requires high availability, capacity alarms and an outage playbook.
- Fail-open protects availability but temporarily removes this application-layer abuse control; it must be a deliberate production decision.
- A fixed window can permit bursts around a window boundary. A gateway token bucket/sliding window remains a possible future replacement if traffic data justifies it.
- Correct `TRUST_PROXY_HOPS` configuration remains required; a distributed counter cannot repair an incorrectly resolved client IP.
