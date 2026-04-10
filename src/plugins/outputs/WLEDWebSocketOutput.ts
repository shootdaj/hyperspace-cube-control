import type { OutputPlugin } from '@/core/pipeline/types';
import { WLEDWebSocketService } from '@/core/wled/WLEDWebSocketService';
import { DEFAULT_LED_COUNT } from '@/core/constants';

/**
 * WLEDWebSocketOutput — OutputPlugin that sends 224 LED colors to WLED
 * via the WebSocket JSON API.
 *
 * WLED JSON "individual LED" format (seg[0].i):
 * Each group of 3 values [R, G, B] sets one LED.
 * Format: {"seg": [{"i": [R0,G0,B0, R1,G1,B1, ...]}]}
 *
 * WLED requires <= 256 LEDs per request when using seg.i.
 * For 224 LEDs, a single chunk suffices (224 < 256).
 *
 * Note: brightness is applied by WLED when `bri` is set in the outer object.
 * We do NOT modify the leds array itself for brightness -- let WLED handle it.
 */
export class WLEDWebSocketOutput implements OutputPlugin {
  readonly id = 'wled-websocket-output';

  send(leds: Uint8Array, brightness: number): void {
    const ws = WLEDWebSocketService.getInstance();

    // 224 LEDs fits in a single chunk (under 256 limit)
    const chunk: number[] = [];
    const limit = Math.min(DEFAULT_LED_COUNT, leds.length / 3);
    for (let i = 0; i < limit; i++) {
      chunk.push(leds[i * 3], leds[i * 3 + 1], leds[i * 3 + 2]);
    }

    ws.send({
      bri: brightness,
      seg: [{
        id: 0,
        start: 0,
        i: chunk,
      }],
    });
  }

  destroy(): void {
    // No cleanup needed — WLEDWebSocketService is a singleton managed externally
  }
}
