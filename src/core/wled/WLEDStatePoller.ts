import { WLEDRestClient } from './WLEDRestClient';
import { cubeStateStore } from '@/core/store/cubeStateStore';
import { connectionStore } from '@/core/store/connectionStore';
import { SACNController } from './SACNController';
import { ledStateProxy } from '@/core/store/ledStateProxy';
import { DEFAULT_LED_COUNT } from '@/core/constants';
import { paintStore } from '@/stores/paintStore';
import { WLEDWebSocketService } from './WLEDWebSocketService';

const POLL_INTERVAL_MS = 1_500;

/**
 * REST-based state poller for WLED devices that don't support WebSocket.
 *
 * Polls /json/state every 1.5 seconds and updates cubeStateStore.
 * This replaces WebSocket state sync for firmware like hs-1.7 (Hyperspace)
 * which doesn't have a /ws endpoint.
 *
 * Also manages connection status: sets 'connected' on successful poll,
 * 'reconnecting' on failure.
 *
 * @param ip - Device IP address
 * @returns stop function — call to stop polling
 */
export function startStatePoller(ip: string): () => void {
  const client = new WLEDRestClient(ip);
  let timer: ReturnType<typeof setInterval> | null = null;
  let stopped = false;
  let consecutiveFailures = 0;

  async function poll(): Promise<void> {
    if (stopped) return;
    // Skip polling when sACN is active — ESP32 can't handle HTTP + sACN simultaneously
    try {
      const sacn = SACNController.getInstance();
      if (sacn.isActive()) return;
    } catch { /* not initialized yet */ }
    try {
      const state = await client.getState();
      if (stopped) return;
      consecutiveFailures = 0;
      cubeStateStore.getState().syncFromWLED(state);

      // Sync 3D visualization with firmware effect's primary color.
      // Only when WebSocket live sync is NOT available (it handles ledStateProxy itself).
      // Also skip if paint mode is active — user's painted colors take priority.
      const wsAvailable = WLEDWebSocketService.getInstance().isWsAvailable() === true;
      if (!wsAvailable && !paintStore.getState().isPaintMode) {
        const col = state.seg?.[0]?.col?.[0];
        if (col) {
          const [r, g, b] = col;
          const briFactor = state.bri / 255;
          const colors = ledStateProxy.colors;
          for (let i = 0; i < DEFAULT_LED_COUNT; i++) {
            colors[i * 3] = Math.round(r * briFactor);
            colors[i * 3 + 1] = Math.round(g * briFactor);
            colors[i * 3 + 2] = Math.round(b * briFactor);
          }
          ledStateProxy.lastUpdated = performance.now();
        }
      }

      // Mark connected if we were not already
      const currentStatus = connectionStore.getState().status;
      if (currentStatus !== 'connected') {
        connectionStore.getState().setStatus('connected');
      }
    } catch {
      if (stopped) return;
      consecutiveFailures++;
      // After 3 consecutive failures, mark as reconnecting
      if (consecutiveFailures >= 3) {
        connectionStore.getState().setStatus('reconnecting');
      }
    }
  }

  // Do an initial poll immediately
  void poll();

  // Then poll on interval
  timer = setInterval(() => {
    void poll();
  }, POLL_INTERVAL_MS);

  return () => {
    stopped = true;
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  };
}
