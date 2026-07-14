# BYK RoadRescue — Testing Strategy

## Philosophy
This system's riskiest bugs live at boundaries: WS↔store, offline↔online transitions,
and SLA-timing edge cases — not inside individual presentational components. Test
budget is allocated accordingly: **heavier on store/socket/reconnect logic, lighter
on pure-render component snapshots.**

## Layers

### 1. Unit tests (Jest)
- Zustand slices in isolation — each slice's actions tested against a fresh store
  instance, asserting state shape after dispatch, not implementation details.
- Pure functions: `formatMMSS`, SLA percent-remaining math, exponential backoff
  delay calculation, idempotency-key dedup logic.
- WS handler exhaustiveness — a compile-time check (via `assertNever`) plus a
  runtime test that every `WSEventType` has a corresponding `it()` block, so a new
  event type added to the schema without a test fails CI, not just at runtime.

### 2. Component tests (Jest + React Testing Library)
- Render-state coverage per component: **loading, empty, error, degraded, offline,
  and happy-path** — this list is a checklist enforced in PR review, not optional.
- Accessibility assertions: every interactive primitive tested for keyboard
  operability (`Tab`/`Enter`/`Escape`) and that focus returns to the trigger on
  Modal/Drawer close.
- SLAWidget tested at fixed `Date.now()` (via `jest.useFakeTimers`) at 0%, 50%,
  71% (crossing into warning), 100%+ (breached) to lock in the threshold logic
  without flaky real-time waits.

### 3. Integration tests
- Full store + WS handler pipeline: feed a sequence of `WSEvent` fixtures into
  `handleWsEvent` and assert the resulting `useStore.getState()` snapshot,
  including out-of-order and duplicate `eventSeq` values to confirm the
  drop-stale-or-duplicate logic in `RealtimeClient`.
- Reconnect scenario: mock WebSocket that closes on demand; assert backoff
  delays follow `1s, 2s, 4s, 8s, 16s, 30s(cap)` within jitter tolerance, and that
  `maxAttemptsBeforeFallback` correctly flips `wsState` to `offline` and that the
  `FallbackPoller` starts.
- Persistence boundary test: hydrate the store, mutate every slice, simulate a
  page reload (re-run `persist` rehydration against the mocked storage), and
  assert that **only** `ui` slice fields survived — this is the single most
  important regression test in the suite, since a leak here means live job data
  could resurface stale after a refresh.

### 4. Socket-driven / end-to-end flows (Playwright, against a staging stack)
- Full job lifecycle: request → matched → en_route (with simulated GPS ping
  stream) → arrived → in_progress → OTP-gated completion → payment.
- Kill the WS connection mid-tracking (via a test-only server endpoint) and
  assert: degraded banner appears within 1 reconnect cycle, map keeps last pin
  visible, fallback polling banner appears after the 3rd failed attempt, and
  live updates resume with a `sync.flushed` reconciliation once the connection
  is restored.
- SLA breach path: seed a job with a near-expired `slaDeadline`, assert
  `job.sla_warning` fires the amber state and `job.sla_breached` fires escalation
  tier 1 notification to the dispatcher dashboard.
- Reassignment race: two dispatcher sessions attempt to assign the same job
  simultaneously; assert one gets `JOB_VERSION_CONFLICT` and a toast, not a
  silent double-assignment.

## Coverage targets
| Layer | Target | Rationale |
|---|---|---|
| Zustand slices | 90%+ | Core correctness surface, cheap to test exhaustively |
| WS handler + client | 90%+ | Where outage-related bugs actually live |
| Primitives (Button/Badge/Card/Modal/Drawer) | 80%+ | Accessibility contract must hold |
| Dashboard components | 70%+ | Focus on state-variant coverage, not visual pixel tests |
| E2E critical paths | 100% of the journeys in Section 2 of the architecture doc | These are the product |

## CI gates
- No PR merges if it adds a `WSEventType` without a handler test (enforced by the
  exhaustiveness test in `__tests__/wsHandlerExhaustiveness.test.ts`).
- No PR merges if `no-hardcoded-color` lint rule fails (raw hex/rgb outside
  `design-tokens/`).
- Playwright critical-path suite runs on every deploy to staging before promotion
  to production; a red critical path blocks the release, no exceptions, since a
  broken request-help flow is a real-world stranded-driver incident.
