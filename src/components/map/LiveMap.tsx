import { useEffect, useRef } from 'react';
import { useTrackedJob, useStore } from '../../store';

interface LiveMapProps {
  jobId: string;
  /** Injected adapter so the component isn't hard-wired to one vendor SDK.
   * Swap MapboxAdapter / GoogleMapsAdapter without touching this component. */
  mapAdapter: MapAdapter;
}

export interface MapAdapter {
  mount: (el: HTMLDivElement) => void;
  unmount: () => void;
  setMarker: (id: string, lat: number, lng: number, headingDeg: number | null) => void;
  setRoutePolyline: (encoded: string | null) => void;
  panTo: (lat: number, lng: number) => void;
}

/**
 * Never renders a bare blank map on loss of signal — if GPS goes stale
 * (see tracking slice `isStaleGps`, 45s threshold) the last known pin stays
 * on screen with a "last seen Nm ago" chip instead of disappearing, and the
 * map does NOT keep auto-panning to a coordinate that's no longer trustworthy.
 */
export function LiveMap({ jobId, mapAdapter }: LiveMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const job = useTrackedJob(jobId);
  const markStaleIfNeeded = useStore((s) => s.markStaleIfNeeded);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    mapAdapter.mount(el);
    return () => mapAdapter.unmount();
  }, [mapAdapter]);

  useEffect(() => {
    if (!job?.technicianLat || !job?.technicianLng) return;
    mapAdapter.setMarker(jobId, job.technicianLat, job.technicianLng, job.headingDeg);
    if (!job.isStaleGps) mapAdapter.panTo(job.technicianLat, job.technicianLng);
  }, [job?.technicianLat, job?.technicianLng, job?.headingDeg, job?.isStaleGps, jobId, mapAdapter]);

  useEffect(() => {
    const interval = setInterval(() => markStaleIfNeeded(jobId), 5000);
    return () => clearInterval(interval);
  }, [jobId, markStaleIfNeeded]);

  const hasLocation = job?.technicianLat != null && job?.technicianLng != null;

  return (
    <div className="byk-live-map">
      <div ref={containerRef} className="byk-live-map__canvas" role="img" aria-label="Live technician location map" />
      {!hasLocation && (
        <div className="byk-live-map__overlay byk-live-map__overlay--empty" role="status">
          <p>Waiting for helper's live location…</p>
        </div>
      )}
      {hasLocation && job?.isStaleGps && (
        <div className="byk-live-map__stale-chip" role="status" aria-live="polite">
          Last seen {formatAgo(job.lastGpsAt)} — signal may be weak
        </div>
      )}
    </div>
  );
}

function formatAgo(iso: string | null): string {
  if (!iso) return 'a while ago';
  const seconds = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  return `${Math.round(seconds / 60)}m ago`;
}

/* Companion CSS:
.byk-live-map { position: relative; border-radius: var(--radius-md); overflow: hidden; border: 1px solid var(--color-border-hairline); min-height: 320px; }
.byk-live-map__canvas { width: 100%; height: 100%; min-height: 320px; background: var(--color-bg-surface); }
.byk-live-map__overlay { position: absolute; inset: 0; display: grid; place-items: center; color: var(--color-text-muted); background: color-mix(in srgb, var(--color-bg-app) 60%, transparent); }
.byk-live-map__stale-chip { position: absolute; bottom: var(--space-4); left: var(--space-4); background: color-mix(in srgb, var(--color-status-warning) 90%, var(--color-bg-surface)); color: #0e1522; padding: var(--space-2) var(--space-4); border-radius: var(--radius-full); font-size: var(--type-caption-size); font-weight: 700; }
*/
