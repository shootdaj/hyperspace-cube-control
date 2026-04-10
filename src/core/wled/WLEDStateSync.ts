import { WLEDWebSocketService } from './WLEDWebSocketService';
import { cubeStateStore } from '@/core/store/cubeStateStore';
import { startStatePoller } from './WLEDStatePoller';
import { connectionStore } from '@/core/store/connectionStore';
import type { WLEDMessage } from './types';
import type { WLEDState as StoreWLEDState } from '@/core/store/types';

/**
 * Type guard: is this a full state+info message from WLED?
 * WLED sends these on connect and after any state change.
 */
function isStateMessage(msg: WLEDMessage): msg is { state: StoreWLEDState; info: unknown } {
  return 'state' in msg && typeof (msg as Record<string, unknown>).state === 'object';
}

/**
 * Starts state sync — automatically picks the best transport:
 *
 * - If WebSocket is available: subscribes to WS messages (fastest, push-based)
 * - If WebSocket is unavailable: starts REST polling at 1.5s intervals
 *
 * This handles the "reconciliation" half of the optimistic update pattern:
 * - WLEDControlService does optimistic updates (instant UI feedback)
 * - WS push or REST poll provides the actual device state
 * - This sync overwrites the store with ground truth
 *
 * @param ip - Device IP address (needed for REST polling fallback)
 * @returns unsubscribe function — call to stop syncing
 */
export function startStateSync(ip?: string): () => void {
  const ws = WLEDWebSocketService.getInstance();

  // If WebSocket is available, use the WS-based sync
  if (ws.isWsAvailable() === true) {
    const unsubscribe = ws.subscribe((msg: WLEDMessage) => {
      if (!isStateMessage(msg)) return;
      cubeStateStore.getState().syncFromWLED(msg.state);
    });
    return unsubscribe;
  }

  // WebSocket unavailable — fall back to REST polling
  const deviceIp = ip || connectionStore.getState().ip;
  if (!deviceIp) {
    console.warn('[WLEDStateSync] No IP available for REST polling fallback');
    return () => {};
  }

  console.info('[WLEDStateSync] WebSocket unavailable, using REST polling for state sync');
  const stopPoller = startStatePoller(deviceIp);
  return stopPoller;
}
