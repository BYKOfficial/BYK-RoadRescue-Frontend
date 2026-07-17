import '@testing-library/jest-dom';

// Reset the shared Zustand store between tests so state from one test file
// never leaks into the next (the store module is a singleton by design —
// see src/store/index.ts — which is correct for the app but needs this
// guard in the test environment).
afterEach(() => {
  localStorage.clear();
});
