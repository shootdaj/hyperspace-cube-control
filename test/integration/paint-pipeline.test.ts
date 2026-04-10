import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { ManualPaintPlugin } from '@/plugins/inputs/ManualPaintPlugin';
import { WLEDPaintOutput } from '@/plugins/outputs/WLEDPaintOutput';
import { ledStateProxy } from '@/core/store/ledStateProxy';
import { runPipelineTick, FRAME_INTERVAL_MS, type PipelineRefs } from '@/core/pipeline/PipelineEngine';
import { DEFAULT_LED_COUNT, EDGE_LED_COUNTS } from '@/core/constants';
import type { InputPlugin, MappingStrategy, OutputPlugin } from '@/core/pipeline/types';
import type { MutableRefObject } from 'react';
import { MockOutputPlugin } from '../mocks/mockPlugins';

// Mock the WebSocket service for WLED send tests
const mockSend = vi.fn();
vi.mock('@/core/wled/WLEDWebSocketService', () => ({
  WLEDWebSocketService: {
    getInstance: vi.fn(() => ({
      send: mockSend,
    })),
  },
}));

/** Passthrough mapping: returns the direct LED buffer from FrameData */
const passthroughMapping: MappingStrategy = {
  id: 'passthrough',
  map(frame, ledCount) {
    return frame.leds ?? new Uint8Array(ledCount * 3);
  },
};

function makeRefs(overrides: {
  input: InputPlugin;
  mapping: MappingStrategy;
  output: OutputPlugin;
}): PipelineRefs {
  return {
    activeInput: { current: overrides.input } as MutableRefObject<InputPlugin | null>,
    activeMapping: { current: overrides.mapping } as MutableRefObject<MappingStrategy | null>,
    activeOutput: { current: overrides.output } as MutableRefObject<OutputPlugin | null>,
    lastTime: { current: 0 } as MutableRefObject<number>,
  };
}

describe('Paint Pipeline Integration', () => {
  let plugin: ManualPaintPlugin;

  beforeEach(() => {
    vi.useFakeTimers();
    plugin = new ManualPaintPlugin();
    ledStateProxy.colors.fill(0);
    ledStateProxy.lastUpdated = 0;
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('TestPaintPipeline_SetPixel_UpdatesLedStateProxy', () => {
    plugin.setPixel(0, 255, 128, 64);
    const mockOutput = new MockOutputPlugin();
    const refs = makeRefs({
      input: plugin,
      mapping: passthroughMapping,
      output: mockOutput,
    });

    runPipelineTick(FRAME_INTERVAL_MS, refs);

    expect(ledStateProxy.colors[0]).toBe(255);
    expect(ledStateProxy.colors[1]).toBe(128);
    expect(ledStateProxy.colors[2]).toBe(64);
  });

  it('TestPaintPipeline_SetEdge_UpdatesEdgeLeds', () => {
    plugin.setEdge(0, 200, 100, 50);
    const mockOutput = new MockOutputPlugin();
    const refs = makeRefs({
      input: plugin,
      mapping: passthroughMapping,
      output: mockOutput,
    });

    runPipelineTick(FRAME_INTERVAL_MS, refs);

    // All LEDs on edge 0 should be set (19 LEDs)
    const ledsOnEdge = EDGE_LED_COUNTS[0];
    for (let i = 0; i < ledsOnEdge; i++) {
      expect(ledStateProxy.colors[i * 3]).toBe(200);
      expect(ledStateProxy.colors[i * 3 + 1]).toBe(100);
      expect(ledStateProxy.colors[i * 3 + 2]).toBe(50);
    }
    // Next LED should be untouched
    expect(ledStateProxy.colors[ledsOnEdge * 3]).toBe(0);
  });

  it('TestPaintPipeline_Fill_UpdatesAllLeds', () => {
    plugin.fill(255, 0, 0);
    const mockOutput = new MockOutputPlugin();
    const refs = makeRefs({
      input: plugin,
      mapping: passthroughMapping,
      output: mockOutput,
    });

    runPipelineTick(FRAME_INTERVAL_MS, refs);

    for (let i = 0; i < DEFAULT_LED_COUNT; i++) {
      expect(ledStateProxy.colors[i * 3]).toBe(255);
      expect(ledStateProxy.colors[i * 3 + 1]).toBe(0);
      expect(ledStateProxy.colors[i * 3 + 2]).toBe(0);
    }
  });

  it('TestPaintPipeline_WLEDSend_OnlyDiff', () => {
    const paintOutput = new WLEDPaintOutput();

    // Set one LED and send
    plugin.setPixel(42, 255, 0, 255);
    paintOutput.sendPaint(plugin.getBuffer());

    expect(mockSend).toHaveBeenCalledTimes(1);
    const payload = mockSend.mock.calls[0][0];
    expect(payload.seg[0].i[0]).toBe(42); // LED 42
    expect(payload.seg[0].i[1]).toBe(255); // R
    expect(payload.seg[0].i[2]).toBe(0);   // G
    expect(payload.seg[0].i[3]).toBe(255); // B

    paintOutput.destroy();
  });

  it('TestPaintPipeline_WLEDSendAll_FullFrame', () => {
    const paintOutput = new WLEDPaintOutput();

    plugin.fill(100, 100, 100);
    paintOutput.sendAll(plugin.getBuffer());

    // Should send 1 chunk (224 LEDs fits in single WLED send)
    expect(mockSend).toHaveBeenCalledTimes(1);

    paintOutput.destroy();
  });

  it('TestPaintPipeline_PipelineTick_TriggersOutput', () => {
    plugin.setPixel(0, 255, 0, 0);
    const mockOutput = new MockOutputPlugin();
    const refs = makeRefs({
      input: plugin,
      mapping: passthroughMapping,
      output: mockOutput,
    });

    runPipelineTick(FRAME_INTERVAL_MS, refs);

    expect(mockOutput.sentFrames).toHaveLength(1);
    expect(mockOutput.sentFrames[0].leds[0]).toBe(255);
  });
});
