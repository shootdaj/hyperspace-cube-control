import { WLEDWebSocketService } from './WLEDWebSocketService';
import { cubeStateStore } from '@/core/store/cubeStateStore';
import type { WLEDMessage, WLEDState } from './types';

/**
 * Type guard: is this a full state+info message from WLED?
 * WLED sends these on connect and after any state change.
 */
function isStateMessage(msg: WLEDMessage): msg is { state: WLEDState; info: unknown } {
  return 'state' in msg && typeof (msg as Record<string, unknown>).state === 'object';
}

/**
 * Starts subscribing to WLED WebSocket messages and syncing state to cubeStateStore.
 *
 * This handles the "reconciliation" half of the optimistic update pattern:
 * - WLEDControlService does optimistic updates (instant UI feedback)
 * - WebSocket pushes the actual device state back
 * - This sync overwrites the store with ground truth
 *
 * @returns unsubscribe function — call to stop syncing
 */
export function startStateSync(): () => void {
  const ws = WLEDWebSocketService.getInstance();

  const unsubscribe = ws.subscribe((msg: WLEDMessage) => {
    if (!isStateMessage(msg)) return;

    // syncFromWLED handles extracting on, bri, fx, pal, sx, ix, colors from seg[0]
    cubeStateStore.getState().syncFromWLED(msg.state);
  });

  return unsubscribe;
}
