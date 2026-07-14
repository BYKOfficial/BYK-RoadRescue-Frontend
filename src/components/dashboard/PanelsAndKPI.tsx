import { Card, Badge } from '../primitives';
import { useStore, useConnectionState } from '../../store';
import type { ServiceName } from '@byk/ws-schema';

/* ---------------------------- KPIGrid ---------------------------- */

const KPI_LABELS: Record<string, string> = {
  activeJobs: 'Active jobs',
  slaBreachRatePct: 'SLA breach rate',
  avgTimeToAssignSec: 'Avg time to assign',
  avgTimeToArrivalSec: 'Avg time to arrival',
  revenueTodayPaise: 'Revenue today',
  technicianUtilizationPct: 'Technician utilization',
};

export function KPIGrid() {
  const kpis = useStore((s) => s.kpis);

  if (!kpis) {
    return (
      <div className="byk-kpi-grid" aria-busy="true">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i} className="byk-kpi-card byk-kpi-card--loading" aria-hidden="true" />
        ))}
      </div>
    );
  }

  return (
    <div className="byk-kpi-grid">
      {(Object.keys(KPI_LABELS) as Array<keyof typeof kpis>).map((key) => (
        <Card key={key} className="byk-kpi-card">
          <p className="byk-kpi-card__label">{KPI_LABELS[key]}</p>
          <p className="byk-kpi-card__value">{formatKpi(key, kpis[key])}</p>
        </Card>
      ))}
    </div>
  );
}

function formatKpi(key: string, value: number): string {
  if (key === 'revenueTodayPaise') return `₹${(value / 100).toLocaleString('en-IN')}`;
  if (key.endsWith('Pct')) return `${value.toFixed(1)}%`;
  if (key.endsWith('Sec')) return `${Math.round(value / 60)}m ${Math.round(value % 60)}s`;
  return value.toLocaleString('en-IN');
}

/* Companion CSS:
.byk-kpi-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: var(--space-4); }
.byk-kpi-card__label { font-size: var(--type-caption-size); color: var(--color-text-muted); text-transform: uppercase; letter-spacing: 0.04em; }
.byk-kpi-card__value { font-family: var(--font-display); font-size: var(--type-display-lg-size); margin-top: var(--space-2); }
.byk-kpi-card--loading { height: 92px; background: linear-gradient(90deg, var(--color-bg-surface) 25%, var(--color-bg-surface-raised) 37%, var(--color-bg-surface) 63%); background-size: 400% 100%; animation: byk-skeleton 1.4s ease infinite; }
@keyframes byk-skeleton { 0% { background-position: 100% 50%; } 100% { background-position: 0 50%; } }
*/

/* ---------------------------- TechStackPanel ---------------------------- */

const SERVICE_LABELS: Record<ServiceName, string> = {
  'api-gateway': 'API Gateway',
  'dispatch-engine': 'Dispatch Engine',
  'realtime-hub': 'Realtime Hub (WS)',
  'sla-monitor': 'SLA Monitor',
  'notification-router': 'Notification Router',
  payments: 'Payments',
  postgres: 'PostgreSQL',
  redis: 'Redis',
  'maps-provider': 'Maps Provider',
};

/**
 * Internal-ops visibility surface — shown on the admin health page. Lets an
 * on-call engineer or ops lead see at a glance which backend the customer-facing
 * degraded banners are actually attributable to, without grepping logs.
 */
export function TechStackPanel() {
  const { serviceHealth } = useConnectionState();

  return (
    <Card>
      <h2 className="byk-panel-title">Backend service health</h2>
      <ul className="byk-tech-stack__list">
        {(Object.keys(SERVICE_LABELS) as ServiceName[]).map((service) => {
          const health = serviceHealth[service];
          const tone = !health ? 'neutral' : health.status === 'healthy' ? 'success' : health.status === 'degraded' ? 'warning' : 'danger';
          return (
            <li key={service} className="byk-tech-stack__row">
              <span className={`byk-conn-dot byk-conn-dot--${tone}`} aria-hidden="true" />
              <span className="byk-tech-stack__name">{SERVICE_LABELS[service]}</span>
              <span className="byk-tech-stack__latency">
                {health?.latencyMs != null ? `${health.latencyMs}ms` : '—'}
              </span>
              <Badge tone={tone}>{health?.status ?? 'unknown'}</Badge>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

/* Companion CSS:
.byk-panel-title { font-family: var(--font-display); font-size: var(--type-display-md-size); margin-bottom: var(--space-4); }
.byk-tech-stack__list { list-style: none; display: flex; flex-direction: column; gap: var(--space-3); }
.byk-tech-stack__row { display: grid; grid-template-columns: 10px 1fr auto auto; align-items: center; gap: var(--space-3); font-family: var(--font-mono); font-size: var(--type-mono-sm-size); }
.byk-tech-stack__latency { color: var(--color-text-muted); }
*/

/* ---------------------------- RealtimeHealthPanel ---------------------------- */

/**
 * Distinct from TechStackPanel: this one is about the CLIENT's own connection
 * quality (this browser tab's socket), not backend service health. Both are
 * needed — a technician's phone can be degraded while every backend service
 * is perfectly healthy (bad cell signal in a tunnel), and the two causes
 * need different remediation, so they must never be merged into one badge.
 */
export function RealtimeHealthPanel() {
  const { wsState, isPolling } = useConnectionState();
  const reconnectAttempt = useStore((s) => s.reconnectAttempt);
  const lastConnectedAt = useStore((s) => s.lastConnectedAt);

  return (
    <Card>
      <h2 className="byk-panel-title">Your connection</h2>
      <dl className="byk-realtime-health__grid">
        <div>
          <dt>Status</dt>
          <dd>
            <Badge tone={wsState === 'online' ? 'success' : wsState === 'degraded' ? 'warning' : 'danger'}>
              {wsState}
            </Badge>
          </dd>
        </div>
        <div>
          <dt>Mode</dt>
          <dd>{isPolling ? 'Fallback polling (15s)' : 'Live (WebSocket)'}</dd>
        </div>
        <div>
          <dt>Reconnect attempts</dt>
          <dd>{reconnectAttempt}</dd>
        </div>
        <div>
          <dt>Last connected</dt>
          <dd>{lastConnectedAt ? new Date(lastConnectedAt).toLocaleTimeString('en-IN') : '—'}</dd>
        </div>
      </dl>
    </Card>
  );
}

/* Companion CSS:
.byk-realtime-health__grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: var(--space-4); }
.byk-realtime-health__grid dt { font-size: var(--type-caption-size); color: var(--color-text-muted); text-transform: uppercase; }
.byk-realtime-health__grid dd { margin-top: var(--space-1); font-weight: 600; }
*/
