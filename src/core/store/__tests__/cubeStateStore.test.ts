import { describe, it, expect, beforeEach } from 'vitest';
import { cubeStateStore } from '../cubeStateStore';
import type { WLEDState } from '../types';

describe('cubeStateStore', () => {
  beforeEach(() => {
    cubeStateStore.setState({
      on: false,
      brightness: 128,
      effectIndex: 0,
      paletteIndex: 0,
      speed: 128,
      intensity: 128,
      segments: [],
      firmwareVersion: '',
      ledCount: 480,
    });
  });

  it('TestCubeStateStore_InitialOn_IsFalse', () => {
    expect(cubeStateStore.getState().on).toBe(false);
  });

  it('TestCubeStateStore_InitialBrightness_Is128', () => {
    expect(cubeStateStore.getState().brightness).toBe(128);
  });

  it('TestCubeStateStore_SetOn_UpdatesToTrue', () => {
    cubeStateStore.getState().setOn(true);
    expect(cubeStateStore.getState().on).toBe(true);
  });

  it('TestCubeStateStore_SetBrightness_Updates', () => {
    cubeStateStore.getState().setBrightness(200);
    expect(cubeStateStore.getState().brightness).toBe(200);
  });

  it('TestCubeStateStore_SetEffectIndex_Updates', () => {
    cubeStateStore.getState().setEffectIndex(5);
    expect(cubeStateStore.getState().effectIndex).toBe(5);
  });

  it('TestCubeStateStore_SetPaletteIndex_Updates', () => {
    cubeStateStore.getState().setPaletteIndex(3);
    expect(cubeStateStore.getState().paletteIndex).toBe(3);
  });

  it('TestCubeStateStore_SyncFromWLED_UpdatesOnAndBrightness', () => {
    const wledState: WLEDState = {
      on: true,
      bri: 200,
      seg: [{
        id: 0,
        start: 0,
        stop: 480,
        len: 480,
        on: true,
        bri: 200,
        col: [[255, 0, 0]],
        fx: 12,
        sx: 100,
        ix: 200,
        pal: 5,
      }],
    };
    cubeStateStore.getState().syncFromWLED(wledState);
    const state = cubeStateStore.getState();
    expect(state.on).toBe(true);
    expect(state.brightness).toBe(200);
    expect(state.effectIndex).toBe(12);
    expect(state.paletteIndex).toBe(5);
    expect(state.speed).toBe(100);
    expect(state.intensity).toBe(200);
    expect(state.segments).toHaveLength(1);
  });

  it('TestCubeStateStore_SyncFromWLED_HandleEmptySegments', () => {
    const wledState: WLEDState = {
      on: false,
      bri: 50,
      seg: [],
    };
    cubeStateStore.getState().syncFromWLED(wledState);
    const state = cubeStateStore.getState();
    expect(state.on).toBe(false);
    expect(state.brightness).toBe(50);
    // effectIndex stays at default when no segments
    expect(state.effectIndex).toBe(0);
  });
});
