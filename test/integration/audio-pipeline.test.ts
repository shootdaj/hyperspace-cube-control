import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AudioPlugin } from '@/plugins/inputs/AudioPlugin';
import { AudioSpectrumMappingStrategy } from '@/plugins/mappings/AudioSpectrumMappingStrategy';
import { AudioContextManager } from '@/plugins/inputs/AudioContextManager';
import { ledStateProxy } from '@/core/store/ledStateProxy';
import { audioStore } from '@/stores/audioStore';
import { runPipelineTick, FRAME_INTERVAL_MS, type PipelineRefs } from '@/core/pipeline/PipelineEngine';
import { pluginRegistry } from '@/core/pipeline/PluginRegistry';
import { registerAudioPlugins } from '@/plugins/inputs/registerAudioPlugins';
import type { InputPlugin, MappingStrategy, OutputPlugin } from '@/core/pipeline/types';
import type { MutableRefObject } from 'react';
import { MockInputPlugin, MockOutputPlugin } from '../mocks/mockPlugins';

// --- Mock Web Audio objects ---

function createMockAnalyser(fillValue: number = 180) {
  return {
    getByteFrequencyData: vi.fn((arr: Uint8Array) => {
      for (let i = 0; i < arr.length; i++) {
        arr[i] = fillValue;
      }
    }),
    getFloatFrequencyData: vi.fn(),
    frequencyBinCount: 1024,
    fftSize: 2048,
    smoothingTimeConstant: 0.8,
    connect: vi.fn(),
    disconnect: vi.fn(),
  };
}

function createMockManager(analyserFillValue: number = 180) {
  const mockAnalyser = createMockAnalyser(analyserFillValue);
  const manager = new AudioContextManager();
  let hasAnalyser = false;

  manager.start = vi.fn(async () => { hasAnalyser = true; });
  manager.stop = vi.fn(() => { hasAnalyser = false; });
  manager.destroy = vi.fn(() => { hasAnalyser = false; });
  manager.setGain = vi.fn();
  manager.getAnalyser = () =>
    hasAnalyser ? (mockAnalyser as unknown as AnalyserNode) : null;

  return { manager, mockAnalyser };
}

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

describe('Audio Pipeline Integration', () => {
  beforeEach(() => {
    ledStateProxy.colors.fill(0);
    ledStateProxy.lastUpdated = 0;
    audioStore.setState({
      devices: [],
      selectedDeviceId: null,
      isAudioActive: false,
      audioContextState: null,
      gain: 1.0,
      sensitivity: 0, // No threshold
      visualizationMode: 'spectrum',
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('TestAudioPipeline_TickProducesLedOutput', async () => {
    const { manager } = createMockManager(200);
    const audioPlugin = new AudioPlugin(manager);
    await audioPlugin.initialize({ ledCount: 480, frameRate: 30 });
    await audioPlugin.startAudio();

    const mapping = new AudioSpectrumMappingStrategy();
    const mockOutput = new MockOutputPlugin();

    const refs = makeRefs({
      input: audioPlugin,
      mapping: mapping,
      output: mockOutput,
    });

    const ticked = runPipelineTick(FRAME_INTERVAL_MS, refs);

    expect(ticked).toBe(true);
    // LED state should have been updated with non-zero values
    let hasNonZero = false;
    for (let i = 0; i < ledStateProxy.colors.length; i++) {
      if (ledStateProxy.colors[i] > 0) { hasNonZero = true; break; }
    }
    expect(hasNonZero).toBe(true);

    // Output should have been sent
    expect(mockOutput.sentFrames).toHaveLength(1);
    expect(mockOutput.sentFrames[0].leds.length).toBe(480 * 3);

    audioPlugin.destroy();
  });

  it('TestAudioPipeline_TickReturnsNullBeforeStart', async () => {
    const { manager } = createMockManager();
    const audioPlugin = new AudioPlugin(manager);
    await audioPlugin.initialize({ ledCount: 480, frameRate: 30 });
    // Do NOT call startAudio

    const mapping = new AudioSpectrumMappingStrategy();
    const mockOutput = new MockOutputPlugin();

    const refs = makeRefs({
      input: audioPlugin,
      mapping: mapping,
      output: mockOutput,
    });

    const ticked = runPipelineTick(FRAME_INTERVAL_MS, refs);

    // Should not tick because input returns null
    expect(ticked).toBe(false);
    expect(mockOutput.sentFrames).toHaveLength(0);

    audioPlugin.destroy();
  });

  it('TestAudioPipeline_SpectrumDataFlowsToMapping', async () => {
    const { manager, mockAnalyser } = createMockManager(128);
    const audioPlugin = new AudioPlugin(manager);
    await audioPlugin.initialize({ ledCount: 480, frameRate: 30 });
    await audioPlugin.startAudio();

    // Tick to get frame data
    const frame = audioPlugin.tick(16);
    expect(frame).not.toBeNull();
    expect(frame!.type).toBe('audio');
    expect(frame!.spectrum).toBeInstanceOf(Float32Array);

    // Verify the analyser was called
    expect(mockAnalyser.getByteFrequencyData).toHaveBeenCalled();

    // Map it
    const mapping = new AudioSpectrumMappingStrategy();
    const result = mapping.map(frame!, 480);

    expect(result.length).toBe(480 * 3);
    // With non-zero input, should produce non-zero output
    let sum = 0;
    for (let i = 0; i < result.length; i++) sum += result[i];
    expect(sum).toBeGreaterThan(0);

    audioPlugin.destroy();
  });

  it('TestAudioPipeline_SwapFromManualPaintToAudio', async () => {
    const manualPlugin = new MockInputPlugin();
    const { manager } = createMockManager(150);
    const audioPlugin = new AudioPlugin(manager);
    await audioPlugin.initialize({ ledCount: 480, frameRate: 30 });
    await audioPlugin.startAudio();

    const mapping = new AudioSpectrumMappingStrategy();
    const mockOutput = new MockOutputPlugin();

    // Start with manual paint
    const refs = makeRefs({
      input: manualPlugin,
      mapping: mapping,
      output: mockOutput,
    });

    runPipelineTick(FRAME_INTERVAL_MS, refs);
    expect(mockOutput.sentFrames).toHaveLength(1);

    // Swap to audio at runtime
    refs.activeInput.current = audioPlugin;
    refs.lastTime.current = 0;

    runPipelineTick(FRAME_INTERVAL_MS, refs);
    expect(mockOutput.sentFrames).toHaveLength(2);

    // The second frame should have audio-driven content (non-zero)
    const audioFrame = mockOutput.sentFrames[1].leds;
    let hasNonZero = false;
    for (let i = 0; i < audioFrame.length; i++) {
      if (audioFrame[i] > 0) { hasNonZero = true; break; }
    }
    expect(hasNonZero).toBe(true);

    audioPlugin.destroy();
  });

  it('TestAudioPipeline_SwapBackFromAudioToManualPaint', async () => {
    const { manager } = createMockManager(200);
    const audioPlugin = new AudioPlugin(manager);
    await audioPlugin.initialize({ ledCount: 480, frameRate: 30 });
    await audioPlugin.startAudio();

    const manualPlugin = new MockInputPlugin();
    // Set a specific pixel on manual
    const leds = new Uint8Array(480 * 3);
    leds[0] = 42; leds[1] = 84; leds[2] = 126;
    manualPlugin.setNextFrame({ type: 'direct', leds });

    const mapping = new AudioSpectrumMappingStrategy();
    const mockOutput = new MockOutputPlugin();

    // Start with audio
    const refs = makeRefs({
      input: audioPlugin,
      mapping: mapping,
      output: mockOutput,
    });

    runPipelineTick(FRAME_INTERVAL_MS, refs);

    // Swap back to manual
    refs.activeInput.current = manualPlugin;
    refs.lastTime.current = 0;

    // Use a passthrough mapping for the manual plugin
    const passthroughMapping = {
      id: 'passthrough',
      map(frame: { leds?: Uint8Array }, ledCount: number) {
        return frame.leds ?? new Uint8Array(ledCount * 3);
      },
    };
    refs.activeMapping.current = passthroughMapping;

    runPipelineTick(FRAME_INTERVAL_MS, refs);

    // LED state should reflect manual paint data
    expect(ledStateProxy.colors[0]).toBe(42);
    expect(ledStateProxy.colors[1]).toBe(84);
    expect(ledStateProxy.colors[2]).toBe(126);

    audioPlugin.destroy();
  });

  it('TestAudioPipeline_VisualizationModeAffectsOutput', async () => {
    const { manager } = createMockManager(180);
    const audioPlugin = new AudioPlugin(manager);
    await audioPlugin.initialize({ ledCount: 480, frameRate: 30 });
    await audioPlugin.startAudio();

    const mapping = new AudioSpectrumMappingStrategy();

    // Spectrum mode
    audioStore.getState().setVisualizationMode('spectrum');
    const spectrumFrame = audioPlugin.tick(16)!;
    const spectrumResult = mapping.map(spectrumFrame, 480);

    // Energy mode - create fresh mapping to avoid smoothing interference
    audioStore.getState().setVisualizationMode('energy');
    const energyMapping = new AudioSpectrumMappingStrategy();
    const energyFrame = audioPlugin.tick(16)!;
    const energyResult = energyMapping.map(energyFrame, 480);

    // In energy mode, all LEDs should be the same color
    const er = energyResult[0], eg = energyResult[1], eb = energyResult[2];
    for (let i = 3; i < energyResult.length; i += 3) {
      expect(energyResult[i]).toBe(er);
      expect(energyResult[i + 1]).toBe(eg);
      expect(energyResult[i + 2]).toBe(eb);
    }

    // In spectrum mode, edges should have different colors (different hues)
    const edge0Color = [spectrumResult[0], spectrumResult[1], spectrumResult[2]];
    const edge6Start = 6 * 40 * 3;
    const edge6Color = [spectrumResult[edge6Start], spectrumResult[edge6Start + 1], spectrumResult[edge6Start + 2]];
    const isSameColor = edge0Color[0] === edge6Color[0] &&
                         edge0Color[1] === edge6Color[1] &&
                         edge0Color[2] === edge6Color[2];
    expect(isSameColor).toBe(false);

    audioPlugin.destroy();
  });
});

describe('Audio Plugin Registration', () => {
  it('TestAudioPluginRegistration_RegistersInputAndMapping', () => {
    registerAudioPlugins();

    expect(pluginRegistry.listInputs()).toContain('audio-reactive');
    expect(pluginRegistry.listMappings()).toContain('audio-spectrum');
  });

  it('TestAudioPluginRegistration_CreatesValidInstances', () => {
    registerAudioPlugins();

    const input = pluginRegistry.createInput('audio-reactive');
    expect(input.id).toBe('audio-reactive');
    expect(input.name).toBe('Audio Reactive');

    const mapping = pluginRegistry.createMapping('audio-spectrum');
    expect(mapping.id).toBe('audio-spectrum');

    input.destroy();
  });
});
