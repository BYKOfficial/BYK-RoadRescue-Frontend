import { StateCreator } from 'zustand';
import type { StoreState } from '../index';

export type ThemeMode = 'dark' | 'light' | 'hc';
export type Language = 'en' | 'hi' | 'or'; // English, Hindi, Odia (Odisha-first rollout)

/**
 * UI slice — the ONLY slice with a persist() wrapper applied at the store root.
 * Rule: nothing volatile/operational lives here. If you're tempted to add
 * `currentJobId` here for "convenience," don't — that belongs in `tracking`,
 * which is explicitly excluded from persistence (see store/index.ts partialize).
 */
export interface UiSlice {
  theme: ThemeMode;
  language: Language;
  lastUsedVehicleType: 'car' | 'bike' | 'ev' | 'commercial' | null;
  notificationChannelPrefs: { whatsapp: boolean; sms: boolean; push: boolean; email: boolean };
  sideNavCollapsed: boolean;
  activeModal: string | null;

  setTheme: (theme: ThemeMode) => void;
  setLanguage: (lang: Language) => void;
  setLastUsedVehicleType: (v: UiSlice['lastUsedVehicleType']) => void;
  setNotificationChannelPref: (channel: keyof UiSlice['notificationChannelPrefs'], value: boolean) => void;
  toggleSideNav: () => void;
  openModal: (modalId: string) => void;
  closeModal: () => void;
}

export const createUiSlice: StateCreator<StoreState, [], [], UiSlice> = (set) => ({
  theme: 'dark',
  language: 'en',
  lastUsedVehicleType: null,
  notificationChannelPrefs: { whatsapp: true, sms: true, push: true, email: false },
  sideNavCollapsed: false,
  activeModal: null,

  setTheme: (theme) => set({ theme }),
  setLanguage: (language) => set({ language }),
  setLastUsedVehicleType: (lastUsedVehicleType) => set({ lastUsedVehicleType }),
  setNotificationChannelPref: (channel, value) =>
    set((s) => ({ notificationChannelPrefs: { ...s.notificationChannelPrefs, [channel]: value } })),
  toggleSideNav: () => set((s) => ({ sideNavCollapsed: !s.sideNavCollapsed })),
  openModal: (activeModal) => set({ activeModal }),
  closeModal: () => set({ activeModal: null }),
});
