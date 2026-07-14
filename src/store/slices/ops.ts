import { StateCreator } from 'zustand';
import type { StoreState } from '../index';

export interface IncidentQueueItem {
  jobId: string;
  serviceCategory: string;
  customerName: string;
  createdAt: string;
  slaDeadline: string;
  status: 'unassigned' | 'offer_pending' | 'assigned' | 'reassigning';
  priority: 'emergency' | 'standard' | 'fleet_contract';
}

export interface HelperSummary {
  technicianId: string;
  name: string;
  rating: number;
  vehicleTypes: string[];
  skills: string[];
  lat: number;
  lng: number;
  status: 'available' | 'on_job' | 'offline';
}

/** ops slice — dispatcher/admin working set. Never persisted: this is a live
 * operational picture that must always reflect the current server state,
 * not whatever was true when the dispatcher last closed their laptop. */
export interface OpsSlice {
  incidentQueue: IncidentQueueItem[];
  helpers: Record<string, HelperSummary>;
  selectedIncidentId: string | null;
  kpis: {
    activeJobs: number;
    slaBreachRatePct: number;
    avgTimeToAssignSec: number;
    avgTimeToArrivalSec: number;
    revenueTodayPaise: number;
    technicianUtilizationPct: number;
  } | null;

  setIncidentQueue: (items: IncidentQueueItem[]) => void;
  upsertHelper: (helper: HelperSummary) => void;
  selectIncident: (jobId: string | null) => void;
  setKpis: (kpis: OpsSlice['kpis']) => void;
}

export const createOpsSlice: StateCreator<StoreState, [], [], OpsSlice> = (set) => ({
  incidentQueue: [],
  helpers: {},
  selectedIncidentId: null,
  kpis: null,

  setIncidentQueue: (incidentQueue) => set({ incidentQueue }),
  upsertHelper: (helper) =>
    set((s) => ({ helpers: { ...s.helpers, [helper.technicianId]: helper } })),
  selectIncident: (selectedIncidentId) => set({ selectedIncidentId }),
  setKpis: (kpis) => set({ kpis }),
});
