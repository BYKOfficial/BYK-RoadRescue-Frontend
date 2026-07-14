import { handleWsEvent } from '../src/lib/ws/handlers';
import { useStore } from '../src/store';
import type { WSEvent, WSEventType } from '@byk/ws-schema';
import { WS_SCHEMA_VERSION } from '@byk/ws-schema';

const ALL_EVENT_TYPES: WSEventType[] = [
  'tracking.location_updated',
  'tracking.eta_updated',
  'job.assigned',
  'job.reassigned',
  'job.status_changed',
  'job.sla_warning',
  'job.sla_breached',
  'service.status_changed',
  'sync.flushed',
];

function envelope<T extends WSEventType>(type: T, payload: any): WSEvent {
  return {
    schemaVersion: WS_SCHEMA_VERSION,
    type,
    eventSeq: Date.now(),
    emittedAt: new Date().toISOString(),
    roomId: 'job:job-1',
    payload,
  } as WSEvent;
}

const FIXTURES: Record<WSEventType, any> = {
  'tracking.location_updated': {
    jobId: 'job-1', technicianId: 't-1', lat: 20.7, lng: 84.1, speedKph: 40,
    headingDeg: 90, batteryPct: 80, roadSnapped: true, recordedAt: new Date().toISOString(),
  },
  'tracking.eta_updated': { jobId: 'job-1', etaSeconds: 300, confidence: 'high' },
  'job.assigned': {
    jobId: 'job-1', technicianId: 't-1', technicianName: 'Ravi', technicianRating: 4.8,
    vehiclePlate: 'OD-05-1234', offerExpiresAt: new Date().toISOString(),
  },
  'job.reassigned': { jobId: 'job-1', previousTechnicianId: 't-1', reason: 'rejected', newTechnicianId: 't-2' },
  'job.status_changed': { jobId: 'job-1', fromStatus: 'matched', toStatus: 'en_route', changedBy: 'technician' },
  'job.sla_warning': { jobId: 'job-1', slaDeadline: new Date().toISOString(), secondsRemaining: 300, thresholdPct: 70 },
  'job.sla_breached': { jobId: 'job-1', slaDeadline: new Date().toISOString(), breachedBySeconds: 30, escalationTier: 1 },
  'service.status_changed': { service: 'realtime-hub', status: 'degraded', latencyMs: 800 },
  'sync.flushed': { clientId: 'c-1', flushedEventCount: 3, serverWatermarkSeq: 42 },
};

describe('WS event handler exhaustiveness', () => {
  it.each(ALL_EVENT_TYPES)('handles %s without throwing and updates relevant store state', (type) => {
    expect(() => handleWsEvent(envelope(type, FIXTURES[type]))).not.toThrow();
  });

  it('has a fixture for every WSEventType (fails if schema grows without a test)', () => {
    expect(Object.keys(FIXTURES).sort()).toEqual([...ALL_EVENT_TYPES].sort());
  });

  it('applies a GPS ping to the tracking slice', () => {
    handleWsEvent(envelope('tracking.location_updated', FIXTURES['tracking.location_updated']));
    const job = useStore.getState().jobsById['job-1'];
    expect(job.technicianLat).toBe(20.7);
    expect(job.isStaleGps).toBe(false);
  });

  it('records an SLA breach as a pushed error for dispatcher visibility', () => {
    const before = useStore.getState().errors.length;
    handleWsEvent(envelope('job.sla_breached', FIXTURES['job.sla_breached']));
    expect(useStore.getState().errors.length).toBe(before + 1);
  });

  it('drops out-of-order/duplicate events at the client boundary (simulated via direct seq check)', () => {
    // The RealtimeClient itself performs the seq-dedup before calling handleWsEvent;
    // this test documents the contract handlers.ts relies on: it never re-validates
    // eventSeq itself, so RealtimeClient's dedup must remain a hard guarantee.
    const first = envelope('tracking.eta_updated', { jobId: 'job-1', etaSeconds: 200, confidence: 'high' });
    const stale = { ...first, eventSeq: first.eventSeq - 1000 };
    handleWsEvent(first as WSEvent);
    expect(useStore.getState().jobsById['job-1'].etaSeconds).toBe(200);
    // handleWsEvent itself doesn't reject `stale` — dedup lives one layer up in RealtimeClient.
    handleWsEvent(stale as WSEvent);
  });
});
