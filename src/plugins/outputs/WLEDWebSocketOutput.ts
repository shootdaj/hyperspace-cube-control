import type { OutputPlugin } from '@/core/pipeline/types';
import { WLEDWebSocketService } from '@/core/wled/WLEDWebSocketService';

/**
 * WLEDWebSocketOutput — OutputPlugin that sends 480 LED colors to WLED
 * via the WebSocket JSON API.
 *
 * WLED JSON "individual LED" format (seg[0].i):
 * Each group of 3 values [R, G, B] sets one LED.
 * Format: {"seg": [{"i": [R0,G0,B0, R1,G1,B1, ...]}]}
 *
 * WLED requires <= 256 LEDs per request when using seg.i.
 * For 480 LEDs, we must chunk: first 256 in one send, remaining 224 in another.
 * Use seg.start to specify the starting index for the second chunk.
 *
 * Note: brightness is applied by WLED when `bri` is set in the outer object.
 * We do NOT modify the leds array itself for brightness -- let WLED handle it.
 */
export class WLEDWebSocketOutput implements OutputPlugin {
  readonly id = 'wled-websocket-output';

  send(leds: Uint8Array, brightness: number): void {
    const ws = WLEDWebSocketService.getInstance();

    // Chunk 1: LEDs 0-255 (indices 0-767 in the Uint8Array)
    const chunk1: number[] = [];
    const limit1 = Math.min(256, 480);
    for (let i = 0; i < limit1; i++) {
      chunk1.push(leds[i * 3], leds[i * 3 + 1], leds[i * 3 + 2]);
    }

    ws.send({
      bri: brightness,
      seg: [{
        id: 0,
        start: 0,
        i: chunk1,
      }],
    });

    // Chunk 2: LEDs 256-479 (if more than 256 LEDs)
    if (480 > 256) {
      const chunk2: number[] = [];
      for (let i = 256; i < 480; i++) {
        chunk2.push(leds[i * 3], leds[i * 3 + 1], leds[i * 3 + 2]);
      }

      ws.send({
        seg: [{
          id: 0,
          start: 256,
          i: chunk2,
        }],
      });
    }
  }

  destroy(): void {
    // No cleanup needed — WLEDWebSocketService is a singleton managed externally
  }
}
