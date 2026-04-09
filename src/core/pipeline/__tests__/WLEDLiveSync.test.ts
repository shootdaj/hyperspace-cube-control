import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ledStateProxy } from '@/core/store/ledStateProxy';
import { startLiveSync } from '../WLEDLiveSync';
import type { WLEDMessage, WLEDLiveMessage } from '@/core/wled/types';

// Track subscribers and mock send
let subscribers: Array<(msg: WLEDMessage) => void> = [];
const mockRequestLiveStream = vi.fn();

vi.mock('@/core/wled/WLEDWebSocketService', () => ({
  WLEDWebSocketService: {
    getInstance: () => ({
      subscribe: (fn: (msg: WLEDMessage) => void) => {
        subscribers.push(fn);
        return () => {
          subscribers = subscribers.filter((s) => s !== fn);
        };
      },
      requestLiveStream: mockRequestLiveStream,
    }),
  },
}));

function emitMessage(msg: WLEDMessage): void {
  subscribers.forEach((fn) => fn(msg));
}

describe('WLEDLiveSync', () => {
  beforeEach(() => {
    subscribers = [];
    mockRequestLiveStream.mockClear();
    ledStateProxy.colors.fill(0);
    ledStateProxy.lastUpdated = 0;
  });

  it('TestWLEDLiveSync_ParsesHexToRGB_CorrectColors', () => {
    const cleanup = startLiveSync();

    const msg: WLEDLiveMessage = {
      leds: ['FF0000', '00FF00', '0000FF'],
      n: 1,
    };
    emitMessage(msg);

    // LED 0: R=255, G=0, B=0
    expect(ledStateProxy.colors[0]).toBe(255);
    expect(ledStateProxy.colors[1]).toBe(0);
    expect(ledStateProxy.colors[2]).toBe(0);
    // LED 1: R=0, G=255, B=0
    expect(ledStateProxy.colors[3]).toBe(0);
    expect(ledStateProxy.colors[4]).toBe(255);
    expect(ledStateProxy.colors[5]).toBe(0);
    // LED 2: R=0, G=0, B=255
    expect(ledStateProxy.colors[6]).toBe(0);
    expect(ledStateProxy.colors[7]).toBe(0);
    expect(ledStateProxy.colors[8]).toBe(255);

    cleanup();
  });

  it('TestWLEDLiveSync_IgnoresNonLiveMessages', () => {
    const cleanup = startLiveSync();

    // State message — should be ignored
    emitMessage({ state: {} as any, info: {} as any });

    expect(ledStateProxy.colors[0]).toBe(0);
    expect(ledStateProxy.lastUpdated).toBe(0);

    cleanup();
  });

  it('TestWLEDLiveSync_Cleanup_RemovesSubscriber', () => {
    const cleanup = startLiveSync();
    expect(subscribers).toHaveLength(1);

    cleanup();
    expect(subscribers).toHaveLength(0);

    // Subsequent messages should not update proxy
    const msg: WLEDLiveMessage = { leds: ['FF0000'], n: 2 };
    emitMessage(msg);
    expect(ledStateProxy.colors[0]).toBe(0);
  });

  it('TestWLEDLiveSync_ShortArray_OnlyUpdatesFirstN', () => {
    const cleanup = startLiveSync();

    // Set some data at position 3 to verify it's not overwritten
    ledStateProxy.colors[9] = 42;
    ledStateProxy.colors[10] = 43;
    ledStateProxy.colors[11] = 44;

    // Only send 2 LEDs
    const msg: WLEDLiveMessage = { leds: ['AABBCC', 'DDEEFF'], n: 1 };
    emitMessage(msg);

    // LED 0: updated
    expect(ledStateProxy.colors[0]).toBe(0xAA);
    expect(ledStateProxy.colors[1]).toBe(0xBB);
    expect(ledStateProxy.colors[2]).toBe(0xCC);
    // LED 1: updated
    expect(ledStateProxy.colors[3]).toBe(0xDD);
    expect(ledStateProxy.colors[4]).toBe(0xEE);
    expect(ledStateProxy.colors[5]).toBe(0xFF);
    // LED 3: unchanged
    expect(ledStateProxy.colors[9]).toBe(42);
    expect(ledStateProxy.colors[10]).toBe(43);
    expect(ledStateProxy.colors[11]).toBe(44);

    cleanup();
  });

  it('TestWLEDLiveSync_CallsRequestLiveStream', () => {
    const cleanup = startLiveSync();
    expect(mockRequestLiveStream).toHaveBeenCalledTimes(1);
    cleanup();
  });

  it('TestWLEDLiveSync_UpdatesLastUpdated', () => {
    const cleanup = startLiveSync();

    const msg: WLEDLiveMessage = { leds: ['FF0000'], n: 1 };
    emitMessage(msg);

    expect(ledStateProxy.lastUpdated).toBeGreaterThan(0);

    cleanup();
  });
});
