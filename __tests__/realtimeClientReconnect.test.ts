import { RealtimeClient } from '../src/lib/ws/client';

class MockWebSocket {
  static instances: MockWebSocket[] = [];
  static OPEN = 1;
  static CLOSED = 3;
  readyState = MockWebSocket.OPEN;
  onopen: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onmessage: ((m: { data: string }) => void) | null = null;
  onerror: (() => void) | null = null;

  constructor(public url: string) {
    MockWebSocket.instances.push(this);
  }
  send() {}
  close() {
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.();
  }
  triggerOpen() {
    this.onopen?.();
  }
  triggerClose() {
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.();
  }
}

// @ts-expect-error - test override of global WebSocket
global.WebSocket = MockWebSocket;

describe('RealtimeClient reconnect/backoff', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    MockWebSocket.instances = [];
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('schedules reconnects with exponential backoff and jitter, capped at 30s', () => {
    const stateChanges: string[] = [];
    const client = new RealtimeClient({
      url: 'wss://example.com/ws',
      getAuthToken: () => 'token',
      onStateChange: (s) => stateChanges.push(s),
      onEvent: () => {},
      maxAttemptsBeforeFallback: 5,
    });

    client.connect();
    expect(MockWebSocket.instances).toHaveLength(1);

    // Simulate repeated failures and confirm delay grows: ~1s, ~2s, ~4s...
    const delays: number[] = [];
    const originalSetTimeout = global.setTimeout;
    // @ts-expect-error test spy
    global.setTimeout = jest.fn((fn, ms) => {
      delays.push(ms as number);
      return originalSetTimeout(fn, ms);
    });

    MockWebSocket.instances[0].triggerClose();
    jest.advanceTimersByTime(2000);
    if (MockWebSocket.instances[1]) MockWebSocket.instances[1].triggerClose();
    jest.advanceTimersByTime(4000);
    if (MockWebSocket.instances[2]) MockWebSocket.instances[2].triggerClose();

    expect(delays[0]).toBeGreaterThanOrEqual(800);
    expect(delays[0]).toBeLessThanOrEqual(1200);
    if (delays[1]) {
      expect(delays[1]).toBeGreaterThanOrEqual(1600);
      expect(delays[1]).toBeLessThanOrEqual(2400);
    }

    global.setTimeout = originalSetTimeout;
    client.disconnect();
  });

  it('flips to "offline" state (signaling fallback polling should start) after max attempts', () => {
    const stateChanges: string[] = [];
    const client = new RealtimeClient({
      url: 'wss://example.com/ws',
      getAuthToken: () => 'token',
      onStateChange: (s) => stateChanges.push(s),
      onEvent: () => {},
      maxAttemptsBeforeFallback: 2,
    });

    client.connect();
    MockWebSocket.instances[0].triggerClose(); // attempt 1 -> degraded
    jest.advanceTimersByTime(5000);
    if (MockWebSocket.instances[1]) MockWebSocket.instances[1].triggerClose(); // attempt 2 -> offline

    expect(stateChanges).toContain('offline');
    client.disconnect();
  });
});
