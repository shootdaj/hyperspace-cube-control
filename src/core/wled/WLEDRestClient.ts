import type { WLEDInfo, WLEDState } from './types';

/**
 * Serialized REST client for WLED JSON API.
 *
 * CRITICAL: WLED ESP32 firmware cannot handle parallel HTTP requests.
 * All calls are queued and executed one at a time via the internal async queue.
 *
 * NEVER call fetch('/json/...') directly from components or stores.
 * Always go through WLEDRestClient methods.
 */
export class WLEDRestClient {
  private queue: Array<() => Promise<void>> = [];
  private processing = false;

  constructor(private readonly ip: string) {}

  private async processNext(): Promise<void> {
    if (this.processing || this.queue.length === 0) return;
    this.processing = true;
    const task = this.queue.shift()!;
    try {
      await task();
    } finally {
      this.processing = false;
      void this.processNext();
    }
  }

  private enqueue<T>(task: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.queue.push(async () => {
        try {
          resolve(await task());
        } catch (e) {
          reject(e);
        }
      });
      void this.processNext();
    });
  }

  /** Fetch firmware info -- call at startup to validate IP and probe firmware version */
  getInfo(): Promise<WLEDInfo> {
    return this.enqueue(async () => {
      const res = await fetch(`http://${this.ip}/json/info`);
      if (!res.ok) throw new Error(`WLED /json/info failed: ${res.status}`);
      return res.json() as Promise<WLEDInfo>;
    });
  }

  /** Fetch current cube state */
  getState(): Promise<WLEDState> {
    return this.enqueue(async () => {
      const res = await fetch(`http://${this.ip}/json/state`);
      if (!res.ok) throw new Error(`WLED /json/state failed: ${res.status}`);
      return res.json() as Promise<WLEDState>;
    });
  }

  /** Send a partial state update. Merges with existing state server-side. */
  setState(partial: Record<string, unknown>): Promise<void> {
    return this.enqueue(async () => {
      const res = await fetch(`http://${this.ip}/json/state`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(partial),
      });
      if (!res.ok) throw new Error(`WLED setState failed: ${res.status}`);
    });
  }

  /** Fetch effect list (array of effect name strings) */
  getEffects(): Promise<string[]> {
    return this.enqueue(async () => {
      const res = await fetch(`http://${this.ip}/json/eff`);
      if (!res.ok) throw new Error(`WLED /json/eff failed: ${res.status}`);
      return res.json() as Promise<string[]>;
    });
  }

  /** Fetch palette list (array of palette name strings) */
  getPalettes(): Promise<string[]> {
    return this.enqueue(async () => {
      const res = await fetch(`http://${this.ip}/json/pal`);
      if (!res.ok) throw new Error(`WLED /json/pal failed: ${res.status}`);
      return res.json() as Promise<string[]>;
    });
  }

  /**
   * Write per-LED colors in chunks of <=256 LEDs per request.
   * Required because ESP32 has a 24KB request buffer limit.
   * Used starting in Phase 4 (manual painting).
   *
   * @param leds - Uint8Array of length ledCount*3 (RGB per LED)
   * @param chunkSize - Max LEDs per request (default 256, max 256)
   */
  setLEDs(leds: Uint8Array, chunkSize = 256): Promise<void> {
    const promises: Array<Promise<void>> = [];
    for (let start = 0; start < leds.length / 3; start += chunkSize) {
      const end = Math.min(start + chunkSize, leds.length / 3);
      const chunk = leds.slice(start * 3, end * 3);
      const ledArray: Array<[number, number, number]> = [];
      for (let i = 0; i < chunk.length; i += 3) {
        ledArray.push([chunk[i], chunk[i + 1], chunk[i + 2]]);
      }
      promises.push(
        this.setState({
          seg: [{
            id: 0,
            i: [start, ...ledArray.flat()],
          }],
        }),
      );
    }
    return Promise.all(promises).then(() => undefined);
  }

  /** Current queue depth -- useful for tests and diagnostics */
  get queueDepth(): number {
    return this.queue.length + (this.processing ? 1 : 0);
  }
}
