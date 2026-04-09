import { create } from 'zustand';
import type { WLEDRestClient } from '@/core/wled/WLEDRestClient';

interface EffectPaletteStore {
  effects: string[];
  palettes: string[];
  fetchEffects: (client: WLEDRestClient) => Promise<void>;
  fetchPalettes: (client: WLEDRestClient) => Promise<void>;
}

export type { EffectPaletteStore };

export const effectPaletteStore = create<EffectPaletteStore>()((set) => ({
  effects: [],
  palettes: [],
  fetchEffects: async (client) => {
    const effects = await client.getEffects();
    set({ effects });
  },
  fetchPalettes: async (client) => {
    const palettes = await client.getPalettes();
    set({ palettes });
  },
}));
