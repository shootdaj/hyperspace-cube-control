import { WLEDWebSocketService } from '@/core/wled/WLEDWebSocketService';
import { connectionStore } from '@/core/store/connectionStore';
import { DEFAULT_LED_COUNT, DEFAULT_FRAME_SIZE } from '@/core/constants';

/**
 * Convert an RGB byte triplet to a 6-character hex string ("RRGGBB").
 *
 * WLED's seg.i JSON parser uses type-checking to distinguish LED indices
 * from colors: plain integers are indices, strings/arrays are colors.
 * Encoding colors as hex strings ensures WLED interprets them correctly
 * and is the most compact format per the WLED docs.
 */
function rgbToHex(r: number, g: number, b: number): string {
  return (
    (r < 16 ? '0' : '') + r.toString(16) +
    (g < 16 ? '0' : '') + g.toString(16) +
    (b < 16 ? '0' : '') + b.toString(16)
  );
}

/**
 * Groups sorted indices into contiguous ranges.
 * [0,1,2,5,6,10] → [{start:0,end:2},{start:5,end:6},{start:10,end:10}]
 */
function buildRanges(sorted: number[]): { start: number; end: number }[] {
  if (sorted.length === 0) return [];
  const ranges: { start: number; end: number }[] = [];
  let start = sorted[0];
  let end = sorted[0];
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] === end + 1) {
      end = sorted[i];
    } else {
      ranges.push({ start, end });
      start = sorted[i];
      end = sorted[i];
    }
  }
  ranges.push({ start, end });
  return ranges;
}

/**
 * WLEDPaintOutput — sends only changed LEDs to WLED via WebSocket
 * for real-time paint feedback with <50ms perceived latency.
 *
 * Diff strategy: compares current buffer against last-sent state,
 * groups changed LEDs into contiguous ranges, and sends minimal
 * JSON payloads using WLED's seg.i format.
 *
 * Throttled to ~30fps to avoid overwhelming the ESP32.
 * Use sendAll() for bulk operations (clear/fill) that bypass diffing.
 */
export class WLEDPaintOutput {
  private lastSent = new Uint8Array(DEFAULT_FRAME_SIZE);
  private pendingBuffer: Uint8Array | null = null;
  private throttleTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly THROTTLE_MS = 33; // ~30fps

  /**
   * Send paint changes with diff-based optimization and throttling.
   * Only sends LEDs that changed since last successful send.
   */
  sendPaint(buffer: Uint8Array): void {
    this.pendingBuffer = new Uint8Array(buffer); // snapshot
    if (!this.throttleTimer) {
      this.flush();
      this.throttleTimer = setTimeout(() => {
        this.throttleTimer = null;
        if (this.pendingBuffer) {
          this.flush();
        }
      }, this.THROTTLE_MS);
    }
  }

  private flush(): void {
    if (!this.pendingBuffer) return;
    const buf = this.pendingBuffer;
    this.pendingBuffer = null;

    // Find changed LED indices
    const changed: number[] = [];
    for (let i = 0; i < DEFAULT_LED_COUNT; i++) {
      const off = i * 3;
      if (
        buf[off] !== this.lastSent[off] ||
        buf[off + 1] !== this.lastSent[off + 1] ||
        buf[off + 2] !== this.lastSent[off + 2]
      ) {
        changed.push(i);
      }
    }

    if (changed.length === 0) return;

    // Build contiguous ranges and send each.
    // WLED seg.i format: [startIndex, "RRGGBB", "RRGGBB", ...]
    // Colors MUST be hex strings (or [R,G,B] arrays), NOT flat integers.
    // WLED's parser (json.cpp) uses JSON type-checking: integers = LED indices,
    // strings/arrays = colors. Flat integers would all be misread as indices.
    const ranges = buildRanges(changed);
    const ws = WLEDWebSocketService.getInstance();
    const useRest = ws.isWsAvailable() !== true;

    for (const range of ranges) {
      const payload: (number | string)[] = [range.start];
      for (let i = range.start; i <= range.end; i++) {
        payload.push(rgbToHex(buf[i * 3], buf[i * 3 + 1], buf[i * 3 + 2]));
      }
      if (useRest) {
        // REST fallback for firmware without WebSocket (hs-1.7) and native apps
        const ip = connectionStore.getState().ip;
        if (ip) {
          fetch(`http://${ip}/json/state`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ seg: [{ id: 0, i: payload }] }),
          }).catch(() => {});
        }
      } else {
        ws.send({ seg: [{ id: 0, i: payload }] });
      }
    }

    // Update last-sent state
    this.lastSent.set(buf);
  }

  /**
   * Send full LED frame to WLED, bypassing diff.
   * Used for clear/fill operations.
   * 224 LEDs fits in a single chunk (under WLED's 256 limit).
   */
  sendAll(buffer: Uint8Array): void {
    const ws = WLEDWebSocketService.getInstance();
    const useRest = ws.isWsAvailable() !== true;

    // 224 LEDs fits in a single chunk.
    // Colors encoded as hex strings for WLED seg.i format.
    const chunk: (number | string)[] = [0]; // start index
    for (let i = 0; i < DEFAULT_LED_COUNT; i++) {
      chunk.push(rgbToHex(buffer[i * 3], buffer[i * 3 + 1], buffer[i * 3 + 2]));
    }
    const payload = { seg: [{ id: 0, i: chunk }] };
    if (useRest) {
      const ip = connectionStore.getState().ip;
      if (ip) {
        fetch(`http://${ip}/json/state`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }).catch(() => {});
      }
    } else {
      ws.send(payload);
    }

    // Update last-sent state
    this.lastSent.set(buffer.subarray(0, DEFAULT_FRAME_SIZE));
  }

  /**
   * Clear the last-sent buffer, forcing a full diff on next sendPaint().
   */
  reset(): void {
    this.lastSent.fill(0);
  }

  /**
   * Clean up throttle timer.
   */
  destroy(): void {
    if (this.throttleTimer) {
      clearTimeout(this.throttleTimer);
      this.throttleTimer = null;
    }
    this.pendingBuffer = null;
  }
}
