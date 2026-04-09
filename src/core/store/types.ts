export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'reconnecting';

/** RGB color as three integers 0-255 */
export type WLEDColor = [number, number, number];

/** A WLED segment (partial -- only fields used in Phase 1) */
export interface CubeSegment {
  id: number;
  start: number;
  stop: number;
  len: number;
  on: boolean;
  bri: number;
  col: WLEDColor[];
  fx: number;  // effect index
  sx: number;  // speed
  ix: number;  // intensity
  pal: number; // palette index
}

/** Full WLED /json/state shape (partial -- fields relevant to this app) */
export interface WLEDState {
  on: boolean;
  bri: number;
  transition?: number;
  seg: CubeSegment[];
}
