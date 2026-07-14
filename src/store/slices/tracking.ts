import { StateCreator } from 'zustand';
import type { StoreState } from '../index';
import type { JobStatus } from '@byk/ws-schema';

export interface TrackedJob {
  jobId: string;
  status: JobStatus;
  technicianId: string | null;
  technicianName: string | null;
  technicianLat: number | null;
  technicianLng: number | null;
  headingDeg: number | null;
  etaSeconds: number | null;
  etaConfidence: 'high' | 'medium' | 'low' | null;
  slaDeadline: string | null;
  lastGpsAt: string | null;      // recordedAt of last GPS ping — used to render "last seen Nm ago"
  isStaleGps: boolean;           // derived: lastGpsAt older than STALE_THRESHOLD_MS
}

const STALE_THRESHOLD_MS = 45_000;

/**
 * tracking slice — NEVER persisted. This is the textbook "safe UI state vs
 * volatile operational state" boundary called out in the product spec:
 * live coordinates and job status must be re-fetched/re-subscribed fresh
 * on every app boot, never rehydrated from localStorage.
 */
export interface TrackingSlice {
  jobsById: Record<string, TrackedJob>;
  activeJobId: string | null;

  upsertJob: (partial: Partial<TrackedJob> & { jobId: string }) => void;
  setActiveJob: (jobId: string | null) => void;
  applyGpsPing: (jobId: string, lat: number, lng: number, headingDeg: number, recordedAt: string) => void;
  markStaleIfNeeded: (jobId: string) => void;
  removeJob: (jobId: string) => void;
}

export const createTrackingSlice: StateCreator<StoreState, [], [], TrackingSlice> = (set, get) => ({
  jobsById: {},
  activeJobId: null,

  upsertJob: (partial) =>
    set((s) => ({
      jobsById: {
        ...s.jobsById,
        [partial.jobId]: { ...emptyJob(partial.jobId), ...s.jobsById[partial.jobId], ...partial },
      },
    })),

  setActiveJob: (jobId) => set({ activeJobId: jobId }),

  applyGpsPing: (jobId, lat, lng, headingDeg, recordedAt) =>
    set((s) => {
      const existing = s.jobsById[jobId] ?? emptyJob(jobId);
      return {
        jobsById: {
          ...s.jobsById,
          [jobId]: {
            ...existing,
            technicianLat: lat,
            technicianLng: lng,
            headingDeg,
            lastGpsAt: recordedAt,
            isStaleGps: false,
          },
        },
      };
    }),

  markStaleIfNeeded: (jobId) => {
    const job = get().jobsById[jobId];
    if (!job?.lastGpsAt) return;
    const ageMs = Date.now() - new Date(job.lastGpsAt).getTime();
    if (ageMs > STALE_THRESHOLD_MS && !job.isStaleGps) {
      set((s) => ({ jobsById: { ...s.jobsById, [jobId]: { ...s.jobsById[jobId], isStaleGps: true } } }));
    }
  },

  removeJob: (jobId) =>
    set((s) => {
      const { [jobId]: _removed, ...rest } = s.jobsById;
      return { jobsById: rest, activeJobId: s.activeJobId === jobId ? null : s.activeJobId };
    }),
});

function emptyJob(jobId: string): TrackedJob {
  return {
    jobId,
    status: 'requested',
    technicianId: null,
    technicianName: null,
    technicianLat: null,
    technicianLng: null,
    headingDeg: null,
    etaSeconds: null,
    etaConfidence: null,
    slaDeadline: null,
    lastGpsAt: null,
    isStaleGps: false,
  };
}
