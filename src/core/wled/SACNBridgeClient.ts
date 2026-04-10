/**
 * SACNBridgeClient -- connects to the local sACN/E1.31 bridge via WebSocket.
 *
 * The bridge runs as a separate Node.js process on localhost and forwards
 * binary LED frames to the HyperCube via sACN unicast UDP.
 *
 * Features:
 *   - Auto-reconnect with exponential backoff
 *   - Connection status tracking
 *   - Binary frame sending (672 bytes = 224 LEDs x 3 RGB)
 */

export type BridgeConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface BridgeInfo {
  cubeIp: string;
  ledCount: number;
  universes: number;
  maxFps: number;
}

export interface SACNBridgeClientOptions {
  /** WebSocket URL for the bridge server. @default 'ws://localhost:3001' */
  url?: string;
  /** Max reconnect attempts before giving up. 0 = infinite. @default 0 */
  maxReconnectAttempts?: number;
  /** Base delay for reconnect backoff in ms. @default 1000 */
  reconnectBaseDelay?: number;
  /** Maximum reconnect delay in ms. @default 10000 */
  reconnectMaxDelay?: number;
}

type StatusListener = (status: BridgeConnectionStatus) => void;

export class SACNBridgeClient {
  private ws: WebSocket | null = null;
  private status: BridgeConnectionStatus = 'disconnected';
  private bridgeInfo: BridgeInfo | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempts = 0;
  private destroyed = false;

  private readonly url: string;
  private readonly maxReconnectAttempts: number;
  private readonly reconnectBaseDelay: number;
  private readonly reconnectMaxDelay: number;
  private readonly statusListeners = new Set<StatusListener>();

  constructor(options: SACNBridgeClientOptions = {}) {
    this.url = options.url ?? 'ws://localhost:3001';
    this.maxReconnectAttempts = options.maxReconnectAttempts ?? 0;
    this.reconnectBaseDelay = options.reconnectBaseDelay ?? 1000;
    this.reconnectMaxDelay = options.reconnectMaxDelay ?? 10000;
  }

  /** Current connection status */
  getStatus(): BridgeConnectionStatus {
    return this.status;
  }

  /** Bridge info received after connection (null if not yet connected) */
  getBridgeInfo(): BridgeInfo | null {
    return this.bridgeInfo;
  }

  /** Subscribe to status changes */
  onStatusChange(listener: StatusListener): () => void {
    this.statusListeners.add(listener);
    return () => this.statusListeners.delete(listener);
  }

  private setStatus(status: BridgeConnectionStatus): void {
    if (this.status !== status) {
      this.status = status;
      for (const listener of this.statusListeners) {
        try {
          listener(status);
        } catch {
          // Swallow listener errors
        }
      }
    }
  }

  /** Connect to the bridge. Call once; auto-reconnect handles restarts. */
  connect(): void {
    if (this.destroyed) return;
    if (this.ws?.readyState === WebSocket.OPEN || this.ws?.readyState === WebSocket.CONNECTING) {
      return; // Already connected or connecting
    }

    this.setStatus('connecting');

    try {
      this.ws = new WebSocket(this.url);
      this.ws.binaryType = 'arraybuffer';
    } catch {
      this.setStatus('error');
      this.scheduleReconnect();
      return;
    }

    this.ws.onopen = () => {
      this.reconnectAttempts = 0;
      this.setStatus('connected');
      console.log('[SACNBridge] Connected to bridge at', this.url);
    };

    this.ws.onmessage = (event: MessageEvent) => {
      if (typeof event.data === 'string') {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'bridge-info') {
            this.bridgeInfo = {
              cubeIp: msg.cubeIp,
              ledCount: msg.ledCount,
              universes: msg.universes,
              maxFps: msg.maxFps,
            };
            console.log('[SACNBridge] Bridge info:', this.bridgeInfo);
          }
        } catch {
          // Non-JSON text message
        }
      }
    };

    this.ws.onclose = () => {
      if (!this.destroyed) {
        this.setStatus('disconnected');
        console.log('[SACNBridge] Disconnected from bridge');
        this.scheduleReconnect();
      }
    };

    this.ws.onerror = () => {
      // The close event will fire after this, triggering reconnect
      this.setStatus('error');
    };
  }

  /**
   * Send a frame to the bridge.
   * @param leds - Uint8Array of exactly 672 bytes (224 LEDs x 3 RGB)
   * @returns true if the frame was sent, false if not connected
   */
  sendFrame(leds: Uint8Array): boolean {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return false;
    }

    // Send as binary
    this.ws.send(leds.buffer);
    return true;
  }

  /** Disconnect and stop reconnecting */
  destroy(): void {
    this.destroyed = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.onclose = null;
      this.ws.onerror = null;
      this.ws.close();
      this.ws = null;
    }
    this.setStatus('disconnected');
    this.statusListeners.clear();
  }

  private scheduleReconnect(): void {
    if (this.destroyed) return;
    if (this.maxReconnectAttempts > 0 && this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log('[SACNBridge] Max reconnect attempts reached. Giving up.');
      this.setStatus('error');
      return;
    }

    // Exponential backoff with jitter
    const delay = Math.min(
      this.reconnectBaseDelay * Math.pow(1.5, this.reconnectAttempts) + Math.random() * 500,
      this.reconnectMaxDelay,
    );
    this.reconnectAttempts++;

    console.log(`[SACNBridge] Reconnecting in ${Math.round(delay)}ms (attempt ${this.reconnectAttempts})...`);

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }
}
