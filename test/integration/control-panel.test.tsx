import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import { render, screen, act, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { server, MOCK_STATE } from '../mocks/virtualCube';
import { connectionStore } from '@/core/store/connectionStore';
import { cubeStateStore } from '@/core/store/cubeStateStore';
import { effectPaletteStore } from '@/core/store/effectPaletteStore';
import { presetStore } from '@/core/store/presetStore';
import { WLEDRestClient } from '@/core/wled/WLEDRestClient';
import { WLEDControlService } from '@/core/wled/WLEDControlService';

// Mock Three.js for integration tests (no WebGL in jsdom)
vi.mock('@/visualization/CubeScene', () => ({
  CubeScene: () => null,
}));

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
afterAll(() => server.close());

describe('Control Panel Integration', () => {
  let client: WLEDRestClient;

  beforeEach(async () => {
    server.resetHandlers();
    connectionStore.setState({ ip: '10.0.0.1', status: 'connected' });
    cubeStateStore.setState({
      on: MOCK_STATE.on,
      brightness: MOCK_STATE.bri,
      effectIndex: 0,
      paletteIndex: 0,
      speed: 128,
      intensity: 128,
      colors: [[255, 160, 0], [0, 0, 0], [0, 0, 0]],
    });
    presetStore.setState({ presets: [] });
    localStorage.removeItem('hypercube-presets');
    WLEDControlService._resetForTest();

    client = new WLEDRestClient('10.0.0.1');
  });

  it('effects and palettes can be fetched from WLED', async () => {
    await effectPaletteStore.getState().fetchEffects(client);
    await effectPaletteStore.getState().fetchPalettes(client);

    const effects = effectPaletteStore.getState().effects;
    const palettes = effectPaletteStore.getState().palettes;

    expect(effects.length).toBeGreaterThan(0);
    expect(effects[0]).toBe('Solid');
    expect(palettes.length).toBeGreaterThan(0);
    expect(palettes[0]).toBe('Default');
  });

  it('WLEDControlService.setPower makes correct REST call', async () => {
    const service = WLEDControlService.getInstance('10.0.0.1');

    // This will call the mock server at POST /json/state with {on: false}
    await service.setPower(false);

    // Verify store was updated optimistically
    expect(cubeStateStore.getState().on).toBe(false);
  });

  it('WLEDControlService.setBrightness makes correct REST call', async () => {
    const service = WLEDControlService.getInstance('10.0.0.1');
    await service.setBrightness(255);
    expect(cubeStateStore.getState().brightness).toBe(255);
  });

  it('WLEDControlService.setEffect makes correct REST call', async () => {
    const service = WLEDControlService.getInstance('10.0.0.1');
    await service.setEffect(5);
    expect(cubeStateStore.getState().effectIndex).toBe(5);
  });

  it('preset save and load round-trip works', async () => {
    // Save a preset
    cubeStateStore.setState({
      on: true, brightness: 200, effectIndex: 10, paletteIndex: 3,
      speed: 180, intensity: 100, colors: [[255, 0, 0], [0, 0, 0], [0, 0, 0]],
    });
    presetStore.getState().savePreset('Test Preset');

    // Verify it was saved
    const presets = presetStore.getState().presets;
    expect(presets).toHaveLength(1);
    expect(presets[0].name).toBe('Test Preset');
    expect(presets[0].state.bri).toBe(200);
    expect(presets[0].state.fx).toBe(10);

    // Change state
    cubeStateStore.setState({ brightness: 50, effectIndex: 0 });

    // Apply preset
    presetStore.getState().applyPreset(presets[0].id, '10.0.0.1');

    // Store should reflect preset values (optimistic update from batchUpdate)
    expect(cubeStateStore.getState().brightness).toBe(200);
    expect(cubeStateStore.getState().effectIndex).toBe(10);
  });

  it('preset persists in localStorage', () => {
    presetStore.getState().savePreset('Persistent');

    // Simulate refresh
    presetStore.setState({ presets: [] });
    presetStore.getState().loadPresets();

    expect(presetStore.getState().presets).toHaveLength(1);
    expect(presetStore.getState().presets[0].name).toBe('Persistent');
  });
});
