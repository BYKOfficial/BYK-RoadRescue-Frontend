import { StateCreator } from 'zustand';
import type { StoreState } from '../index';

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
        { ...err, id: crypto.randomUUID(), createdAt: new Date().toISOString() },
      ].slice(-10), // cap so a runaway loop can't leak memory into an unbounded array
    })),
  dismissError: (id) => set((s) => ({ errors: s.errors.filter((e) => e.id !== id) })),
  clearAllErrors: () => set({ errors: [] }),
});
