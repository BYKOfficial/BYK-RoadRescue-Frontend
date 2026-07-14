import type { WSEvent } from '@byk/ws-schema';
import { assertNever } from '@byk/ws-schema';
import { useStore } from '../../store';

/**
 * Single entry point for every inbound WS event. Kept exhaustive on purpose —
 * adding a new WSEventType without a branch here is a TypeScript compile error
 * (see assertNever), so a new event can never silently no-op in production.
 */
export function handleWsEvent(event: WSEvent) {
  const s = useStore.getState();

  switch (event.type) {
    case 'tracking.location_updated': {
      const p = event.payload;
      s.applyGpsPing(p.jobId, p.lat, p.lng, p.headingDeg, p.recordedAt);
      return;
    }

    case 'tracking.eta_updated': {
      const p = event.payload;
      s.upsertJob({ jobId: p.jobId, etaSeconds: p.etaSeconds, etaConfidence: p.confidence });
      return;
    }

    case 'job.assigned': {
      const p = event.payload;
      s.upsertJob({
        jobId: p.jobId,
        status: 'matched',
        technicianId: p.technicianId,
        technicianName: p.technicianName,
      });
      return;
    }

    case 'job.reassigned': {
      const p = event.payload;
      s.upsertJob({
        jobId: p.jobId,
        status: 'reassigning',
        technicianId: p.newTechnicianId,
      });
      s.pushError({
        code: 'JOB_REASSIGNED_INFO',
        message: `Job ${p.jobId} reassigned (${p.reason}) — finding a new helper.`,
        retryable: false,
        context: { jobId: p.jobId },
      });
      return;
    }

    case 'job.status_changed': {
      const p = event.payload;
      s.upsertJob({ jobId: p.jobId, status: p.toStatus });
      return;
    }

    case 'job.sla_warning': {
      const p = event.payload;
      s.upsertJob({ jobId: p.jobId, slaDeadline: p.slaDeadline });
      // SLAWidget reads secondsRemaining live off slaDeadline via a ticking
      // interval rather than storing secondsRemaining directly, so the
      // countdown stays accurate between events instead of freezing at the
      // value from the last warning tick.
      return;
    }

    case 'job.sla_breached': {
      const p = event.payload;
      s.pushError({
        code: 'SLA_BREACHED',
        message: `SLA breached on job ${p.jobId} by ${p.breachedBySeconds}s (tier ${p.escalationTier}).`,
        retryable: false,
        context: { jobId: p.jobId, escalationTier: p.escalationTier },
      });
      return;
    }

    case 'service.status_changed': {
      const p = event.payload;
      s.setServiceHealth(p.service, { status: p.status, latencyMs: p.latencyMs, message: p.message });
      return;
    }

    case 'sync.flushed': {
      s.setPolling(false);
      return;
    }

    default:
      return assertNever(event);
  }
}
