import { connectionStore } from '../store/connectionStore';
import type { WLEDMessage } from './types';

type Subscriber = (msg: WLEDMessage) => void;

/**
 * Singleton WebSocket service for WLED communication.
 *
 * IMPORTANT CONSTRAINTS:
 * - Never call `new WebSocket()` outside this class
 * - Max 4 WebSocket clients allowed by WLED -- singleton prevents exceeding this
 * - `{"lv":true}` is exclusive: only one live stream subscriber at a time
 * - Always reconnect on `onclose`, not just on `onerror`
 *
 * WS AVAILABILITY:
 * - On connect(), tries a quick WebSocket handshake with a 3s timeout.
 * - If it fails (close code 1006 or timeout), sets wsAvailable = false and stops retrying.
 * - Hyperspace firmware (hs-1.7) does NOT have /ws — this avoids infinite reconnect loops.
 * - Callers can check isWsAvailable() to decide whether to use WS or REST polling.
 */
export class WLEDWebSocketService {
  private static instance: WLEDWebSocketService | null = null;
  private ws: WebSocket | null = null;
  private subscribers = new Set<Subscriber>();
  private liveStreamActive = false;
  private reconnectAttempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private currentIp = '';
  private destroyed = false;
  private _wsAvailable: boolean | null = null; // null = unknown, true = yes, false = no
  private connectTimeoutTimer: ReturnType<typeof setTimeout> | null = null;

  private readonly BASE_DELAY_MS = 500;
  private readonly MAX_DELAY_MS = 30_000;
  private readonly WS_PROBE_TIMEOUT_MS = 3_000;

  private constructor() {}

  static getInstance(): WLEDWebSocketService {
    if (!WLEDWebSocketService.instance) {
      WLEDWebSocketService.instance = new WLEDWebSocketService();
    }
    return WLEDWebSocketService.instance;
  }

  /** Reset singleton -- only for testing */
  static _resetForTest(): void {
    WLEDWebSocketService.instance?.disconnect();
    WLEDWebSocketService.instance = null;
  }

  /**
   * Whether WebSocket is available on the target device.
   * - null: not yet probed
   * - true: WS connected successfully
   * - false: WS failed (firmware doesn't support /ws)
   */
  isWsAvailable(): boolean | null {
    return this._wsAvailable;
  }

  connect(ip: string): void {
    // Already connected to this IP -- no-op
    if (this.ws?.readyState === WebSocket.OPEN && this.currentIp === ip) return;

    // If we already determined WS is unavailable for this IP, don't retry
    if (this._wsAvailable === false && this.currentIp === ip) return;

    // Close existing connection before opening new one
    if (this.ws) {
      this.ws.onclose = null; // prevent reconnect on intentional close
      this.ws.close();
    }
    if (this.connectTimeoutTimer) {
      clearTimeout(this.connectTimeoutTimer);
      this.connectTimeoutTimer = null;
    }

    this.currentIp = ip;
    this.destroyed = false;
    connectionStore.getState().setStatus('connecting');

    try {
      this.ws = new WebSocket(`ws://${ip}/ws`);
    } catch {
      this._wsAvailable = false;
      connectionStore.getState().setStatus('disconnected');
      return;
    }

    // Set a timeout: if WS doesn't open within WS_PROBE_TIMEOUT_MS, give up
    this.connectTimeoutTimer = setTimeout(() => {
      if (this.ws && this.ws.readyState !== WebSocket.OPEN) {
        console.warn('[WLEDWebSocketService] WebSocket probe timed out — marking WS unavailable');
        this._wsAvailable = false;
        this.destroyed = true; // prevent onclose from triggering reconnect
        this.ws.onclose = null;
        this.ws.close();
        this.ws = null;
        // Don't set disconnected — let REST polling handle connection status
      }
    }, this.WS_PROBE_TIMEOUT_MS);

    this.ws.onopen = () => {
      if (this.connectTimeoutTimer) {
        clearTimeout(this.connectTimeoutTimer);
        this.connectTimeoutTimer = null;
      }
      this._wsAvailable = true;
      this.reconnectAttempt = 0;
      this.liveStreamActive = false; // Reset on reconnect
      connectionStore.getState().setStatus('connected');
      this.ws!.send(JSON.stringify({ v: true })); // Request full state
    };

    this.ws.onmessage = (e: MessageEvent<string>) => {
      let msg: WLEDMessage;
      try {
        msg = JSON.parse(e.data) as WLEDMessage;
      } catch {
        return;
      }
      this.subscribers.forEach((fn) => fn(msg));
    };

    this.ws.onclose = (event: CloseEvent) => {
      if (this.connectTimeoutTimer) {
        clearTimeout(this.connectTimeoutTimer);
        this.connectTimeoutTimer = null;
      }
      if (this.destroyed) return;

      // Close code 1006 = abnormal closure (no server at /ws endpoint)
      // If we haven't successfully connected yet, this means WS is unavailable
      if (this._wsAvailable === null && event.code === 1006) {
        console.warn('[WLEDWebSocketService] WebSocket closed with 1006 — marking WS unavailable');
        this._wsAvailable = false;
        // Don't set disconnected — let REST polling handle connection status
        return;
      }

      // If WS was previously available but connection dropped, try reconnecting
      if (this._wsAvailable === true) {
        connectionStore.getState().setStatus('reconnecting');
        this.scheduleReconnect(ip);
      }
    };

    this.ws.onerror = () => {
      // onerror always fires before onclose on unclean close
      // reconnect logic lives in onclose -- don't duplicate here
    };
  }

  private scheduleReconnect(ip: string): void {
    if (this.destroyed) return;
    // Don't reconnect if WS was determined to be unavailable
    if (this._wsAvailable === false) return;

    const jitter = Math.random() * 1000;
    const delay = Math.min(
      this.BASE_DELAY_MS * Math.pow(2, this.reconnectAttempt) + jitter,
      this.MAX_DELAY_MS,
    );
    this.reconnectAttempt++;
    this.reconnectTimer = setTimeout(() => {
      if (!this.destroyed) this.connect(ip);
    }, delay);
  }

  /**
   * Subscribe to all incoming WLED WebSocket messages.
   * @returns Unsubscribe function -- call to stop receiving messages.
   */
  subscribe(fn: Subscriber): () => void {
    this.subscribers.add(fn);
    return () => this.subscribers.delete(fn);
  }

  /**
   * Send `{"lv":true}` to enable live LED stream.
   * Guards against duplicate requests -- WLED only allows one live stream subscriber.
   */
  requestLiveStream(): void {
    if (!this.liveStreamActive && this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ lv: true }));
      this.liveStreamActive = true;
    }
  }

  /** Send an arbitrary JSON payload to WLED. No-op if not connected. */
  send(payload: Record<string, unknown>): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(payload));
    }
  }

  get readyState(): number {
    return this.ws?.readyState ?? WebSocket.CLOSED;
  }

  disconnect(): void {
    this.destroyed = true;
    if (this.connectTimeoutTimer) {
      clearTimeout(this.connectTimeoutTimer);
      this.connectTimeoutTimer = null;
    }
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.onclose = null; // prevent reconnect loop
      this.ws.close();
      this.ws = null;
    }
    this.liveStreamActive = false;
    this.reconnectAttempt = 0;
    connectionStore.getState().setStatus('disconnected');
  }

  /**
   * Reset WS availability flag — call when switching to a different device IP
   * so the next connect() will probe again.
   */
  resetWsAvailability(): void {
    this._wsAvailable = null;
  }
}
