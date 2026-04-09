import { describe, it, expect, vi, beforeEach } from 'vitest';
import { effectPaletteStore } from '../effectPaletteStore';
import type { WLEDRestClient } from '@/core/wled/WLEDRestClient';

function createMockClient(effects: string[], palettes: string[]): WLEDRestClient {
  return {
    getEffects: vi.fn().mockResolvedValue(effects),
    getPalettes: vi.fn().mockResolvedValue(palettes),
  } as unknown as WLEDRestClient;
}

describe('effectPaletteStore', () => {
  beforeEach(() => {
    effectPaletteStore.setState({ effects: [], palettes: [] });
  });

  it('fetchEffects populates effects array from WLEDRestClient', async () => {
    const mockEffects = ['Solid', 'Blink', 'Breathe', 'Rainbow'];
    const client = createMockClient(mockEffects, []);

    await effectPaletteStore.getState().fetchEffects(client);

    expect(effectPaletteStore.getState().effects).toEqual(mockEffects);
    expect(client.getEffects).toHaveBeenCalled();
  });

  it('fetchPalettes populates palettes array from WLEDRestClient', async () => {
    const mockPalettes = ['Default', 'Party', 'Cloud', 'Lava'];
    const client = createMockClient([], mockPalettes);

    await effectPaletteStore.getState().fetchPalettes(client);

    expect(effectPaletteStore.getState().palettes).toEqual(mockPalettes);
    expect(client.getPalettes).toHaveBeenCalled();
  });

  it('effects array is string[] of effect names', async () => {
    const client = createMockClient(['Solid', 'Blink'], []);
    await effectPaletteStore.getState().fetchEffects(client);

    const effects = effectPaletteStore.getState().effects;
    expect(Array.isArray(effects)).toBe(true);
    effects.forEach((e) => expect(typeof e).toBe('string'));
  });
});
