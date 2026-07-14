import { WSEvent, WS_SCHEMA_VERSION } from '@byk/ws-schema';

type Listener = (event: WSEvent) => void;
type ConnState = 'connecting' | 'online' | 'degraded' | 'offline';

interface RealtimeClientOptions {
  url: string;
  getAuthToken: () => string | null;
  onStateChange: (state: ConnState) => void;
  onEvent: Listener;
  /** After this many consecutive failed reconnect attempts, caller should
   * start fallback polling (see ../polling/fallbackPoll.ts). */
  maxAttemptsBeforeFallback?: number;
}

const BASE_DELAY_MS = 1000;
const MAX_DELAY_MS = 30000;

export class RealtimeClient {
  private ws: WebSocket | null = null;
  private attempt = 0;
  private lastEventSeqByRoom = new Map<string, number>();
  private rooms = new Set<string>();
  private closedByUser = false;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private opts: RealtimeClientOptions) {}

  connect() {
    this.closedByUser = false;
    this.opts.onStateChange('connecting');
    this.openSocket();
  }

  disconnect() {
    this.closedByUser = true;
    this.clearTimers();
    this.ws?.close(1000, 'client_disconnect');
  }

  joinRoom(roomId: string) {
    this.rooms.add(roomId);
    this.send({ op: 'join', roomId, sinceSeq: this.lastEventSeqByRoom.get(roomId) ?? 0 });
  }

  leaveRoom(roomId: string) {
    this.rooms.delete(roomId);
    this.send({ op: 'leave', roomId });
  }

  private openSocket() {
    const token = this.opts.getAuthToken();
    const ws = new WebSocket(`${this.opts.url}?token=${encodeURIComponent(token ?? '')}`);
    this.ws = ws;

    ws.onopen = () => {
      this.attempt = 0;
      this.opts.onStateChange('online');
      // Re-join all rooms with resume cursor so the server can send a gap-fill
      // snapshot instead of the client silently missing events from the outage window.
      for (const roomId of this.rooms) {
        this.send({ op: 'join', roomId, sinceSeq: this.lastEventSeqByRoom.get(roomId) ?? 0 });
      }
      this.startHeartbeat();
    };

    ws.onmessage = (msg) => {
      let event: WSEvent;
      try {
        event = JSON.parse(msg.data);
      } catch {
        return; // malformed frame — drop, don't crash the socket loop
      }
      if (!isCompatibleVersion(event.schemaVersion)) {
        this.opts.onStateChange('degraded');
        return;
      }
      const lastSeq = this.lastEventSeqByRoom.get(event.roomId) ?? -1;
      if (event.eventSeq <= lastSeq) return; // duplicate/out-of-order — drop
      this.lastEventSeqByRoom.set(event.roomId, event.eventSeq);
      this.opts.onEvent(event);
    };

    ws.onclose = () => {
      this.stopHeartbeat();
      if (this.closedByUser) return;
      this.opts.onStateChange(
        this.attempt >= (this.opts.maxAttemptsBeforeFallback ?? 3) ? 'offline' : 'degraded'
      );
      this.scheduleReconnect();
    };

    ws.onerror = () => {
      // onclose fires right after in browsers — no separate handling needed here.
    };
  }

  private scheduleReconnect() {
    this.attempt += 1;
    const jitter = 0.8 + Math.random() * 0.4; // +/-20%
    const delay = Math.min(MAX_DELAY_MS, BASE_DELAY_MS * 2 ** (this.attempt - 1)) * jitter;
    this.reconnectTimer = setTimeout(() => this.openSocket(), delay);
  }

  private startHeartbeat() {
    this.heartbeatTimer = setInterval(() => this.send({ op: 'ping' }), 20000);
  }

  private stopHeartbeat() {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = null;
  }

  private clearTimers() {
    this.stopHeartbeat();
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
  }

  private send(obj: unknown) {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(obj));
  }
}

function isCompatibleVersion(remote: string): boolean {
  const [remoteMajor] = remote.split('.');
  const [localMajor] = WS_SCHEMA_VERSION.split('.');
  return remoteMajor === localMajor;
}
