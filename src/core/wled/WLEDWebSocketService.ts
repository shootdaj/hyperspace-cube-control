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

  private readonly BASE_DELAY_MS = 500;
  private readonly MAX_DELAY_MS = 30_000;

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

  connect(ip: string): void {
    // Already connected to this IP -- no-op
    if (this.ws?.readyState === WebSocket.OPEN && this.currentIp === ip) return;
    // Close existing connection before opening new one
    if (this.ws) {
      this.ws.onclose = null; // prevent reconnect on intentional close
      this.ws.close();
    }

    this.currentIp = ip;
    this.destroyed = false;
    connectionStore.getState().setStatus('connecting');

    try {
      this.ws = new WebSocket(`ws://${ip}/ws`);
    } catch {
      connectionStore.getState().setStatus('disconnected');
      return;
    }

    this.ws.onopen = () => {
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

    this.ws.onclose = () => {
      if (this.destroyed) return;
      connectionStore.getState().setStatus('reconnecting');
      this.scheduleReconnect(ip);
    };

    this.ws.onerror = () => {
      // onerror always fires before onclose on unclean close
      // reconnect logic lives in onclose -- don't duplicate here
    };
  }

  private scheduleReconnect(ip: string): void {
    if (this.destroyed) return;
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
}
