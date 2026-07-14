# BYK RoadRescue — API Contracts (Summary)

Full typed DTOs live in `packages/shared-types/api-contracts.ts` (imported by both
`apps/web` and backend `services/*` so request/response shapes can never drift
between client and server). This file is the human-readable index.

## REST endpoints

| Method | Path | Purpose | Auth | Idempotent? |
|---|---|---|---|---|
| `POST` | `/api/jobs` | Customer creates a rescue request | Customer JWT | Yes — `idempotencyKey` required |
| `GET` | `/api/jobs/:jobId` | Fetch job snapshot (used by fallback polling) | Any party on the job | N/A (read) |
| `POST` | `/api/jobs/:jobId/offers/:offerId/respond` | Technician accepts/rejects an offer | Technician JWT | Yes — offer id is one-shot |
| `POST` | `/api/jobs/:jobId/complete` | OTP-gated job completion | Technician JWT | No — OTP single-use enforces this |
| `POST` | `/api/jobs/:jobId/reassign` | Dispatcher manual override | Dispatcher JWT | Yes — `expectedJobVersion` guards races |
| `GET` | `/api/dispatch/queue` | Live incident queue for dispatcher dashboard | Dispatcher JWT | N/A (read) |
| `GET` | `/api/admin/kpis` | Aggregate ops KPIs | Admin JWT | N/A (read) |
| `POST` | `/api/payments/:jobId/capture` | Trigger payment capture post-completion | System/internal | Yes |
| `POST` | `/api/fleet/:contractId/jobs` | B2B webhook — fleet's TMS files an incident | Fleet API key | Yes — `idempotencyKey` required |

## Standard response envelope

All success responses return the resource directly (no wrapper). All errors return:

```json
{
  "code": "JOB_VERSION_CONFLICT",
  "message": "Job was already reassigned by another dispatcher.",
  "requestId": "req_8f2c1a",
  "retryable": false
}
```

`requestId` is always logged server-side and surfaced in the client's error toast
so a support ticket can be traced to the exact backend log line in seconds.

## Auth model
- Customer/technician: short-lived JWT (15 min) + refresh token, issued after
  OTP-based phone login (no passwords — matches how this user base actually
  operates in the field).
- Dispatcher/admin: JWT issued via internal SSO, scoped by city/region for
  dispatchers (a dispatcher in Bhubaneswar cannot see or act on a Bengaluru job).
- Fleet/B2B: API key per contract, rate-limited per contract tier.

## Rate limiting
- Customer job creation: 3 requests/minute/account (protects against retry storms
  from a flaky connection turning into duplicate real-world dispatches — paired
  with the idempotency key, not a substitute for it).
- Technician offer responses: unthrottled (must never be the bottleneck between
  an offer and an accept).
- Fleet webhook: per-contract tier (e.g., 60/min for enterprise, 10/min for SMB).

## Versioning
REST is versioned via the `Accept: application/vnd.byk.v1+json` header, not the
URL path — lets internal clients (web, mobile, fleet webhook consumers) migrate
independently. WebSocket versioning is handled separately via `schemaVersion` in
every envelope (see `packages/ws-schema/index.ts`).
