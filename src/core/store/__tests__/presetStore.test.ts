import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { presetStore } from '../presetStore';
import { cubeStateStore } from '../cubeStateStore';

// Mock WLEDControlService
const mockBatchUpdate = vi.fn().mockResolvedValue(undefined);
vi.mock('@/core/wled/WLEDControlService', () => ({
  WLEDControlService: {
    getInstance: () => ({
      batchUpdate: mockBatchUpdate,
    }),
  },
}));

// Mock crypto.randomUUID
let uuidCounter = 0;
vi.stubGlobal('crypto', {
  randomUUID: () => `test-uuid-${++uuidCounter}`,
});

const STORAGE_KEY = 'hypercube-presets';

describe('presetStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    uuidCounter = 0;
    localStorage.removeItem(STORAGE_KEY);
    presetStore.setState({ presets: [] });
    cubeStateStore.setState({
      on: true,
      brightness: 200,
      effectIndex: 10,
      paletteIndex: 3,
      speed: 180,
      intensity: 100,
      colors: [[255, 0, 0], [0, 255, 0], [0, 0, 255]],
    });
  });

  afterEach(() => {
    localStorage.removeItem(STORAGE_KEY);
  });

  it('savePreset creates a preset with name, id, timestamp, and current cube state', () => {
    presetStore.getState().savePreset('My Preset');
    const presets = presetStore.getState().presets;
    expect(presets).toHaveLength(1);
    expect(presets[0].name).toBe('My Preset');
    expect(presets[0].id).toBe('test-uuid-1');
    expect(presets[0].createdAt).toBeGreaterThan(0);
    expect(presets[0].state.bri).toBe(200);
    expect(presets[0].state.fx).toBe(10);
    expect(presets[0].state.pal).toBe(3);
    expect(presets[0].state.sx).toBe(180);
    expect(presets[0].state.ix).toBe(100);
    expect(presets[0].state.col).toEqual([[255, 0, 0], [0, 255, 0], [0, 0, 255]]);
  });

  it('savePreset stores to localStorage', () => {
    presetStore.getState().savePreset('Test');
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(stored).toHaveLength(1);
    expect(stored[0].name).toBe('Test');
  });

  it('loadPresets reads from localStorage and populates store', () => {
    const mockPresets = [{
      id: 'stored-1',
      name: 'Stored Preset',
      createdAt: 1000,
      state: { on: true, bri: 128, fx: 0, pal: 0, sx: 128, ix: 128, col: [[255, 255, 255]] },
    }];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(mockPresets));

    presetStore.getState().loadPresets();
    expect(presetStore.getState().presets).toHaveLength(1);
    expect(presetStore.getState().presets[0].name).toBe('Stored Preset');
  });

  it('deletePreset removes preset by id and updates localStorage', () => {
    presetStore.getState().savePreset('First');
    presetStore.getState().savePreset('Second');
    expect(presetStore.getState().presets).toHaveLength(2);

    presetStore.getState().deletePreset('test-uuid-1');
    expect(presetStore.getState().presets).toHaveLength(1);
    expect(presetStore.getState().presets[0].name).toBe('Second');

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(stored).toHaveLength(1);
  });

  it('max 50 presets enforced — saving 51st replaces oldest', () => {
    // Save 50 presets
    for (let i = 0; i < 50; i++) {
      presetStore.getState().savePreset(`Preset ${i}`);
    }
    expect(presetStore.getState().presets).toHaveLength(50);

    // Save 51st — should drop oldest
    presetStore.getState().savePreset('Overflow');
    const presets = presetStore.getState().presets;
    expect(presets).toHaveLength(50);
    expect(presets[0].name).toBe('Preset 1'); // Preset 0 was dropped
    expect(presets[49].name).toBe('Overflow');
  });

  it('preset survives simulated browser refresh', () => {
    presetStore.getState().savePreset('Persistent');

    // Simulate refresh: clear store, reload from localStorage
    presetStore.setState({ presets: [] });
    presetStore.getState().loadPresets();

    expect(presetStore.getState().presets).toHaveLength(1);
    expect(presetStore.getState().presets[0].name).toBe('Persistent');
  });

  it('applyPreset calls WLEDControlService.batchUpdate with preset state', () => {
    presetStore.getState().savePreset('Apply Me');
    const presetId = presetStore.getState().presets[0].id;

    presetStore.getState().applyPreset(presetId, '10.0.0.1');
    expect(mockBatchUpdate).toHaveBeenCalledWith({
      on: true,
      bri: 200,
      seg: [{ fx: 10, pal: 3, sx: 180, ix: 100, col: [[255, 0, 0], [0, 255, 0], [0, 0, 255]] }],
    });
  });
});
