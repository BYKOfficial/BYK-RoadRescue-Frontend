import { StateCreator } from 'zustand';
import type { StoreState } from '../index';
import type { ServiceName } from '@byk/ws-schema';

export type ConnState = 'connecting' | 'online' | 'degraded' | 'offline';

export interface ServiceHealth {
  status: 'healthy' | 'degraded' | 'down';
  latencyMs: number | null;
  message?: string;
  lastUpdatedAt: string;
}

/**
 * connection slice — never persisted. On app boot this always starts at
 * 'connecting' and gets re-derived from a live handshake, never from
 * whatever it happened to be last session.
 */
export interface ConnectionSlice {
  wsState: ConnState;
  isPolling: boolean;         // true when fallback polling has kicked in
  reconnectAttempt: number;
  lastConnectedAt: string | null;
  serviceHealth: Partial<Record<ServiceName, ServiceHealth>>;

  setWsState: (state: ConnState) => void;
  setPolling: (isPolling: boolean) => void;
  bumpReconnectAttempt: () => void;
  resetReconnectAttempt: () => void;
  setServiceHealth: (service: ServiceName, health: Omit<ServiceHealth, 'lastUpdatedAt'>) => void;
}

export const createConnectionSlice: StateCreator<StoreState, [], [], ConnectionSlice> = (set) => ({
  wsState: 'connecting',
  isPolling: false,
  reconnectAttempt: 0,
  lastConnectedAt: null,
  serviceHealth: {},

  setWsState: (wsState) =>
    set({ wsState, ...(wsState === 'online' ? { lastConnectedAt: new Date().toISOString() } : {}) }),
  setPolling: (isPolling) => set({ isPolling }),
  bumpReconnectAttempt: () => set((s) => ({ reconnectAttempt: s.reconnectAttempt + 1 })),
  resetReconnectAttempt: () => set({ reconnectAttempt: 0 }),
  setServiceHealth: (service, health) =>
    set((s) => ({
      serviceHealth: {
        ...s.serviceHealth,
        [service]: { ...health, lastUpdatedAt: new Date().toISOString() },
      },
    })),
});
