import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WLEDWebSocketOutput } from '../WLEDWebSocketOutput';
import { MockInputPlugin, MockMappingStrategy, MockOutputPlugin } from '../../../../test/mocks/mockPlugins';
import { runPipelineTick, FRAME_INTERVAL_MS, type PipelineRefs } from '@/core/pipeline/PipelineEngine';
import type { InputPlugin, MappingStrategy, OutputPlugin } from '@/core/pipeline/types';
import type { MutableRefObject } from 'react';

// Mock the WLEDWebSocketService singleton
const mockSend = vi.fn();
vi.mock('@/core/wled/WLEDWebSocketService', () => ({
  WLEDWebSocketService: {
    getInstance: () => ({
      send: mockSend,
    }),
  },
}));

function makeRefs(overrides?: Partial<{
  input: InputPlugin | null;
  mapping: MappingStrategy | null;
  output: OutputPlugin | null;
  lastTime: number;
}>): PipelineRefs {
  return {
    activeInput: { current: overrides?.input ?? null } as MutableRefObject<InputPlugin | null>,
    activeMapping: { current: overrides?.mapping ?? null } as MutableRefObject<MappingStrategy | null>,
    activeOutput: { current: overrides?.output ?? null } as MutableRefObject<OutputPlugin | null>,
    lastTime: { current: overrides?.lastTime ?? 0 } as MutableRefObject<number>,
  };
}

describe('WLEDWebSocketOutput', () => {
  let output: WLEDWebSocketOutput;

  beforeEach(() => {
    mockSend.mockClear();
    output = new WLEDWebSocketOutput();
  });

  it('TestWLEDWebSocketOutput_Send_CallsServiceWithBriAndSeg', () => {
    const leds = new Uint8Array(224 * 3);
    leds[0] = 255;
    leds[1] = 128;
    leds[2] = 64;

    output.send(leds, 200);

    // 224 LEDs fits in a single chunk (< 256 limit)
    expect(mockSend).toHaveBeenCalledTimes(1);

    const call1 = mockSend.mock.calls[0][0];
    expect(call1.bri).toBe(200);
    expect(call1.seg).toBeDefined();
    expect(call1.seg[0].start).toBe(0);
    expect(call1.seg[0].i).toBeDefined();
    // First 3 values should be our LED 0 colors
    expect(call1.seg[0].i[0]).toBe(255);
    expect(call1.seg[0].i[1]).toBe(128);
    expect(call1.seg[0].i[2]).toBe(64);
  });

  it('TestWLEDWebSocketOutput_Send_ChunksCorrectly', () => {
    const leds = new Uint8Array(224 * 3);
    output.send(leds, 255);

    // Single chunk: 224 LEDs * 3 = 672 values
    expect(mockSend).toHaveBeenCalledTimes(1);
    const chunk = mockSend.mock.calls[0][0].seg[0].i;
    expect(chunk).toHaveLength(224 * 3);
  });

  it('TestWLEDWebSocketOutput_Destroy_DoesNotThrow', () => {
    expect(() => output.destroy()).not.toThrow();
  });

  it('TestWLEDWebSocketOutput_Id_IsCorrect', () => {
    expect(output.id).toBe('wled-websocket-output');
  });

  describe('Runtime plugin swap', () => {
    it('TestPipelineEngine_SwapOutput_OldDestroyedNewReceivesFrames', () => {
      const mockInput = new MockInputPlugin();
      const mockMapping = new MockMappingStrategy();
      const mockOutput = new MockOutputPlugin();

      const refs = makeRefs({
        input: mockInput,
        mapping: mockMapping,
        output: mockOutput,
      });

      // First tick: mockOutput receives a frame
      runPipelineTick(FRAME_INTERVAL_MS, refs);
      expect(mockOutput.sentFrames).toHaveLength(1);

      // Swap to WLEDWebSocketOutput (simulating setOutputPlugin behavior)
      mockOutput.destroy();
      const wledOutput = new WLEDWebSocketOutput();
      refs.activeOutput.current = wledOutput;
      refs.lastTime.current = 0; // Reset throttle

      // Second tick: wledOutput receives the frame via WLEDWebSocketService.send
      runPipelineTick(FRAME_INTERVAL_MS, refs);

      expect(mockOutput.destroyed).toBe(true);
      expect(mockSend).toHaveBeenCalled(); // WLEDWebSocketOutput sent via service
    });

    it('TestPipelineEngine_SwapToNullAndBack_NoFrameDrops', () => {
      const mockInput = new MockInputPlugin();
      const mockMapping = new MockMappingStrategy();

      const refs = makeRefs({
        input: mockInput,
        mapping: mockMapping,
        output: output,
      });

      // Tick with output
      runPipelineTick(FRAME_INTERVAL_MS, refs);
      expect(mockSend).toHaveBeenCalled();

      // Swap to null
      mockSend.mockClear();
      refs.activeOutput.current = null;
      refs.lastTime.current = 0;

      // Tick with null output — pipeline still runs (just no send)
      const result = runPipelineTick(FRAME_INTERVAL_MS, refs);
      expect(result).toBe(true); // tick still processed
      expect(mockSend).not.toHaveBeenCalled();

      // Swap back
      const newOutput = new WLEDWebSocketOutput();
      refs.activeOutput.current = newOutput;
      refs.lastTime.current = 0;

      runPipelineTick(FRAME_INTERVAL_MS, refs);
      expect(mockSend).toHaveBeenCalled();
    });
  });
});
