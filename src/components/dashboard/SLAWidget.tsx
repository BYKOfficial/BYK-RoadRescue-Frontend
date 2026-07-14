import { useEffect, useMemo, useState } from 'react';

interface SLAWidgetProps {
  slaDeadline: string; // ISO 8601
  size?: number;
  showLabel?: boolean;
}

type SlaState = 'ok' | 'warning' | 'breached';

/**
 * The signature visual element of the whole product (see 02-FIGMA_VARIABLES.md).
 * A circular arc drains like a rotating hazard beacon as the SLA clock burns
 * down: green -> amber at 70% consumed -> red pulse once breached. Reused
 * identically inside IncidentCard and the dispatcher's DispatchQueue rows so
 * the same shape always means "time pressure on this job," everywhere it appears.
 *
 * Ticks off `slaDeadline` locally every second rather than waiting for the
 * next `job.sla_warning` WS event, so the countdown never visibly freezes
 * between server pushes.
 */
export function SLAWidget({ slaDeadline, size = 56, showLabel = true }: SLAWidgetProps) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const { pctRemaining, secondsRemaining, state } = useMemo(() => {
    const deadlineMs = new Date(slaDeadline).getTime();
    // We don't know total window length here, so we treat the widget's job as
    // "how close to now is the deadline" over a rolling 30-min reference window,
    // matching the platform default SLA; callers with a non-default window pass
    // slaDeadline computed accordingly server-side, so this stays a display concern.
    const REFERENCE_WINDOW_MS = 30 * 60 * 1000;
    const remainingMs = deadlineMs - now;
    const pct = Math.max(0, Math.min(1, remainingMs / REFERENCE_WINDOW_MS));
    let s: SlaState = 'ok';
    if (remainingMs <= 0) s = 'breached';
    else if (pct <= 0.3) s = 'warning';
    return { pctRemaining: pct, secondsRemaining: Math.round(remainingMs / 1000), state: s };
  }, [slaDeadline, now]);

  const radius = size / 2 - 4;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - pctRemaining);

  return (
    <div
      className={`byk-sla-widget byk-sla-widget--${state}`}
      role="img"
      aria-label={
        state === 'breached'
          ? `SLA breached by ${Math.abs(secondsRemaining)} seconds`
          : `${formatMMSS(secondsRemaining)} remaining before SLA breach`
      }
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--color-border-hairline)"
          strokeWidth="4"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={`var(--color-status-${state === 'ok' ? 'success' : state === 'warning' ? 'warning' : 'danger'})`}
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          className={state === 'breached' ? 'byk-sla-widget__ring--pulse' : undefined}
        />
      </svg>
      {showLabel && (
        <span className="byk-sla-widget__label">
          {state === 'breached' ? `+${formatMMSS(Math.abs(secondsRemaining))}` : formatMMSS(secondsRemaining)}
        </span>
      )}
    </div>
  );
}

function formatMMSS(totalSeconds: number) {
  const m = Math.floor(Math.max(0, totalSeconds) / 60);
  const s = Math.max(0, totalSeconds) % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/* Companion CSS:
.byk-sla-widget { position: relative; display: inline-grid; place-items: center; font-family: var(--font-mono); }
.byk-sla-widget__label { position: absolute; font-size: var(--type-mono-sm-size); font-weight: 700; color: var(--color-text-primary); }
.byk-sla-widget--breached .byk-sla-widget__label { color: var(--color-status-danger); }
.byk-sla-widget__ring--pulse { animation: byk-beacon-pulse var(--motion-duration-beacon) var(--motion-easing-standard) infinite; }
@keyframes byk-beacon-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.35; }
}
@media (prefers-reduced-motion: reduce) {
  .byk-sla-widget__ring--pulse { animation: none; }
}
*/
