import { create } from 'zustand';
import type { WLEDState, CubeSegment, WLEDColor } from './types';

interface CubeStateStore {
  on: boolean;
  brightness: number;
  effectIndex: number;
  paletteIndex: number;
  speed: number;
  intensity: number;
  colors: WLEDColor[];
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
  setColors: (colors: WLEDColor[]) => void;
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
  colors: [[255, 160, 0], [0, 0, 0], [0, 0, 0]] as WLEDColor[],
  segments: [],
  firmwareVersion: '',
  ledCount: 480,
  setOn: (on) => set({ on }),
  setBrightness: (brightness) => set({ brightness }),
  setEffectIndex: (effectIndex) => set({ effectIndex }),
  setPaletteIndex: (paletteIndex) => set({ paletteIndex }),
  setSpeed: (speed) => set({ speed }),
  setIntensity: (intensity) => set({ intensity }),
  setColors: (colors) => set({ colors }),
  syncFromWLED: (state) => {
    const seg0 = state.seg[0];
    const update: Partial<CubeStateStore> = {
      on: state.on,
      brightness: state.bri,
      segments: state.seg,
    };
    if (seg0) {
      update.effectIndex = seg0.fx;
      update.paletteIndex = seg0.pal;
      update.speed = seg0.sx;
      update.intensity = seg0.ix;
      // Extract RGB colors from seg[0].col, stripping optional alpha channel
      if (seg0.col && seg0.col.length > 0) {
        update.colors = seg0.col.map((c) => [c[0], c[1], c[2]] as WLEDColor);
      }
    }
    set(update);
  },
  setFirmwareVersion: (firmwareVersion) => set({ firmwareVersion }),
  setLedCount: (ledCount) => set({ ledCount }),
}));
