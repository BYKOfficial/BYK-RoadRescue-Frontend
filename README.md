# BYK RoadRescue — Delivery Index

A production-architecture package for a roadside rescue and dispatch platform for
India: real-time tracking, SLA-monitored dispatch, technician/customer/dispatcher/
admin surfaces, and outage-tolerant realtime infrastructure.

## Read in this order

1. **`01-ARCHITECTURE.md`** — system architecture, control-plane/realtime-plane
   split, full feature list with user journeys, folder tree, edge cases &
   failure modes, and the phased build order (what to build first/second/third).
2. **`02-FIGMA_VARIABLES.md`** — design rationale + full token table (color,
   type, spacing, motion), the "hazard-beacon" visual system, and the
   `no-hardcoded-color` rule.
3. **`design-tokens/tokens.json`** — Style Dictionary source of truth.
   `design-tokens/style-dictionary.config.js` — build config →
   `src/lib/tokens/tokens.css` + `tokens.ts` (generated output, included).
4. **`04-API_CONTRACTS.md`** — REST endpoint index + auth/rate-limit model.
   Full typed DTOs: `packages/shared-types/api-contracts.ts`.
5. **`packages/ws-schema/index.ts`** — versioned WebSocket event schema
   (the 9 required event types, GPS payload shape, exhaustiveness helper).
6. **`src/store/`** — Zustand store: 5 slices (`ui`, `ops`, `connection`,
   `tracking`, `errors`), persist config in `index.ts` with an explicit
   `partialize` that only ever persists `ui`.
7. **`src/lib/ws/client.ts`** + **`src/lib/ws/handlers.ts`** — reconnect-safe
   socket client (exponential backoff + jitter, gap-fill resume via
   `eventSeq`) and the exhaustive event→store dispatcher.
8. **`src/lib/polling/fallbackPoll.ts`** — REST fallback when WS is down.
9. **`src/components/`** — `primitives/` (Button, Badge, Card, Modal, Drawer),
   `layout/` (AppShell, TopBar, SideNav), `dashboard/` (SLAWidget,
   IncidentCard, HelperCard, DispatchQueue, KPIGrid, TechStackPanel,
   RealtimeHealthPanel), `map/` (LiveMap).
10. **`03-TESTING_STRATEGY.md`** — test layers, coverage targets, CI gates.
    **`__tests__/`** — SLAWidget threshold tests, store persistence-boundary
    test (the most important one — see file comment), WS handler
    exhaustiveness test, reconnect/backoff test.

## What's deliberately NOT included at full fidelity
This is an architecture + reference-implementation package, not a deployed app:
- Backend services (`services/*`) are specified in the architecture doc's
  system-boundary table and folder tree, not implemented line-by-line — a real
  build needs infra decisions (which managed Postgres, which maps vendor
  contract, which payment aggregator for UPI) that belong to your team, not a
  first draft.
- Map rendering uses a `MapAdapter` interface rather than a bound Mapbox/Google
  Maps integration, since that choice has real licensing/cost implications for
  a live product and shouldn't be baked in silently.
- Marketing/landing page copy and full page assembly (`app/(marketing)/`) — the
  design tokens and component library are ready for it; happy to build the
  actual landing page next if useful.

## One thing added beyond the brief
**Feature-phone/SMS-first notification path and Odia-language support in the UI
slice** (`Language = 'en' | 'hi' | 'or'`). A meaningful share of the roadside
population this product serves — especially outside metro areas — will not have
a WhatsApp-capable smartphone or English as a first language, and a rescue
platform that assumes otherwise will silently fail exactly the users who need
it most.
