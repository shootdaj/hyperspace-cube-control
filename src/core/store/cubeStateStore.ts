import { create } from 'zustand';
import type { WLEDState, CubeSegment } from './types';

interface CubeStateStore {
  on: boolean;
  brightness: number;
  effectIndex: number;
  paletteIndex: number;
  speed: number;
  intensity: number;
  segments: CubeSegment[];
  firmwareVersion: string;
  ledCount: number;
  // Actions
  setOn: (on: boolean) => void;
  setBrightness: (brightness: number) => void;
  setEffectIndex: (index: number) => void;
  setPaletteIndex: (index: number) => void;
  setSpeed: (speed: number) => void;
  setIntensity: (intensity: number) => void;
  /** Bulk update from /json/state WebSocket message or REST response */
  syncFromWLED: (state: WLEDState) => void;
  setFirmwareVersion: (version: string) => void;
  setLedCount: (count: number) => void;
}

export type { CubeStateStore };

export const cubeStateStore = create<CubeStateStore>()((set) => ({
  on: false,
  brightness: 128,
  effectIndex: 0,
  paletteIndex: 0,
  speed: 128,
  intensity: 128,
  segments: [],
  firmwareVersion: '',
  ledCount: 480,
  setOn: (on) => set({ on }),
  setBrightness: (brightness) => set({ brightness }),
  setEffectIndex: (effectIndex) => set({ effectIndex }),
  setPaletteIndex: (paletteIndex) => set({ paletteIndex }),
  setSpeed: (speed) => set({ speed }),
  setIntensity: (intensity) => set({ intensity }),
  syncFromWLED: (state) => set({
    on: state.on,
    brightness: state.bri,
    segments: state.seg,
    // Sync from first segment if available
    ...(state.seg[0] ? {
      effectIndex: state.seg[0].fx,
      paletteIndex: state.seg[0].pal,
      speed: state.seg[0].sx,
      intensity: state.seg[0].ix,
    } : {}),
  }),
  setFirmwareVersion: (firmwareVersion) => set({ firmwareVersion }),
  setLedCount: (ledCount) => set({ ledCount }),
}));
