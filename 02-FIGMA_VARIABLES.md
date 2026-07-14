# BYK RoadRescue — Design Token Plan (Figma Variable Sheet)

## Design rationale (read before the table)

This is an outdoor, high-glare, one-handed, often-panicked usage context — someone on the shoulder of a highway in Odisha at 2pm in June checking their phone. That drove three decisions:

- **Palette is a hazard-beacon system, not a generic SaaS palette.** Primary is a warm amber tied to actual tow-truck/hazard-light color temperature (~590nm), not a terracotta or a generic blue. Background is "wet asphalt," not cream or pure black.
- **Display type is Barlow Condensed**, a grotesque with genuine highway-signage lineage (it's derived from the same family used on Indian/US road signage). Condensed width lets KPI numerals and ETA countdowns stay large without eating horizontal space on a cracked, small-screen phone. Paired with Inter for body (dense multi-language UI legibility) and JetBrains Mono for anything numeric-operational (coordinates, job IDs, countdowns).
- **Signature element:** a rotating-beacon arc — a circular progress ring that sweeps amber→red as an SLA clock burns down, used identically in `SLAWidget`, `IncidentCard`, and connection-status dots. One visual idea, reused everywhere, instead of a different spinner/badge per surface.

Color values below are **semantic-first**: components never reference `amber.500` directly, only `--color-sla-warning` etc. Raw palette values are the only place hex appears.

## A. Primitive palette (raw values — referenced only by semantic tokens)

| Variable | Value | Notes |
|---|---|---|
| `palette/ink/900` | `#0E1522` | wet-asphalt near-black, app background (dark) |
| `palette/ink/800` | `#16202F` | surface / card background (dark) |
| `palette/ink/700` | `#212D3F` | elevated surface / hover (dark) |
| `palette/ink/300` | `#8A96A6` | muted text (dark mode) |
| `palette/ink/100` | `#F4F6F8` | primary text (dark mode) |
| `palette/concrete/50` | `#EDEEEA` | app background (light) — cool concrete, not cream |
| `palette/concrete/100` | `#FFFFFF` | surface / card background (light) |
| `palette/concrete/700` | `#4A5460` | muted text (light mode) |
| `palette/concrete/900` | `#12161C` | primary text (light mode) |
| `palette/beacon/400` | `#FFA24D` | amber, light-mode accent |
| `palette/beacon/500` | `#FF7A1A` | amber, brand primary |
| `palette/beacon/600` | `#D9640F` | amber, pressed state |
| `palette/signal/500` | `#E23B3B` | red, danger/breach |
| `palette/signal/600` | `#B92C2C` | red, pressed |
| `palette/caution/500` | `#F5C518` | yellow, SLA warning |
| `palette/go/500` | `#2FB670` | green, success/available |
| `palette/go/600` | `#22935A` | green, pressed |
| `palette/hc/black` | `#000000` | high-contrast mode background |
| `palette/hc/white` | `#FFFFFF` | high-contrast mode text |
| `palette/hc/amber` | `#FFB347` | boosted-luminance amber for HC mode |
| `palette/hc/red` | `#FF5C5C` | boosted-luminance red for HC mode |
| `palette/hc/green` | `#4ADE80` | boosted-luminance green for HC mode |

## B. Semantic tokens (what components actually consume)

| Token | Dark mode | Light mode | High contrast | Used for |
|---|---|---|---|---|
| `color-bg-app` | ink/900 | concrete/50 | hc/black | page background |
| `color-bg-surface` | ink/800 | concrete/100 | hc/black | cards, panels |
| `color-bg-surface-raised` | ink/700 | concrete/100 + shadow | hc/black + 2px border | modals, popovers |
| `color-border-hairline` | `#263042` | `#DADCD8` | hc/white | dividers, card edges |
| `color-text-primary` | ink/100 | concrete/900 | hc/white | body/headline text |
| `color-text-muted` | ink/300 | concrete/700 | hc/white (no muting) | captions, timestamps |
| `color-brand-primary` | beacon/500 | beacon/500 | hc/amber | primary CTA, brand marks |
| `color-brand-primary-pressed` | beacon/600 | beacon/600 | hc/amber | active/pressed CTA |
| `color-status-success` | go/500 | go/500 | hc/green | job completed, technician available |
| `color-status-warning` | caution/500 | caution/500 | hc/amber | SLA warning (>70% of clock used) |
| `color-status-danger` | signal/500 | signal/500 | hc/red | SLA breached, error, offline |
| `color-status-info` | `#5AA9E6` | `#2E7FC7` | hc/white | neutral status, informational badges |
| `color-focus-ring` | beacon/400 | beacon/500 | hc/amber, 3px | keyboard focus — always visible, never suppressed |
| `color-overlay-scrim` | `rgba(14,21,34,0.72)` | `rgba(18,22,28,0.55)` | `rgba(0,0,0,0.9)` | modal/drawer backdrop |

## C. Typography tokens

| Token | Family | Role |
|---|---|---|
| `font-display` | `"Barlow Condensed", "Arial Narrow", sans-serif` | Headlines, KPI numerals, SLA countdown digits |
| `font-body` | `"Inter", "Noto Sans", system-ui, sans-serif` | All UI copy, labels, forms (Noto Sans fallback for broader Indic glyph coverage) |
| `font-mono` | `"JetBrains Mono", "SFMono-Regular", monospace` | Job IDs, coordinates, timestamps, log/health output |
| `type-scale-display-xl` | 56px / 1.0 / 600 | Marketing hero |
| `type-scale-display-lg` | 36px / 1.05 / 600 | Section headers, KPI values |
| `type-scale-display-md` | 24px / 1.1 / 600 | Card titles, countdown timers |
| `type-scale-body-md` | 16px / 1.5 / 400 | Default body |
| `type-scale-body-sm` | 14px / 1.5 / 400 | Secondary text |
| `type-scale-caption` | 12px / 1.4 / 500 | Labels, badges, timestamps |
| `type-scale-mono-sm` | 13px / 1.4 / 500 | Coordinates, IDs |

## D. Spacing, radius, elevation (4px base grid)

| Token | Value |
|---|---|
| `space-1` … `space-12` | 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96 (px) |
| `radius-sm` | 6px (badges, inputs) |
| `radius-md` | 10px (cards) |
| `radius-lg` | 16px (modals, sheets) |
| `radius-full` | 999px (avatars, pills, beacon ring) |
| `elevation-1` | `0 1px 2px rgba(14,21,34,0.08)` |
| `elevation-2` | `0 4px 12px rgba(14,21,34,0.16)` |
| `elevation-modal` | `0 16px 48px rgba(14,21,34,0.32)` |

## E. Motion tokens

| Token | Value | Use |
|---|---|---|
| `motion-duration-fast` | 120ms | button/badge hover |
| `motion-duration-base` | 200ms | drawer/modal enter |
| `motion-duration-beacon` | 1400ms, linear, infinite | SLA beacon-ring pulse (signature element) |
| `motion-easing-standard` | `cubic-bezier(.2,.8,.2,1)` | default easing |
| `motion-reduced` | all durations → 1ms when `prefers-reduced-motion: reduce` | accessibility |

## F. Component tokens (examples — see `tokens.json` for full set)

| Component | Token | Value source |
|---|---|---|
| Button/primary | `bg` | `color-brand-primary` |
| Button/primary | `bg-hover` | `color-brand-primary-pressed` |
| Badge/danger | `bg` | `color-status-danger` at 16% opacity, text at full `color-status-danger` |
| SLAWidget/ring-track | `stroke` | `color-border-hairline` |
| SLAWidget/ring-progress-ok | `stroke` | `color-status-success` |
| SLAWidget/ring-progress-warning | `stroke` | `color-status-warning` |
| SLAWidget/ring-progress-breach | `stroke` | `color-status-danger` |
| ConnectionDot/online | `bg` | `color-status-success` |
| ConnectionDot/degraded | `bg` | `color-status-warning` |
| ConnectionDot/offline | `bg` | `color-status-danger` |

**Rule enforced in code review:** no component file may contain a literal hex value or `rgb()`. Lint rule (`no-hardcoded-color`) scans for hex/rgb patterns outside `packages/design-tokens/`.
