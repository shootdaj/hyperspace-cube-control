import { WLEDWebSocketService } from '@/core/wled/WLEDWebSocketService';
import { ledStateProxy } from '@/core/store/ledStateProxy';
import { DEFAULT_LED_COUNT } from '@/core/constants';
import type { WLEDMessage, WLEDLiveMessage } from '@/core/wled/types';
import { paintStore } from '@/stores/paintStore';

function isLiveStreamMessage(msg: WLEDMessage): msg is WLEDLiveMessage {
  return 'leds' in msg && Array.isArray((msg as WLEDLiveMessage).leds);
}

/**
 * Starts the WLED live LED stream and bridges it to ledStateProxy.
 *
 * Sends {"lv": true} to request the stream (WLEDWebSocketService guards
 * against duplicate requests). Each incoming frame with "leds" array
 * is parsed and written directly to ledStateProxy.colors.
 *
 * Zero React re-renders — Three.js reads ledStateProxy in useFrame.
 *
 * NOTE: Live LED streaming requires WebSocket. When WS is unavailable
 * (e.g., Hyperspace firmware hs-1.7 without /ws or /json/live), this
 * returns a no-op. The 3D visualization will still work but won't show
 * real-time LED colors from the device.
 *
 * @returns unsubscribe function — call to stop sync
 */
export function startLiveSync(): () => void {
  const ws = WLEDWebSocketService.getInstance();

  // No-op if WebSocket is not available — live LED mirroring requires WS
  if (ws.isWsAvailable() !== true) {
    console.info('[WLEDLiveSync] WebSocket unavailable — live LED sync disabled');
    return () => {};
  }

  ws.requestLiveStream();

  const unsubscribe = ws.subscribe((msg: WLEDMessage) => {
    if (!isLiveStreamMessage(msg)) return;
    if (paintStore.getState().isPaintMode) return;

    const leds = msg.leds;
    const limit = Math.min(leds.length, DEFAULT_LED_COUNT);

    for (let i = 0; i < limit; i++) {
      const hex = leds[i];
      // Parse "RRGGBB" hex string — no parseInt radix issues: slice + base 16
      ledStateProxy.colors[i * 3] = parseInt(hex.slice(0, 2), 16);
      ledStateProxy.colors[i * 3 + 1] = parseInt(hex.slice(2, 4), 16);
      ledStateProxy.colors[i * 3 + 2] = parseInt(hex.slice(4, 6), 16);
    }
    ledStateProxy.lastUpdated = Date.now();
  });

  return unsubscribe;
}
