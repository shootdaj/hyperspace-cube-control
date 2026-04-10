import { SACNBridgeOutput } from '@/plugins/outputs/SACNBridgeOutput';
import { WLEDRestClient } from './WLEDRestClient';
import { ledStateProxy } from '@/core/store/ledStateProxy';
import type { WLEDState } from '@/core/store/types';

/**
 * SACNController — manages the full sACN session lifecycle for the HyperCube.
 *
 * Problem: The cube runs built-in patterns on its ESP32. When sACN stops sending,
 * the pattern resumes after ~2.5s timeout. This controller:
 *
 *   1. Saves the cube's current state before takeover
 *   2. Kills the built-in pattern (fx:0, bri:0) so sACN has sole control
 *   3. Sends keep-alive frames at 30fps — even when no new data arrives —
 *      preventing the cube from reverting to its local pattern
 *   4. Restores the saved state when sACN control stops
 *
 * Usage:
 *   const ctrl = SACNController.getInstance();
 *   await ctrl.startControl('192.168.1.100');
 *   ctrl.sendFrame(myLedData);  // 672 bytes = 224 LEDs x 3 RGB
 *   await ctrl.stopControl();
 */
export class SACNController {
  private static instance: SACNController | null = null;

  private sacnOutput: SACNBridgeOutput;
  private restClient: WLEDRestClient | null = null;
  private keepAliveInterval: ReturnType<typeof setInterval> | null = null;
  private lastFrame: Uint8Array = new Uint8Array(672); // 224 LEDs x 3 bytes
  private active = false;
  private paused = false;
  private savedState: WLEDState | null = null;
  private controlledIp: string | null = null;

  /** Keep-alive rate: 30fps = 33.3ms per frame */
  private static readonly KEEPALIVE_INTERVAL_MS = 33;

  /** Frame size: 224 LEDs x 3 bytes (RGB) */
  static readonly FRAME_SIZE = 672;

  private constructor(sacnOutput: SACNBridgeOutput) {
    this.sacnOutput = sacnOutput;
  }

  /**
   * Get the singleton instance. Requires an SACNBridgeOutput to be passed
   * on first call (subsequent calls reuse the existing instance).
   */
  static getInstance(sacnOutput?: SACNBridgeOutput): SACNController {
    if (!SACNController.instance) {
      if (!sacnOutput) {
        throw new Error('[SACNController] First call to getInstance() must provide an SACNBridgeOutput');
      }
      SACNController.instance = new SACNController(sacnOutput);
    }
    return SACNController.instance;
  }

  /** Reset the singleton — for testing only */
  static _resetForTest(): void {
    if (SACNController.instance) {
      SACNController.instance.stopKeepAlive();
    }
    SACNController.instance = null;
  }

  /**
   * Start sACN control of the cube.
   *
   * 1. Saves the cube's current state (GET /json/state)
   * 2. Kills the local pattern (POST fx:0, bri:0)
   * 3. Starts the keep-alive loop at 30fps
   */
  async startControl(ip: string): Promise<void> {
    if (this.active) {
      console.warn('[SACNController] Already active, ignoring startControl()');
      return;
    }

    this.controlledIp = ip;
    this.restClient = new WLEDRestClient(ip);

    // 1. Save current cube state for later restoration
    try {
      this.savedState = await this.restClient.getState();
      console.log('[SACNController] Saved cube state:', {
        on: this.savedState.on,
        bri: this.savedState.bri,
        fx: this.savedState.seg[0]?.fx,
        pal: this.savedState.seg[0]?.pal,
      });
    } catch (err) {
      console.warn('[SACNController] Could not save cube state:', err);
      this.savedState = null;
    }

    // 2. Kill local pattern: turn on, disable built-in effect (fx:0 = Solid)
    //    Keep brightness at max so sACN raw values aren't multiplied down
    try {
      await this.restClient.setState({
        on: true,
        bri: 255,
        seg: [{ fx: 0, sx: 0, ix: 0 }],
      });
      console.log('[SACNController] Killed local pattern (fx:0, bri:255)');
    } catch (err) {
      console.warn('[SACNController] Failed to kill local pattern:', err);
    }

    // 3. Initialize frame buffer with the cube's current color (not black)
    this.lastFrame.fill(0);
    if (this.savedState?.seg?.[0]?.col?.[0]) {
      const [r, g, b] = this.savedState.seg[0].col[0];
      const bri = this.savedState.bri / 255;
      for (let i = 0; i < 224; i++) {
        this.lastFrame[i * 3] = Math.round(r * bri);
        this.lastFrame[i * 3 + 1] = Math.round(g * bri);
        this.lastFrame[i * 3 + 2] = Math.round(b * bri);
      }
      console.log(`[SACNController] Initial frame: rgb(${r},${g},${b}) @ bri ${this.savedState.bri}`);
      // Sync 3D visualization with the cube's current color
      ledStateProxy.colors.set(this.lastFrame);
      ledStateProxy.lastUpdated = performance.now();
    }

    // 4. Start keep-alive loop at 30fps
    this.startKeepAlive();

    this.active = true;
    console.log('[SACNController] Started sACN control for', ip);
  }

  /**
   * Send an LED frame to the cube via sACN bridge.
   *
   * The frame is stored as the "last frame" so the keep-alive loop
   * continues to resend it even when no new data arrives.
   *
   * @param leds - Uint8Array of exactly 672 bytes (224 LEDs x 3 RGB)
   */
  sendFrame(leds: Uint8Array): void {
    if (!this.active) return;

    // Store as lastFrame for keep-alive resending
    if (leds.length >= SACNController.FRAME_SIZE) {
      this.lastFrame.set(leds.subarray(0, SACNController.FRAME_SIZE));
    } else {
      this.lastFrame.fill(0);
      this.lastFrame.set(leds);
    }

    // Send through the bridge output (raw, no conversion)
    this.sacnOutput.sendRaw(this.lastFrame);
  }

  /**
   * Send an LED frame with brightness scaling applied.
   *
   * Scales all RGB values by brightness/255 before sending.
   *
   * @param leds - Uint8Array of LED data (672 bytes)
   * @param brightness - Brightness level 0-255
   */
  sendFrameWithBrightness(leds: Uint8Array, brightness: number): void {
    if (!this.active) return;

    const scaled = new Uint8Array(SACNController.FRAME_SIZE);
    const len = Math.min(leds.length, SACNController.FRAME_SIZE);
    const factor = brightness / 255;

    for (let i = 0; i < len; i++) {
      scaled[i] = Math.round(leds[i] * factor);
    }

    this.sendFrame(scaled);
  }

  /**
   * Stop sACN control and restore the cube to its previous state.
   *
   * 1. Stops the keep-alive loop
   * 2. Restores saved brightness, effect, palette, and colors
   */
  async stopControl(): Promise<void> {
    if (!this.active) return;

    this.active = false;

    // 1. Stop keep-alive loop
    this.stopKeepAlive();

    // 2. Restore saved state
    if (this.savedState && this.restClient) {
      try {
        const seg0 = this.savedState.seg[0];
        const restorePayload: Record<string, unknown> = {
          on: this.savedState.on,
          bri: this.savedState.bri,
        };

        if (seg0) {
          restorePayload.seg = [{
            fx: seg0.fx,
            sx: seg0.sx,
            ix: seg0.ix,
            pal: seg0.pal,
            col: seg0.col,
          }];
        }

        await this.restClient.setState(restorePayload);
        console.log('[SACNController] Restored cube state');
      } catch (err) {
        console.warn('[SACNController] Failed to restore cube state:', err);
      }
    }

    this.savedState = null;
    this.controlledIp = null;
    this.restClient = null;
    this.paused = false;
    this.lastFrame.fill(0);
    console.log('[SACNController] Stopped sACN control');
  }

  /**
   * Pause sACN control — stops the keep-alive loop so the cube's firmware
   * can run built-in effects. Does NOT tear down the session or restore state.
   * Call resumeControl() to re-enter sACN mode.
   */
  async pauseControl(): Promise<void> {
    if (!this.active || this.paused) return;

    this.paused = true;
    this.stopKeepAlive();

    // Tell the cube it's free to run its own effects: restore brightness
    // so firmware effects are visible (sACN startup sets bri:0)
    if (this.restClient) {
      try {
        await this.restClient.setState({ bri: 255 });
        console.log('[SACNController] Paused — firmware has control');
      } catch (err) {
        console.warn('[SACNController] Failed to restore brightness on pause:', err);
      }
    }
  }

  /**
   * Resume sACN control after a pause. Kills the firmware effect and
   * restarts the keep-alive loop.
   */
  async resumeControl(): Promise<void> {
    if (!this.active || !this.paused) return;

    // Kill local pattern again for sACN takeover
    if (this.restClient) {
      try {
        await this.restClient.setState({
          on: true,
          bri: 0,
          seg: [{ fx: 0, sx: 0, ix: 0 }],
        });
        console.log('[SACNController] Resumed — sACN has control');
      } catch (err) {
        console.warn('[SACNController] Failed to kill local pattern on resume:', err);
      }
    }

    this.paused = false;
    this.startKeepAlive();
  }

  /** Whether sACN control is currently active (started and not paused) */
  isActive(): boolean {
    return this.active && !this.paused;
  }

  /** Whether sACN control is started (regardless of pause state) */
  isStarted(): boolean {
    return this.active;
  }

  /** Whether sACN control is paused (firmware mode) */
  isPaused(): boolean {
    return this.paused;
  }

  /** The IP address currently being controlled */
  getControlledIp(): string | null {
    return this.controlledIp;
  }

  /** Get a copy of the current frame being sent */
  getLastFrame(): Uint8Array {
    return new Uint8Array(this.lastFrame);
  }

  private startKeepAlive(): void {
    this.stopKeepAlive();

    this.keepAliveInterval = setInterval(() => {
      if (!this.active) return;
      // Resend the last frame to prevent the cube from timing out
      this.sacnOutput.sendRaw(this.lastFrame);
    }, SACNController.KEEPALIVE_INTERVAL_MS);

    console.log(`[SACNController] Keep-alive started at ${Math.round(1000 / SACNController.KEEPALIVE_INTERVAL_MS)}fps`);
  }

  private stopKeepAlive(): void {
    if (this.keepAliveInterval !== null) {
      clearInterval(this.keepAliveInterval);
      this.keepAliveInterval = null;
      console.log('[SACNController] Keep-alive stopped');
    }
  }
}
