/**
 * BYK RoadRescue — WebSocket Event Schema
 * Shared package: imported by realtime-hub (server) and src/lib/ws (client).
 *
 * VERSIONING RULE:
 * - `schemaVersion` is sent on every envelope. Client rejects/logs (never crashes on)
 *   an envelope whose major version it doesn't recognize, and shows a "please update
 *   the app" banner instead of misinterpreting a payload shape it doesn't understand.
 * - Additive fields bump the minor version and are safe to ignore.
 * - Breaking field changes bump the major version and require a client release gate.
 */

export const WS_SCHEMA_VERSION = '1.3.0' as const;

export type WSEventType =
  | 'tracking.location_updated'
  | 'tracking.eta_updated'
  | 'job.assigned'
  | 'job.reassigned'
  | 'job.status_changed'
  | 'job.sla_warning'
  | 'job.sla_breached'
  | 'service.status_changed'
  | 'sync.flushed';

export interface WSEnvelope<T extends WSEventType, P> {
  schemaVersion: string;
  type: T;
  eventSeq: number;          // monotonically increasing per connection/room — used for gap detection
  emittedAt: string;         // ISO 8601, server clock
  roomId: string;            // e.g. `job:${jobId}` or `city:${cityCode}:dispatch`
  payload: P;
}

/** ---------- Payload shapes ---------- */

export interface VehicleGpsPayload {
  jobId: string;
  technicianId: string;
  lat: number;
  lng: number;
  speedKph: number;
  headingDeg: number;        // 0-359, 0 = true north
  batteryPct: number | null; // technician device battery — null if not reported
  roadSnapped: boolean;      // true if map-matched to a road segment
  route?: {
    polyline: string;        // encoded polyline for remaining route
    remainingDistanceM: number;
    remainingDurationS: number;
  };
  recordedAt: string;        // ISO 8601, when the GPS fix was taken on-device
                              // (distinct from emittedAt — lets client detect stale buffered pings
                              // flushed after a dead-zone reconnect)
}

export interface EtaUpdatedPayload {
  jobId: string;
  etaSeconds: number;
  confidence: 'high' | 'medium' | 'low'; // low = sparse GPS signal or traffic model uncertainty
}

export type JobStatus =
  | 'requested'
  | 'matched'
  | 'en_route'
  | 'arrived'
  | 'in_progress'
  | 'completed'
  | 'completed_payment_pending'
  | 'cancelled'
  | 'reassigning';

export interface JobAssignedPayload {
  jobId: string;
  technicianId: string;
  technicianName: string;
  technicianRating: number;
  vehiclePlate: string;
  offerExpiresAt: string; // ISO 8601 — offer TTL, client shows accept/reject countdown
}

export interface JobReassignedPayload {
  jobId: string;
  previousTechnicianId: string;
  reason: 'rejected' | 'timed_out' | 'self_cancelled' | 'dispatcher_override';
  newTechnicianId: string | null; // null while still searching
}

export interface JobStatusChangedPayload {
  jobId: string;
  fromStatus: JobStatus;
  toStatus: JobStatus;
  changedBy: 'customer' | 'technician' | 'dispatcher' | 'system';
  otpVerified?: boolean; // present when toStatus === 'completed'
}

export interface SlaWarningPayload {
  jobId: string;
  slaDeadline: string;      // ISO 8601, original deadline (never shifted by reassignment)
  secondsRemaining: number;
  thresholdPct: number;     // e.g. 70 — percent of SLA window consumed when this fired
}

export interface SlaBreachedPayload {
  jobId: string;
  slaDeadline: string;
  breachedBySeconds: number;
  escalationTier: 1 | 2 | 3; // 1 = notify dispatcher, 2 = notify shift lead, 3 = notify ops manager
}

export type ServiceName =
  | 'api-gateway' | 'dispatch-engine' | 'realtime-hub' | 'sla-monitor'
  | 'notification-router' | 'payments' | 'postgres' | 'redis' | 'maps-provider';

export interface ServiceStatusChangedPayload {
  service: ServiceName;
  status: 'healthy' | 'degraded' | 'down';
  latencyMs: number | null;
  message?: string;
}

export interface SyncFlushedPayload {
  /** Sent after a client (customer or technician) reconnects and its buffered
   * offline events have been accepted and merged server-side. Lets the UI
   * clear any "syncing…" indicator and reconcile local optimistic state. */
  clientId: string;
  flushedEventCount: number;
  serverWatermarkSeq: number; // client should discard any locally-queued event with seq <= this
}

/** ---------- Discriminated union for exhaustive client-side handling ---------- */

export type WSEvent =
  | WSEnvelope<'tracking.location_updated', VehicleGpsPayload>
  | WSEnvelope<'tracking.eta_updated', EtaUpdatedPayload>
  | WSEnvelope<'job.assigned', JobAssignedPayload>
  | WSEnvelope<'job.reassigned', JobReassignedPayload>
  | WSEnvelope<'job.status_changed', JobStatusChangedPayload>
  | WSEnvelope<'job.sla_warning', SlaWarningPayload>
  | WSEnvelope<'job.sla_breached', SlaBreachedPayload>
  | WSEnvelope<'service.status_changed', ServiceStatusChangedPayload>
  | WSEnvelope<'sync.flushed', SyncFlushedPayload>;

/** Exhaustiveness helper — TS compile error if a new WSEventType is added
 *  without a corresponding handler branch in src/lib/ws/handlers.ts */
export function assertNever(x: never): never {
  throw new Error(`Unhandled WS event type: ${JSON.stringify(x)}`);
}
