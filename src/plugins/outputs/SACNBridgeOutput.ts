import type { OutputPlugin } from '@/core/pipeline/types';
import { SACNBridgeClient, type BridgeConnectionStatus } from '@/core/wled/SACNBridgeClient';

/**
 * SACNBridgeOutput -- OutputPlugin that sends LED data through the local
 * sACN/E1.31 bridge process.
 *
 * The bridge runs as a separate Node.js process (bridge/server.ts) that
 * accepts WebSocket connections and forwards binary LED frames to the
 * HyperCube via sACN unicast UDP.
 *
 * Graceful degradation: if the bridge is not running, frames are silently
 * dropped. The client auto-reconnects when the bridge becomes available.
 *
 * Frame throttle: max 44fps to match sACN spec limit per universe.
 */
export class SACNBridgeOutput implements OutputPlugin {
  readonly id = 'sacn-bridge-output';

  private client: SACNBridgeClient;
  private lastSendTime = 0;
  private readonly minFrameInterval: number; // ms

  // 224 LEDs x 3 bytes = 672 bytes expected frame size
  private static readonly EXPECTED_LED_COUNT = 224;
  private static readonly FRAME_SIZE = SACNBridgeOutput.EXPECTED_LED_COUNT * 3;
  private static readonly MAX_FPS = 44;

  constructor(bridgeUrl = 'ws://localhost:3001') {
    this.minFrameInterval = 1000 / SACNBridgeOutput.MAX_FPS;
    this.client = new SACNBridgeClient({ url: bridgeUrl });
    this.client.connect();
  }

  /** Current bridge connection status */
  getStatus(): BridgeConnectionStatus {
    return this.client.getStatus();
  }

  /** Subscribe to connection status changes */
  onStatusChange(listener: (status: BridgeConnectionStatus) => void): () => void {
    return this.client.onStatusChange(listener);
  }

  /**
   * Send LED data to the cube via the sACN bridge.
   *
   * Accepts LED data and sends the first 224 LEDs (672 bytes) to the cube.
   *
   * @param leds - Uint8Array of RGB bytes from the pipeline
   * @param _brightness - Handled by sACN priority/WLED, not applied here
   */
  send(leds: Uint8Array, _brightness: number): void {
    // Throttle to MAX_FPS
    const now = performance.now();
    if (now - this.lastSendTime < this.minFrameInterval) {
      return;
    }
    this.lastSendTime = now;

    // Extract first 224 LEDs from the pipeline buffer
    const frame = leds.length > SACNBridgeOutput.FRAME_SIZE
      ? leds.slice(0, SACNBridgeOutput.FRAME_SIZE)
      : leds;

    if (frame.length !== SACNBridgeOutput.FRAME_SIZE) {
      // Unexpected frame size -- pad with zeros or skip
      if (frame.length < SACNBridgeOutput.FRAME_SIZE) {
        const padded = new Uint8Array(SACNBridgeOutput.FRAME_SIZE);
        padded.set(frame);
        this.client.sendFrame(padded);
      }
      return;
    }

    this.client.sendFrame(frame);
  }

  /**
   * Send a raw 672-byte frame directly — no conversion or slicing.
   *
   * Used by SACNController for keep-alive and direct frame sending,
   * where the caller has already prepared the exact 224-LED frame.
   *
   * Respects the same frame throttle as send().
   *
   * @param frame - Uint8Array of exactly 672 bytes (224 LEDs x 3 RGB)
   */
  sendRaw(frame: Uint8Array): void {
    // Throttle to MAX_FPS
    const now = performance.now();
    if (now - this.lastSendTime < this.minFrameInterval) {
      return;
    }
    this.lastSendTime = now;

    if (frame.length !== SACNBridgeOutput.FRAME_SIZE) {
      console.warn(`[SACNBridgeOutput] sendRaw expected ${SACNBridgeOutput.FRAME_SIZE} bytes, got ${frame.length}`);
      return;
    }

    this.client.sendFrame(frame);
  }

  /** Access the underlying client — used by SACNController to check connection status */
  getClient(): SACNBridgeClient {
    return this.client;
  }

  destroy(): void {
    this.client.destroy();
  }
}
