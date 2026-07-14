import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { useShallow } from 'zustand/react/shallow';
import { createUiSlice, UiSlice } from './slices/ui';
import { createOpsSlice, OpsSlice } from './slices/ops';
import { createConnectionSlice, ConnectionSlice } from './slices/connection';
import { createTrackingSlice, TrackingSlice } from './slices/tracking';
import { createErrorsSlice, ErrorsSlice } from './slices/errors';

export type StoreState = UiSlice & OpsSlice & ConnectionSlice & TrackingSlice & ErrorsSlice;

/**
 * PERSISTENCE RULE (enforced by `partialize` below, not by convention alone):
 * Only `ui` slice fields are ever written to storage. `ops`, `connection`,
 * `tracking`, and `errors` are intentionally excluded — they hold live
 * operational/volatile data (GPS, job status, socket state, transient errors)
 * that must always be re-derived from the server on load, never rehydrated
 * stale from a previous session. If you add a field to another slice and it
 * shows up after a hard refresh when it shouldn't, this is the first place to check.
 */
export const useStore = create<StoreState>()(
  persist(
    (...a) => ({
      ...createUiSlice(...a),
      ...createOpsSlice(...a),
      ...createConnectionSlice(...a),
      ...createTrackingSlice(...a),
      ...createErrorsSlice(...a),
    }),
    {
      name: 'byk-roadrescue-ui',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        theme: state.theme,
        language: state.language,
        lastUsedVehicleType: state.lastUsedVehicleType,
        notificationChannelPrefs: state.notificationChannelPrefs,
        sideNavCollapsed: state.sideNavCollapsed,
        // Deliberately omitted: activeModal (transient), and every field from
        // ops/connection/tracking/errors slices.
      }),
      version: 1,
    }
  )
);

/**
 * Selector helpers — always destructure through these with useShallow to avoid
 * re-rendering, e.g., the whole DispatchQueue on every single GPS ping.
 */
export function useTrackedJob(jobId: string | null) {
  return useStore(
    useShallow((s) => (jobId ? s.jobsById[jobId] ?? null : null))
  );
}

export function useConnectionState() {
  return useStore(
    useShallow((s) => ({
      wsState: s.wsState,
      isPolling: s.isPolling,
      serviceHealth: s.serviceHealth,
    }))
  );
}

export function useIncidentQueue() {
  return useStore(useShallow((s) => s.incidentQueue));
}
