import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { startStateSync } from '../WLEDStateSync';
import { cubeStateStore } from '@/core/store/cubeStateStore';
import { WLEDWebSocketService } from '../WLEDWebSocketService';
import type { WLEDMessage } from '../types';

// Capture subscribers registered with the WebSocket service
let capturedSubscriber: ((msg: WLEDMessage) => void) | null = null;

vi.mock('../WLEDWebSocketService', () => ({
  WLEDWebSocketService: {
    getInstance: () => ({
      subscribe: vi.fn((fn: (msg: WLEDMessage) => void) => {
        capturedSubscriber = fn;
        return () => { capturedSubscriber = null; };
      }),
    }),
  },
}));

describe('WLEDStateSync', () => {
  beforeEach(() => {
    capturedSubscriber = null;
    cubeStateStore.setState({
      on: false,
      brightness: 128,
      effectIndex: 0,
      paletteIndex: 0,
      speed: 128,
      intensity: 128,
      colors: [[255, 160, 0], [0, 0, 0], [0, 0, 0]],
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('syncs cubeStateStore when receiving state message from WebSocket', () => {
    startStateSync();
    expect(capturedSubscriber).not.toBeNull();

    const msg: WLEDMessage = {
      state: {
        on: true,
        bri: 200,
        seg: [{
          id: 0, start: 0, stop: 480, len: 480,
          on: true, bri: 255,
          col: [[255, 0, 0, 0], [0, 255, 0, 0], [0, 0, 255, 0]],
          fx: 42, sx: 180, ix: 100, pal: 7,
        }],
      },
      info: {
        ver: 'hs-1.6', vid: 2406290,
        leds: { count: 480, pwr: 0, fps: 0, maxpwr: 850, maxseg: 32 },
        name: 'HyperCube', udpport: 21324, live: false,
        fxcount: 118, palcount: 71,
        wifi: { bssid: '', rssi: -60, signal: 80, channel: 6 },
      },
    };

    capturedSubscriber!(msg);

    const state = cubeStateStore.getState();
    expect(state.on).toBe(true);
    expect(state.brightness).toBe(200);
    expect(state.effectIndex).toBe(42);
    expect(state.paletteIndex).toBe(7);
    expect(state.speed).toBe(180);
    expect(state.intensity).toBe(100);
  });

  it('syncs colors from seg[0].col (strips alpha channel)', () => {
    startStateSync();

    capturedSubscriber!({
      state: {
        on: true, bri: 128,
        seg: [{
          id: 0, start: 0, stop: 480, len: 480,
          on: true, bri: 255,
          col: [[100, 200, 50, 0], [10, 20, 30, 0]],
          fx: 0, sx: 128, ix: 128, pal: 0,
        }],
      },
      info: {
        ver: 'hs-1.6', vid: 2406290,
        leds: { count: 480, pwr: 0, fps: 0, maxpwr: 850, maxseg: 32 },
        name: 'HyperCube', udpport: 21324, live: false,
        fxcount: 118, palcount: 71,
        wifi: { bssid: '', rssi: -60, signal: 80, channel: 6 },
      },
    } as WLEDMessage);

    const colors = cubeStateStore.getState().colors;
    expect(colors[0]).toEqual([100, 200, 50]);
    expect(colors[1]).toEqual([10, 20, 30]);
  });

  it('ignores non-state messages (live LED data)', () => {
    startStateSync();

    const originalState = cubeStateStore.getState();

    // Live LED message — should be ignored
    capturedSubscriber!({ leds: ['FF0000'], n: 1 } as unknown as WLEDMessage);

    expect(cubeStateStore.getState().on).toBe(originalState.on);
    expect(cubeStateStore.getState().brightness).toBe(originalState.brightness);
  });

  it('returns unsubscribe function that stops sync', () => {
    const unsubscribe = startStateSync();
    expect(capturedSubscriber).not.toBeNull();

    unsubscribe();
    expect(capturedSubscriber).toBeNull();
  });
});
