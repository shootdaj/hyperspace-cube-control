import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MIDIPlugin } from '@/plugins/inputs/MIDIPlugin';
import { MIDICCMappingStrategy } from '@/plugins/mappings/MIDICCMappingStrategy';
import { ledStateProxy } from '@/core/store/ledStateProxy';
import { midiStore } from '@/stores/midiStore';
import { DEFAULT_FRAME_SIZE } from '@/core/constants';
import { cubeStateStore } from '@/core/store/cubeStateStore';
import { runPipelineTick, FRAME_INTERVAL_MS, type PipelineRefs } from '@/core/pipeline/PipelineEngine';
import { pluginRegistry } from '@/core/pipeline/PluginRegistry';
import { registerMIDIPlugins } from '@/plugins/inputs/registerMIDIPlugins';
import { handleCCMessage, handleNoteOnMessage } from '@/plugins/inputs/MIDIMappingEngine';
import type { InputPlugin, MappingStrategy, OutputPlugin } from '@/core/pipeline/types';
import type { MutableRefObject } from 'react';
import { MockInputPlugin, MockOutputPlugin } from '../mocks/mockPlugins';

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

describe('MIDI Pipeline Integration', () => {
  beforeEach(() => {
    ledStateProxy.colors.fill(0);
    ledStateProxy.lastUpdated = 0;
    midiStore.setState({
      isSupported: true,
      isEnabled: true,
      devices: [],
      selectedDeviceId: null,
      ccMappings: [],
      noteMappings: [],
      learnTarget: null,
      lastCCValues: {},
      error: null,
    });
    cubeStateStore.setState({
      on: true,
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

  it('TestMIDIPipeline_TickWithCCDataProducesLedOutput', () => {
    const midiPlugin = new MIDIPlugin();
    // Simulate enabled with CC data
    (midiPlugin as unknown as { enabled: boolean }).enabled = true;
    const ccValues = (midiPlugin as unknown as { ccValues: Map<number, number> }).ccValues;
    ccValues.set(7, 100);
    ccValues.set(10, 64);

    const mapping = new MIDICCMappingStrategy();
    const mockOutput = new MockOutputPlugin();

    const refs = makeRefs({
      input: midiPlugin,
      mapping: mapping,
      output: mockOutput,
    });

    const ticked = runPipelineTick(FRAME_INTERVAL_MS, refs);

    expect(ticked).toBe(true);
    // LED state should have non-zero values
    let hasNonZero = false;
    for (let i = 0; i < ledStateProxy.colors.length; i++) {
      if (ledStateProxy.colors[i] > 0) { hasNonZero = true; break; }
    }
    expect(hasNonZero).toBe(true);

    // Output should have been sent
    expect(mockOutput.sentFrames).toHaveLength(1);
    expect(mockOutput.sentFrames[0].leds.length).toBe(DEFAULT_FRAME_SIZE);

    midiPlugin.destroy();
  });

  it('TestMIDIPipeline_TickReturnsNullWhenNotEnabled', () => {
    const midiPlugin = new MIDIPlugin();
    // Not enabled, no CC data

    const mapping = new MIDICCMappingStrategy();
    const mockOutput = new MockOutputPlugin();

    const refs = makeRefs({
      input: midiPlugin,
      mapping: mapping,
      output: mockOutput,
    });

    const ticked = runPipelineTick(FRAME_INTERVAL_MS, refs);

    expect(ticked).toBe(false);
    expect(mockOutput.sentFrames).toHaveLength(0);

    midiPlugin.destroy();
  });

  it('TestMIDIPipeline_CCMessageUpdatesCubeState', () => {
    // Set up a mapping
    midiStore.getState().addCCMapping({ channel: 1, cc: 7, target: 'brightness' });

    // Simulate CC message
    handleCCMessage(1, 7, 100);

    // Brightness should be updated: 100 * (255/127) = ~201
    const brightness = cubeStateStore.getState().brightness;
    expect(brightness).toBeGreaterThan(190);
    expect(brightness).toBeLessThan(210);
  });

  it('TestMIDIPipeline_LearnModeThenApply', () => {
    // Enter learn mode for brightness
    midiStore.getState().setLearnTarget({ type: 'cc', target: 'brightness' });

    // Simulate CC message — should capture binding
    handleCCMessage(1, 7, 64);

    // Verify binding was created
    expect(midiStore.getState().ccMappings).toHaveLength(1);
    expect(midiStore.getState().ccMappings[0]).toEqual({
      channel: 1, cc: 7, target: 'brightness',
    });
    expect(midiStore.getState().learnTarget).toBeNull();

    // Now send another CC — should apply to brightness
    handleCCMessage(1, 7, 127);
    expect(cubeStateStore.getState().brightness).toBe(255);
  });

  it('TestMIDIPipeline_NoteOnSwitchesEffect', () => {
    midiStore.getState().addNoteMapping({
      channel: 1, note: 60, action: 'effect', actionIndex: 42,
    });

    handleNoteOnMessage(1, 60, 127);
    expect(cubeStateStore.getState().effectIndex).toBe(42);
  });

  it('TestMIDIPipeline_SwapFromManualPaintToMIDI', () => {
    const manualPlugin = new MockInputPlugin();
    const midiPlugin = new MIDIPlugin();
    (midiPlugin as unknown as { enabled: boolean }).enabled = true;
    const ccValues = (midiPlugin as unknown as { ccValues: Map<number, number> }).ccValues;
    ccValues.set(7, 127);

    const mapping = new MIDICCMappingStrategy();
    const mockOutput = new MockOutputPlugin();

    // Start with manual paint
    const refs = makeRefs({
      input: manualPlugin,
      mapping: mapping,
      output: mockOutput,
    });

    runPipelineTick(FRAME_INTERVAL_MS, refs);
    expect(mockOutput.sentFrames).toHaveLength(1);

    // Swap to MIDI
    refs.activeInput.current = midiPlugin;
    refs.lastTime.current = 0;

    runPipelineTick(FRAME_INTERVAL_MS, refs);
    expect(mockOutput.sentFrames).toHaveLength(2);

    // The second frame should have MIDI-driven content (non-zero)
    const midiFrame = mockOutput.sentFrames[1].leds;
    let hasNonZero = false;
    for (let i = 0; i < midiFrame.length; i++) {
      if (midiFrame[i] > 0) { hasNonZero = true; break; }
    }
    expect(hasNonZero).toBe(true);

    midiPlugin.destroy();
  });

  it('TestMIDIPipeline_SwapBackFromMIDIToManualPaint', () => {
    const midiPlugin = new MIDIPlugin();
    (midiPlugin as unknown as { enabled: boolean }).enabled = true;
    const ccValues = (midiPlugin as unknown as { ccValues: Map<number, number> }).ccValues;
    ccValues.set(7, 100);

    const manualPlugin = new MockInputPlugin();
    const leds = new Uint8Array(DEFAULT_FRAME_SIZE);
    leds[0] = 42; leds[1] = 84; leds[2] = 126;
    manualPlugin.setNextFrame({ type: 'direct', leds });

    const mapping = new MIDICCMappingStrategy();
    const mockOutput = new MockOutputPlugin();

    // Start with MIDI
    const refs = makeRefs({
      input: midiPlugin,
      mapping: mapping,
      output: mockOutput,
    });

    runPipelineTick(FRAME_INTERVAL_MS, refs);

    // Swap to manual
    refs.activeInput.current = manualPlugin;
    refs.lastTime.current = 0;

    const passthroughMapping = {
      id: 'passthrough',
      map(frame: { leds?: Uint8Array }, ledCount: number) {
        return frame.leds ?? new Uint8Array(ledCount * 3);
      },
    };
    refs.activeMapping.current = passthroughMapping;

    runPipelineTick(FRAME_INTERVAL_MS, refs);

    expect(ledStateProxy.colors[0]).toBe(42);
    expect(ledStateProxy.colors[1]).toBe(84);
    expect(ledStateProxy.colors[2]).toBe(126);

    midiPlugin.destroy();
  });

  it('TestMIDIPipeline_MultipleCCMappingsApplySimultaneously', () => {
    midiStore.getState().addCCMapping({ channel: 1, cc: 7, target: 'brightness' });
    midiStore.getState().addCCMapping({ channel: 1, cc: 10, target: 'speed' });
    midiStore.getState().addCCMapping({ channel: 1, cc: 11, target: 'intensity' });

    handleCCMessage(1, 7, 100);
    handleCCMessage(1, 10, 50);
    handleCCMessage(1, 11, 25);

    // All three parameters should be updated
    expect(cubeStateStore.getState().brightness).toBeGreaterThan(190);
    expect(cubeStateStore.getState().speed).toBeGreaterThan(90);
    expect(cubeStateStore.getState().intensity).toBeGreaterThan(40);
  });
});

describe('MIDI Plugin Registration', () => {
  it('TestMIDIPluginRegistration_RegistersInputAndMapping', () => {
    registerMIDIPlugins();

    expect(pluginRegistry.listInputs()).toContain('midi-controller');
    expect(pluginRegistry.listMappings()).toContain('midi-cc');
  });

  it('TestMIDIPluginRegistration_CreatesValidInstances', () => {
    registerMIDIPlugins();

    const input = pluginRegistry.createInput('midi-controller');
    expect(input.id).toBe('midi-controller');
    expect(input.name).toBe('MIDI Controller');

    const mapping = pluginRegistry.createMapping('midi-cc');
    expect(mapping.id).toBe('midi-cc');

    input.destroy();
  });
});
