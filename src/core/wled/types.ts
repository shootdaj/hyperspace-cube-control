/** Full /json/info response shape (hs-1.6 / hs-1.7 firmware) */
export interface WLEDInfo {
  ver: string;
  vid: number;
  leds: {
    count: number;
    pwr?: number;
    fps?: number;
    maxpwr?: number;
    maxseg?: number;
    rgbw?: boolean;
    pin?: number[];
  };
  name: string;
  udpport?: number;
  live?: boolean;
  fxcount?: number;
  palcount?: number;
  brand?: string;
  product?: string;
  arch?: string;
  core?: string;
  freeheap?: number;
  uptime?: number;
  mac?: string;
  wifi?: {
    bssid: string;
    rssi: number;
    signal: number;
    channel: number;
  };
}

/** Minimal /json/state response used in Phase 1 */
export interface WLEDState {
  on: boolean;
  bri: number;
  transition?: number;
  ps?: number;
  seg: Array<{
    id: number;
    start: number;
    stop: number;
    len: number;
    on: boolean;
    bri: number;
    col: Array<[number, number, number, number]>;
    fx: number;
    sx: number;
    ix: number;
    pal: number;
  }>;
}

/** Live LED stream message */
export interface WLEDLiveMessage {
  leds: string[];  // hex strings e.g. "FF8800"
  n: number;
}

/** Union of all incoming WLED WebSocket message shapes */
export type WLEDMessage =
  | { state: WLEDState; info: WLEDInfo }
  | WLEDLiveMessage
  | Record<string, unknown>;
