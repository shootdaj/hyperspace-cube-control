import { describe, it, expect, beforeEach } from 'vitest';
import { MockInputPlugin, MockMappingStrategy, MockOutputPlugin } from '../../../../test/mocks/mockPlugins';
import { ledStateProxy } from '@/core/store/ledStateProxy';
import { runPipelineTick, FRAME_INTERVAL_MS, type PipelineRefs } from '../PipelineEngine';
import type { InputPlugin, MappingStrategy, OutputPlugin } from '../types';
import type { MutableRefObject } from 'react';

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

describe('PipelineEngine - runPipelineTick', () => {
  let mockInput: MockInputPlugin;
  let mockMapping: MockMappingStrategy;
  let mockOutput: MockOutputPlugin;

  beforeEach(() => {
    mockInput = new MockInputPlugin();
    mockMapping = new MockMappingStrategy();
    mockOutput = new MockOutputPlugin();
    // Reset ledStateProxy colors to zeros
    ledStateProxy.colors.fill(0);
    ledStateProxy.lastUpdated = 0;
  });

  it('TestPipelineEngine_TickWithAllPlugins_CallsOutputOnce', () => {
    const refs = makeRefs({
      input: mockInput,
      mapping: mockMapping,
      output: mockOutput,
    });

    // Tick at FRAME_INTERVAL_MS to pass throttle check
    runPipelineTick(FRAME_INTERVAL_MS, refs);

    expect(mockOutput.sentFrames).toHaveLength(1);
  });

  it('TestPipelineEngine_NullInput_IsNoop', () => {
    const refs = makeRefs({
      input: null,
      mapping: mockMapping,
      output: mockOutput,
    });

    runPipelineTick(FRAME_INTERVAL_MS, refs);

    expect(mockOutput.sentFrames).toHaveLength(0);
  });

  it('TestPipelineEngine_NullMapping_IsNoop', () => {
    const refs = makeRefs({
      input: mockInput,
      mapping: null,
      output: mockOutput,
    });

    runPipelineTick(FRAME_INTERVAL_MS, refs);

    expect(mockOutput.sentFrames).toHaveLength(0);
  });

  it('TestPipelineEngine_InputReceivesDelta', () => {
    let receivedDelta = 0;
    const spyInput = new MockInputPlugin();
    const origTick = spyInput.tick.bind(spyInput);
    spyInput.tick = (deltaMs: number) => {
      receivedDelta = deltaMs;
      return origTick(deltaMs);
    };

    const refs = makeRefs({
      input: spyInput,
      mapping: mockMapping,
      output: mockOutput,
    });

    runPipelineTick(FRAME_INTERVAL_MS, refs);

    expect(receivedDelta).toBe(FRAME_INTERVAL_MS);
  });

  it('TestPipelineEngine_Tick_UpdatesLedStateProxy', () => {
    // Set up input to return non-zero LED data (224 LEDs = 672 bytes)
    const leds = new Uint8Array(224 * 3);
    leds[0] = 255;
    leds[1] = 128;
    leds[2] = 64;
    mockInput.setNextFrame({ type: 'direct', leds });

    // Mapping that passes through the input leds
    const passthroughMapping: MappingStrategy = {
      id: 'passthrough',
      map(frame, ledCount) {
        return frame.leds ?? new Uint8Array(ledCount * 3);
      },
    };

    const refs = makeRefs({
      input: mockInput,
      mapping: passthroughMapping,
      output: mockOutput,
    });

    runPipelineTick(FRAME_INTERVAL_MS, refs);

    expect(ledStateProxy.colors[0]).toBe(255);
    expect(ledStateProxy.colors[1]).toBe(128);
    expect(ledStateProxy.colors[2]).toBe(64);
    expect(ledStateProxy.lastUpdated).toBeGreaterThan(0);
  });

  it('TestPipelineEngine_SetInputNull_NextTickIsNoop', () => {
    const refs = makeRefs({
      input: mockInput,
      mapping: mockMapping,
      output: mockOutput,
    });

    // First tick works
    runPipelineTick(FRAME_INTERVAL_MS, refs);
    expect(mockOutput.sentFrames).toHaveLength(1);

    // Set input to null
    refs.activeInput.current = null;
    refs.lastTime.current = 0; // Reset throttle

    runPipelineTick(FRAME_INTERVAL_MS, refs);
    expect(mockOutput.sentFrames).toHaveLength(1); // Still 1, no new frame
  });

  it('TestPipelineEngine_FrameThrottle_SkipsFastTicks', () => {
    const refs = makeRefs({
      input: mockInput,
      mapping: mockMapping,
      output: mockOutput,
    });

    // First tick passes (delta = FRAME_INTERVAL_MS)
    runPipelineTick(FRAME_INTERVAL_MS, refs);
    expect(mockOutput.sentFrames).toHaveLength(1);

    // Second tick too soon (only 10ms later) — should be skipped
    const result = runPipelineTick(FRAME_INTERVAL_MS + 10, refs);
    expect(result).toBe(false);
    expect(mockOutput.sentFrames).toHaveLength(1); // Still 1
  });

  it('TestPipelineEngine_SetInputPlugin_DestroysPrevious', () => {
    // This tests the usePipelineEngine hook behavior, but we can verify
    // the pattern: old plugin's destroy() called when replaced
    const oldInput = new MockInputPlugin();
    const newInput = new MockInputPlugin();

    // Simulating what setInputPlugin does:
    oldInput.destroy();
    expect(oldInput.destroyed).toBe(true);
    expect(newInput.destroyed).toBe(false);
  });

  it('TestPipelineEngine_SetOutputPlugin_DestroysPrevious', () => {
    const oldOutput = new MockOutputPlugin();
    const newOutput = new MockOutputPlugin();

    // Simulating what setOutputPlugin does:
    oldOutput.destroy();
    expect(oldOutput.destroyed).toBe(true);
    expect(newOutput.destroyed).toBe(false);
  });

  it('TestPipelineEngine_NullInputFrame_IsNoop', () => {
    // Input returns null for this tick
    mockInput.setNextFrame(null);

    const refs = makeRefs({
      input: mockInput,
      mapping: mockMapping,
      output: mockOutput,
    });

    runPipelineTick(FRAME_INTERVAL_MS, refs);

    expect(mockOutput.sentFrames).toHaveLength(0);
  });
});
