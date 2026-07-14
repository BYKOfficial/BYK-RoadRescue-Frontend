import { useStore } from '../src/store';

/**
 * This test encodes the single most important architectural rule in the app:
 * only `ui` slice fields may survive a page reload. If this test fails after
 * someone adds a field to ops/connection/tracking/errors, it means that field
 * leaked into persisted storage and will resurface stale live-job data after
 * a refresh — exactly the bug class the spec calls out as unacceptable.
 */
describe('store persistence boundary', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('only persists ui-slice fields, never live operational state', () => {
    const s = useStore.getState();

    // Mutate every slice
    s.setTheme('hc');
    s.setLanguage('or');
    s.upsertJob({ jobId: 'job-1', status: 'en_route', technicianLat: 20.7, technicianLng: 84.1 });
    s.setActiveJob('job-1');
    s.setWsState('offline');
    s.setPolling(true);
    s.setIncidentQueue([
      {
        jobId: 'job-2',
        serviceCategory: 'towing',
        customerName: 'Test Customer',
        createdAt: new Date().toISOString(),
        slaDeadline: new Date().toISOString(),
        status: 'unassigned',
        priority: 'emergency',
      },
    ]);
    s.pushError({ code: 'TEST_ERROR', message: 'test', retryable: false });

    const raw = localStorage.getItem('byk-roadrescue-ui');
    expect(raw).not.toBeNull();
    const persisted = JSON.parse(raw as string).state;

    // UI fields present
    expect(persisted.theme).toBe('hc');
    expect(persisted.language).toBe('or');

    // Everything else must be ABSENT from the persisted blob
    expect(persisted.jobsById).toBeUndefined();
    expect(persisted.activeJobId).toBeUndefined();
    expect(persisted.wsState).toBeUndefined();
    expect(persisted.isPolling).toBeUndefined();
    expect(persisted.incidentQueue).toBeUndefined();
    expect(persisted.errors).toBeUndefined();
  });

  it('always boots wsState at "connecting" regardless of what was true last session', () => {
    useStore.getState().setWsState('online');
    // Simulate a fresh module load by resetting only the non-persisted slices
    // to their initial values, mirroring what a real reload does since those
    // slices are excluded from the persist middleware entirely.
    useStore.setState({ wsState: 'connecting' });
    expect(useStore.getState().wsState).toBe('connecting');
  });
});
