'use client';

import { useEffect, useMemo, useState } from 'react';
import { useStore } from '../src/store';
import { AppShell, TopBar, SideNav } from '../src/components/layout/AppShell';
import { KPIGrid, TechStackPanel, RealtimeHealthPanel } from '../src/components/dashboard/PanelsAndKPI';
import { DispatchQueue } from '../src/components/dashboard/DispatchQueue';
import { SLAWidget } from '../src/components/dashboard/SLAWidget';
import { HelperCard } from '../src/components/dashboard/IncidentAndHelperCards';
import { LiveMap, type MapAdapter } from '../src/components/map/LiveMap';
import { Card } from '../src/components/primitives';

const DEMO_JOB_ID = 'demo-job-1';

/**
 * This page is the working demo/preview: it seeds the Zustand store with
 * realistic mock data (no backend yet — see 01-ARCHITECTURE.md for the real
 * services this will eventually talk to) so every component on the Delivery
 * Checklist renders in a real, interactive state instead of staying empty.
 * Swap the seeding effect below for real API calls + the RealtimeClient
 * (src/lib/ws/client.ts) once services/* exist.
 */
export default function HomePage() {
  const mapAdapter = useMemo(() => createDemoMapAdapter(), []);
  const [demoSlaDeadline, setDemoSlaDeadline] = useState<string | null>(null);

  useEffect(() => {
    const s = useStore.getState();
    const now = Date.now();

    s.setWsState('online');
    s.setServiceHealth('api-gateway', { status: 'healthy', latencyMs: 82 });
    s.setServiceHealth('dispatch-engine', { status: 'healthy', latencyMs: 140 });
    s.setServiceHealth('realtime-hub', { status: 'degraded', latencyMs: 610, message: 'Elevated latency, Bhubaneswar region' });
    s.setServiceHealth('sla-monitor', { status: 'healthy', latencyMs: 55 });
    s.setServiceHealth('notification-router', { status: 'healthy', latencyMs: 210 });
    s.setServiceHealth('payments', { status: 'healthy', latencyMs: 320 });
    s.setServiceHealth('postgres', { status: 'healthy', latencyMs: 12 });
    s.setServiceHealth('redis', { status: 'healthy', latencyMs: 4 });
    s.setServiceHealth('maps-provider', { status: 'healthy', latencyMs: 95 });

    s.setKpis({
      activeJobs: 27,
      slaBreachRatePct: 4.2,
      avgTimeToAssignSec: 96,
      avgTimeToArrivalSec: 780,
      revenueTodayPaise: 18_42000,
      technicianUtilizationPct: 68.5,
    });

    s.setIncidentQueue([
      {
        jobId: 'job-1001',
        serviceCategory: 'accident_emergency',
        customerName: 'R. Nayak',
        createdAt: new Date(now - 6 * 60_000).toISOString(),
        slaDeadline: new Date(now + 90_000).toISOString(),
        status: 'unassigned',
        priority: 'emergency',
      },
      {
        jobId: 'job-1002',
        serviceCategory: 'towing',
        customerName: 'S. Pattnaik',
        createdAt: new Date(now - 3 * 60_000).toISOString(),
        slaDeadline: new Date(now + 8 * 60_000).toISOString(),
        status: 'offer_pending',
        priority: 'standard',
      },
      {
        jobId: 'job-1003',
        serviceCategory: 'puncture',
        customerName: 'Fleet — Odisha Logistics',
        createdAt: new Date(now - 60_000).toISOString(),
        slaDeadline: new Date(now + 18 * 60_000).toISOString(),
        status: 'unassigned',
        priority: 'fleet_contract',
      },
    ]);

    s.upsertJob({
      jobId: DEMO_JOB_ID,
      status: 'en_route',
      technicianId: 't-501',
      technicianName: 'Ravi Kumar',
      etaSeconds: 420,
      etaConfidence: 'high',
    });
    s.applyGpsPing(DEMO_JOB_ID, 20.71, 83.49, 120, new Date().toISOString());

    // Computed after mount (not during render) so server-rendered HTML and
    // the first client render match exactly — avoids a hydration mismatch
    // on a value that depends on Date.now().
    setDemoSlaDeadline(new Date(now + 5 * 60_000).toISOString());
  }, []);

  return (
    <AppShell
      topBar={<TopBar role="dispatcher" userName="Demo Dispatcher" />}
      sideNav={
        <SideNav
          activeHref="/"
          items={[
            { label: 'Overview', href: '/', icon: '\u25A6' },
            { label: 'Dispatch', href: '/dispatch', icon: '\u2691' },
            { label: 'Technicians', href: '/technicians', icon: '\u2699' },
            { label: 'Health', href: '/health', icon: '\u2665' },
          ]}
        />
      }
    >
      <section className="byk-demo-section">
        <h1 className="byk-demo-section__title">Operations Overview</h1>
        <KPIGrid />
      </section>

      <section className="byk-demo-section">
        <div className="byk-demo-grid">
          <div>
            <h2 className="byk-panel-title">Incident Queue</h2>
            <DispatchQueue onAssign={(jobId) => console.log('auto-assign requested for', jobId)} />
          </div>
          <div>
            <RealtimeHealthPanel />
            <div style={{ marginTop: 'var(--space-6)' }}>
              <TechStackPanel />
            </div>
          </div>
        </div>
      </section>

      <section className="byk-demo-section">
        <h2 className="byk-panel-title">Live Tracking — Demo Job ({DEMO_JOB_ID})</h2>
        <div className="byk-demo-row">
          <div style={{ flex: '2 1 400px' }}>
            <LiveMap jobId={DEMO_JOB_ID} mapAdapter={mapAdapter} />
          </div>
          <div style={{ flex: '1 1 240px', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <Card style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
              {demoSlaDeadline && <SLAWidget slaDeadline={demoSlaDeadline} size={72} />}
              <div>
                <p style={{ margin: 0, fontWeight: 600 }}>SLA countdown</p>
                <p style={{ margin: 0, fontSize: 'var(--type-body-sm-size)', color: 'var(--color-text-muted)' }}>
                  Sample job nearing its response window
                </p>
              </div>
            </Card>
            <HelperCard
              helper={{
                technicianId: 't-501',
                name: 'Ravi Kumar',
                rating: 4.8,
                vehicleTypes: ['bike', 'car'],
                skills: ['towing', 'jumpstart'],
                lat: 20.71,
                lng: 83.49,
                status: 'on_job',
              }}
            />
          </div>
        </div>
      </section>
    </AppShell>
  );
}

/**
 * Cosmetic placeholder adapter so LiveMap renders something real without
 * binding this reference implementation to a specific paid maps SDK. Swap
 * for a MapboxAdapter/GoogleMapsAdapter implementing the same MapAdapter
 * interface (src/components/map/LiveMap.tsx) — no changes needed elsewhere.
 */
function createDemoMapAdapter(): MapAdapter {
  let container: HTMLDivElement | null = null;
  let marker: HTMLDivElement | null = null;
  // Rough bounding box around western Odisha, used only to place the demo dot.
  const bounds = { minLat: 20.5, maxLat: 20.9, minLng: 83.3, maxLng: 83.7 };

  return {
    mount(el) {
      container = el;
      container.style.position = 'relative';
      container.style.backgroundImage =
        'linear-gradient(var(--color-border-hairline) 1px, transparent 1px), linear-gradient(90deg, var(--color-border-hairline) 1px, transparent 1px)';
      container.style.backgroundSize = '24px 24px';
      marker = document.createElement('div');
      marker.style.position = 'absolute';
      marker.style.width = '14px';
      marker.style.height = '14px';
      marker.style.borderRadius = '999px';
      marker.style.background = 'var(--color-brand-primary)';
      marker.style.boxShadow = '0 0 0 6px color-mix(in srgb, var(--color-brand-primary) 25%, transparent)';
      marker.style.transform = 'translate(-50%, -50%)';
      marker.style.transition = 'left 0.6s linear, top 0.6s linear';
      container.appendChild(marker);
    },
    unmount() {
      if (marker && container?.contains(marker)) container.removeChild(marker);
      container = null;
      marker = null;
    },
    setMarker(_id, lat, lng) {
      if (!marker) return;
      const xPct = ((lng - bounds.minLng) / (bounds.maxLng - bounds.minLng)) * 100;
      const yPct = (1 - (lat - bounds.minLat) / (bounds.maxLat - bounds.minLat)) * 100;
      marker.style.left = `${Math.min(96, Math.max(4, xPct))}%`;
      marker.style.top = `${Math.min(96, Math.max(4, yPct))}%`;
    },
    setRoutePolyline() {
      /* no-op in the demo adapter — a real adapter draws the encoded polyline */
    },
    panTo() {
      /* no-op in the demo adapter — a real adapter recenters the map viewport */
    },
  };
}
