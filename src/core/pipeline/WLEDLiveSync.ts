import { WLEDWebSocketService } from '@/core/wled/WLEDWebSocketService';
import { ledStateProxy } from '@/core/store/ledStateProxy';
import type { WLEDMessage, WLEDLiveMessage } from '@/core/wled/types';

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
 * @returns unsubscribe function — call to stop sync
 */
export function startLiveSync(): () => void {
  const ws = WLEDWebSocketService.getInstance();
  ws.requestLiveStream();

  const unsubscribe = ws.subscribe((msg: WLEDMessage) => {
    if (!isLiveStreamMessage(msg)) return;

    const leds = msg.leds;
    const limit = Math.min(leds.length, 480);

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
