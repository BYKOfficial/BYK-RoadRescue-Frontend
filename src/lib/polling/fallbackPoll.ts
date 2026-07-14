/**
 * Fallback polling — activates when RealtimeClient reports 'offline' (WS unreachable
 * after maxAttemptsBeforeFallback). Keeps the customer/technician/dispatcher screens
 * alive with a slower but honest cadence instead of a frozen or blank UI.
 */

export interface PollTarget {
  jobId: string;
  fetchSnapshot: () => Promise<JobSnapshot>;
}

export interface JobSnapshot {
  jobId: string;
  status: string;
  technicianLat: number | null;
  technicianLng: number | null;
  etaSeconds: number | null;
  updatedAt: string;
}

const POLL_INTERVAL_MS = 15000;

export class FallbackPoller {
  private timer: ReturnType<typeof setInterval> | null = null;
  private inFlight = false;

  constructor(
    private target: PollTarget,
    private onSnapshot: (s: JobSnapshot) => void,
    private onError: (err: unknown) => void
  ) {}

  start() {
    this.stop();
    this.tick(); // fetch immediately, don't wait 15s for the first paint
    this.timer = setInterval(() => this.tick(), POLL_INTERVAL_MS);
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  private async tick() {
    if (this.inFlight) return; // don't stack requests if one is slow
    this.inFlight = true;
    try {
      const snapshot = await this.target.fetchSnapshot();
      this.onSnapshot(snapshot);
    } catch (err) {
      this.onError(err);
    } finally {
      this.inFlight = false;
    }
  }
}
