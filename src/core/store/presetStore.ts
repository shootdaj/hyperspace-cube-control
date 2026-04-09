import { create } from 'zustand';
import { cubeStateStore } from './cubeStateStore';
import type { WLEDColor } from './types';
import { WLEDControlService } from '@/core/wled/WLEDControlService';

const STORAGE_KEY = 'hypercube-presets';
const MAX_PRESETS = 50;

export interface Preset {
  id: string;
  name: string;
  createdAt: number;
  state: {
    on: boolean;
    bri: number;
    fx: number;
    pal: number;
    sx: number;
    ix: number;
    col: WLEDColor[];
  };
}

interface PresetStore {
  presets: Preset[];
  loadPresets: () => void;
  savePreset: (name: string) => void;
  deletePreset: (id: string) => void;
  applyPreset: (id: string, ip: string) => void;
}

export type { PresetStore };

function persistToStorage(presets: Preset[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(presets));
  } catch {
    // localStorage full or unavailable — silently fail
  }
}

export const presetStore = create<PresetStore>()((set, get) => ({
  presets: [],

  loadPresets: () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const presets = JSON.parse(raw) as Preset[];
        set({ presets });
      }
    } catch {
      // Corrupted data — start fresh
      set({ presets: [] });
    }
  },

  savePreset: (name) => {
    const cube = cubeStateStore.getState();
    const preset: Preset = {
      id: crypto.randomUUID(),
      name,
      createdAt: Date.now(),
      state: {
        on: cube.on,
        bri: cube.brightness,
        fx: cube.effectIndex,
        pal: cube.paletteIndex,
        sx: cube.speed,
        ix: cube.intensity,
        col: [...cube.colors],
      },
    };

    let presets = [...get().presets, preset];
    // Enforce 50-preset limit — remove oldest
    while (presets.length > MAX_PRESETS) {
      presets.shift();
    }

    set({ presets });
    persistToStorage(presets);
  },

  deletePreset: (id) => {
    const presets = get().presets.filter((p) => p.id !== id);
    set({ presets });
    persistToStorage(presets);
  },

  applyPreset: (id, ip) => {
    const preset = get().presets.find((p) => p.id === id);
    if (!preset) return;

    const service = WLEDControlService.getInstance(ip);
    service.batchUpdate({
      on: preset.state.on,
      bri: preset.state.bri,
      seg: [{
        fx: preset.state.fx,
        pal: preset.state.pal,
        sx: preset.state.sx,
        ix: preset.state.ix,
        col: preset.state.col,
      }],
    });
  },
}));
