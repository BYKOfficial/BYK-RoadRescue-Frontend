import { StateCreator } from 'zustand';
import type { StoreState } from '../index';

/**
 * `crypto.randomUUID()` requires a secure context (HTTPS or localhost) and
 * isn't implemented at all in some test environments (jsdom) or older
 * WebViews some technician-app users may be on. An error-reporting slice
 * throwing because it couldn't generate an ID for the error is exactly the
 * kind of self-inflicted crash this whole product is designed to avoid, so
 * this falls back to a non-cryptographic ID instead of throwing.
 */
function safeRandomId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `err_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export interface AppError {
  id: string;
  code: string;
  message: string;
  retryable: boolean;
  createdAt: string;
  context?: Record<string, unknown>;
}

export interface ErrorsSlice {
  errors: AppError[];
  pushError: (err: Omit<AppError, 'id' | 'createdAt'>) => void;
  dismissError: (id: string) => void;
  clearAllErrors: () => void;
}

export const createErrorsSlice: StateCreator<StoreState, [], [], ErrorsSlice> = (set) => ({
  errors: [],
  pushError: (err) =>
    set((s) => ({
      errors: [
        ...s.errors,
        { ...err, id: safeRandomId(), createdAt: new Date().toISOString() },
      ].slice(-10), // cap so a runaway loop can't leak memory into an unbounded array
    })),
  dismissError: (id) => set((s) => ({ errors: s.errors.filter((e) => e.id !== id) })),
  clearAllErrors: () => set({ errors: [] }),
});
