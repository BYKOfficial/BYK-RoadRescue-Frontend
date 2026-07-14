# BYK RoadRescue — Product & Systems Architecture

## 1. Product Architecture Overview

BYK RoadRescue is a three-sided marketplace operating in real time:

```
┌─────────────┐        ┌──────────────────────┐        ┌─────────────┐
│  CUSTOMER   │  REST  │   CORE PLATFORM       │  REST  │  TECHNICIAN │
│  (rider,    │◄──────►│                       │◄──────►│  / PARTNER  │
│  driver,    │  WS    │  API Gateway           │  WS    │  MECHANIC   │
│  fleet ops) │◄──────►│  Dispatch Engine       │◄──────►│             │
└─────────────┘        │  Realtime Hub (WS)     │        └─────────────┘
                        │  SLA Monitor           │
                        │  Notification Router   │        ┌─────────────┐
                        │  Payments              │◄──────►│  DISPATCHER │
                        └──────────┬─────────────┘  WS    │  / ADMIN    │
                                   │                        └─────────────┘
                        ┌──────────┴─────────────┐
                        │ PostgreSQL │ Redis │ Maps│
                        │ (system)   │(queue/│ Provider│ Payment Gateway
                        │            │ cache) │        │
                        └────────────────────────┘
```

**Why this shape:** the dispatch problem is fundamentally a real-time matching + state machine problem (job lifecycle) layered on top of a boring CRUD system (users, vehicles, invoices). Splitting these two concerns is the single most important architecture decision:

- **Control plane (REST + Postgres):** account data, job history, invoices, ratings, KYC for technicians, catalog of services. Consistency matters more than latency.
- **Realtime plane (WebSocket + Redis):** live location, ETA, job status transitions, dispatch offers, SLA countdowns. Latency and delivery-ordering matter more than durability of every single tick.

A job's *authoritative* state always lives in Postgres. The WebSocket layer is a fast broadcast of state transitions and ephemeral telemetry (GPS pings) — it is allowed to drop a location ping; it is never allowed to be the only place a `job.status_changed` transition exists. Every status transition is written to Postgres first (or transactionally queued in Redis with a durable outbox), then fanned out over WS. This is the rule that prevents "phantom job completed" bugs when a socket flaps.

### System boundaries
| Boundary | Responsibility | Failure mode if this dies |
|---|---|---|
| API Gateway | AuthN/Z, rate limiting, request validation | Clients get 5xx, retry with backoff |
| Dispatch Engine | Matching helper↔job, skill/vehicle-type scoring, SLA clock | New jobs queue in Redis, existing jobs unaffected |
| Realtime Hub | WS fanout, presence, room membership per job/city | Clients fall back to polling (below) |
| SLA Monitor | Watches job clocks, fires `sla_warning`/`sla_breached`, triggers escalation | Escalation delayed — must have a dead-man's-switch cron as backup |
| Notification Router | WhatsApp/SMS/push/email delivery with provider fallback | Retries queued in Redis; customer still sees in-app status |
| Payments | Order creation, capture, refund, payout to technician | Job can still complete; payment marked `pending_reconciliation` |

### Non-negotiable operating principle
**A stranded customer must never be blocked by a backend outage from seeing "help is coming."** Every screen has a defined degraded-mode rendering. This is why the "TechStackPanel" and "RealtimeHealthPanel" are first-class product surfaces, not internal tooling — ops visibility during outages is a feature, not an afterthought.

---

## 2. Feature List & User Journeys

### 2.1 Customer — Request Help (target: <3 taps to submit)
1. **Tap 1:** Open app → big "Get Help Now" CTA on home (location auto-requested on load).
2. **Tap 2:** Select problem type from icon grid (Flat Tire / Battery / Towing / Fuel / Lockout / Minor Repair / Accident-Emergency). Vehicle type inferred from saved profile or asked once.
3. **Tap 3:** Confirm pinned location (auto GPS pin, draggable) → "Request Rescue."
4. System shows: matching → helper assigned → ETA → live tracking → arrival → OTP handoff → completion → payment → rating.

**Edge cases baked into this flow:**
- GPS permission denied → manual pin-drop on map, address search fallback, "use last known location" option.
- No network at moment of request → request queued locally (IndexedDB/localStorage), submitted the instant connectivity returns, user sees "Sending when back online" state, not a spinner lie.
- Duplicate submit (impatient double-tap, or offline queue + manual retry) → idempotency key per request generated client-side.
- Emergency/accident category → skips normal matching queue, goes to priority lane, optionally prompts "Call emergency services?" with one-tap dial, independent of app backend health.

### 2.2 Customer — Live Tracking
- Map with helper's live position, road-snapped, ETA countdown, helper name/photo/rating/vehicle plate.
- Status ladder: `requested → matched → en_route → arrived → in_progress → completed`.
- Push/SMS/WhatsApp at each transition (configurable channel prefs, WhatsApp default in India).
- If WS degrades: falls back to 15s poll, banner reads "Live tracking is delayed — updating every 15s," never silently freezes the pin.

### 2.3 Customer — Completion & Payment
- Technician marks work done in their app → customer receives OTP via SMS/push → customer reads OTP aloud/enters it in technician's device or their own app to confirm — **this OTP mechanism exists specifically to prevent fraudulent "job completed" taps by technicians and to prevent customers disputing real work.**
- Payment: UPI (primary), card, cash-with-digital-confirmation. Cash jobs still get an in-app "confirm cash received" step from technician + customer so the job record reconciles.
- Failed payment does not block job completion — job is marked `completed_payment_pending`, retried, escalated to collections after N hours.

### 2.4 Dispatcher — Assign nearest correct helper
- Incident queue sorted by SLA remaining (not just FIFO — a 2-minute-old emergency outranks a 10-minute-old flat tire).
- One-click "auto-assign nearest match" or manual override with skill/vehicle-type/rating filters.
- Reassignment flow when a technician rejects/times out an offer (15s offer TTL, auto-escalates to next best match).
- Bulk view for fleet-contract customers (B2B) with contract SLA tiers shown distinctly from retail SLA.

### 2.5 Technician/Partner — Receive & complete jobs
- Push notification + in-app offer card with 15s accept/reject timer, job summary, distance, payout estimate.
- Turn-by-turn navigation handoff to Google/Apple Maps deep link (don't rebuild nav — link out).
- Status buttons: "Arrived," "Start Job," "Mark Complete" (triggers OTP request).
- Offline-tolerant: technician app buffers status updates if connectivity drops mid-job and flushes on reconnect (`sync.flushed` event), never loses a completed job because of a tunnel/basement dead zone.

### 2.6 Admin/Analytics
- KPIs: active jobs, SLA breach rate, avg time-to-assign, avg time-to-arrival, revenue today, technician utilization, city-wise heatmap.
- Service health panel: API latency, WS connection count, Redis/Postgres/Maps/Payment provider status.
- Drill into any breached SLA to see full timeline audit (who was offered, who rejected, why reassigned).

### 2.7 B2B / Fleet dispatch
- Fleet admin portal: bulk vehicle registration, custom SLA contract (e.g., 20-min guaranteed response), consolidated monthly billing, dedicated technician pool option, API/webhook for fleet's own TMS to auto-file incidents.

---

## 3. Folder Tree

```
byk-roadrescue/
├── apps/
│   ├── web/                          # Next.js app (customer + marketing)
│   │   ├── app/
│   │   │   ├── (marketing)/
│   │   │   │   ├── page.tsx                  # landing
│   │   │   │   ├── pricing/page.tsx
│   │   │   │   ├── fleet/page.tsx             # B2B landing
│   │   │   │   └── layout.tsx
│   │   │   ├── (customer)/
│   │   │   │   ├── request/page.tsx           # help request flow
│   │   │   │   ├── track/[jobId]/page.tsx     # live tracking
│   │   │   │   ├── history/page.tsx
│   │   │   │   └── layout.tsx
│   │   │   ├── (dispatch)/
│   │   │   │   ├── dispatch/page.tsx          # dispatcher dashboard
│   │   │   │   └── layout.tsx
│   │   │   ├── (technician)/
│   │   │   │   ├── jobs/page.tsx
│   │   │   │   ├── jobs/[jobId]/page.tsx
│   │   │   │   └── layout.tsx
│   │   │   ├── (admin)/
│   │   │   │   ├── admin/page.tsx             # analytics/ops
│   │   │   │   ├── admin/health/page.tsx      # service health
│   │   │   │   └── layout.tsx
│   │   │   └── api/                           # route handlers (BFF)
│   │   ├── src/
│   │   │   ├── components/
│   │   │   │   ├── primitives/                # Button, Badge, Card, Modal, Drawer
│   │   │   │   ├── layout/                    # AppShell, TopBar, SideNav
│   │   │   │   ├── dashboard/                 # KPIGrid, DispatchQueue, SLAWidget,
│   │   │   │   │                              # TechStackPanel, RealtimeHealthPanel,
│   │   │   │   │                              # HelperCard, IncidentCard
│   │   │   │   └── map/                       # LiveMap
│   │   │   ├── store/                         # zustand slices
│   │   │   │   ├── slices/ui.ts
│   │   │   │   ├── slices/ops.ts
│   │   │   │   ├── slices/connection.ts
│   │   │   │   ├── slices/tracking.ts
│   │   │   │   ├── slices/errors.ts
│   │   │   │   └── index.ts
│   │   │   ├── lib/
│   │   │   │   ├── ws/                        # socket client, reconnect, event bus
│   │   │   │   ├── api/                       # typed REST client + DTOs
│   │   │   │   ├── polling/                   # fallback polling
│   │   │   │   └── tokens/                    # generated CSS/TS tokens
│   │   │   └── styles/globals.css
│   │   └── __tests__/
│   └── mobile/ (optional, React Native, shares src/store + src/lib)
├── services/
│   ├── api-gateway/
│   ├── dispatch-engine/
│   ├── realtime-hub/
│   ├── sla-monitor/
│   ├── notification-router/
│   └── payments/
├── packages/
│   ├── design-tokens/                 # source of truth, Style Dictionary config
│   ├── ws-schema/                     # shared TS types for WS events (versioned)
│   └── shared-types/                  # DTOs shared FE/BE
└── infra/
    ├── postgres/migrations/
    └── redis/
```

---

## 4. Edge Cases & Failure Modes (Section 12)

### Connectivity
- **WS drops mid-job:** client shows "Reconnecting…" badge, keeps last known state on screen (never blanks it), attempts reconnect with exponential backoff (1s→2s→4s→8s→16s→30s cap, ±20% jitter), falls back to 15s REST poll after 3 failed attempts, resumes WS silently once available and reconciles via `sync.flushed`.
- **Client reconnects with stale state:** server sends a full snapshot on reconnect (not just deltas) keyed by last-seen `event_seq`; client diffs and discards anything older than its local watermark to avoid replaying already-applied events.
- **Technician goes through a dead zone mid-navigation:** location buffer stores last 5 minutes of GPS pings locally, flushes on reconnect, dispatcher sees "last seen 4m ago" rather than the pin silently vanishing.
- **True offline request submission:** idempotency key + local queue; if the same request is later found duplicated server-side (e.g., user also called the hotline), dispatcher UI flags "possible duplicate — same phone, same location, <5 min apart."

### Dispatch/matching
- **No technician available within radius:** auto-expand radius in steps (5km→10km→20km), show customer honest "searching wider area" state instead of a fake ETA.
- **Technician accepts but then can't actually go (breakdown, wrong turn-by-turn):** technician can self-cancel with reason code up to `arrived`; job auto-requeues to next best match, customer sees "reassigning your helper" not a silent stall.
- **Two dispatchers try to manually assign the same job simultaneously:** optimistic locking on job row (version column); loser gets a 409 and a toast "already assigned by another dispatcher."
- **SLA clock during reassignment:** clock does not reset on reassignment — it's tied to original request time, so reassignment overhead is visible and accountable, not hidden.

### Payments
- **Payment succeeds but webhook delayed:** job still marked complete from OTP confirmation; payment status is a separate field (`payment_pending`) — job completion is never blocked on payment gateway latency.
- **Customer disputes a completed job:** immutable audit trail (status transitions + who triggered them + OTP confirmation timestamp) is the source of truth for support.
- **Cash job, technician claims paid, customer says no:** requires both-party confirmation tap; unresolved cases flagged to admin queue, not silently closed.

### Data & privacy
- Never persist live GPS trails beyond the operational window in client-side storage — only session-scoped in memory; server retains for audit per data-retention policy (not the frontend's problem, but the FE must not cache it in localStorage).
- Persist only: UI prefs (theme, language, last-used vehicle type, notification channel prefs). Never persist: current job state, live coordinates, OTPs, payment tokens.

### Notifications
- **WhatsApp API down (common in India — Meta rate limits/outages):** router falls back to SMS automatically per channel-priority config; every channel attempt logged so support can see "WhatsApp failed at 10:02, SMS delivered at 10:02:04."
- **User has no smartphone data, feature phone only:** SMS + IVR callback is a first-class channel, not an afterthought — significant in tier-2/3 India markets.

### Scale/ops
- **Dispatch Engine restart mid-shift:** all in-flight offers are re-derived from Postgres (job status + offer table), not from in-memory state — engine must be able to cold-start against durable state at any time.
- **Redis flushed accidentally:** queue state is rebuildable from Postgres job table (Redis is a cache/accelerator, never the sole source of an active job).

---

## 5. Build Order — What a Small Team Builds First, Second, Third (Section 13)

**Phase 1 (Weeks 1–4) — Prove the core loop, single city, manual-heavy:**
1. Customer request flow (3-tap) + manual location pin fallback.
2. Postgres schema: users, vehicles, jobs, technicians, status transitions log.
3. Dispatcher dashboard with manual assignment (no auto-matching yet).
4. Basic WS for job status + location (no fallback polling yet — ship it, then harden).
5. SMS notifications only (skip WhatsApp/push at first — fewer integration surfaces).
6. OTP completion flow + cash-only payment confirmation (skip payment gateway).

**Phase 2 (Weeks 5–8) — Reliability and matching intelligence:**
1. Auto-match algorithm (distance + skill + rating scoring).
2. Fallback polling + reconnect/backoff logic — this is the point where outages stop being scary.
3. SLA Monitor service + SLAWidget with warning/breach visual states.
4. WhatsApp + push notification channels with fallback ordering.
5. Payment gateway integration (UPI first — dominant in India).
6. RealtimeHealthPanel + TechStackPanel for internal ops visibility.

**Phase 3 (Weeks 9–12) — Scale, B2B, polish:**
1. Fleet/B2B portal with contract SLA tiers and consolidated billing.
2. Analytics dashboard (KPIGrid, heatmaps, technician utilization).
3. High-contrast/accessibility pass, full keyboard nav audit.
4. Multi-city support (geofenced dispatch pools, per-city SLA config).
5. Load testing on WS fanout (simulate 500+ concurrent tracked jobs per city).
6. Fraud/dispute tooling (duplicate detection, payment reconciliation queue).

**Explicitly deferred beyond Phase 3:** predictive ETA via ML, dynamic surge pricing, driver gamification, in-app chat (voice call deep-link is enough at first — chat UI is a trap that eats a sprint for low usage in an emergency context where people want a call, not a text thread).
