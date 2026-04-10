import { WLEDRestClient } from './WLEDRestClient';
import { cubeStateStore } from '@/core/store/cubeStateStore';
import { connectionStore } from '@/core/store/connectionStore';
import { SACNController } from './SACNController';

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
