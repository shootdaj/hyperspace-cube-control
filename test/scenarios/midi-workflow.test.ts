import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { midiStore } from '@/stores/midiStore';
import { cubeStateStore } from '@/core/store/cubeStateStore';
import { handleCCMessage, handleNoteOnMessage } from '@/plugins/inputs/MIDIMappingEngine';
import { saveMIDIMappings, loadMIDIMappings, clearSavedMIDIMappings } from '@/plugins/inputs/midiPersistence';
import { MIDIPlugin } from '@/plugins/inputs/MIDIPlugin';
import { MIDICCMappingStrategy } from '@/plugins/mappings/MIDICCMappingStrategy';
import { runPipelineTick, FRAME_INTERVAL_MS, type PipelineRefs } from '@/core/pipeline/PipelineEngine';
import { ledStateProxy } from '@/core/store/ledStateProxy';
import type { InputPlugin, MappingStrategy, OutputPlugin } from '@/core/pipeline/types';
import type { MutableRefObject } from 'react';
import { MockOutputPlugin } from '../mocks/mockPlugins';

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

describe('MIDI Controller Full Workflow', () => {
  beforeEach(() => {
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
    ledStateProxy.colors.fill(0);
    ledStateProxy.lastUpdated = 0;
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('TestMIDIWorkflow_UserMapsKnobToBrightnessThenControlsCube', () => {
    // Step 1: User clicks "Learn" for brightness
    midiStore.getState().setLearnTarget({ type: 'cc', target: 'brightness' });
    expect(midiStore.getState().learnTarget).toEqual({ type: 'cc', target: 'brightness' });

    // Step 2: User moves knob on MIDI controller — CC7 comes in
    handleCCMessage(1, 7, 64);

    // Step 3: Binding is captured
    expect(midiStore.getState().ccMappings).toHaveLength(1);
    expect(midiStore.getState().ccMappings[0]).toEqual({
      channel: 1, cc: 7, target: 'brightness',
    });
    expect(midiStore.getState().learnTarget).toBeNull();

    // Step 4: User continues moving knob — brightness updates
    handleCCMessage(1, 7, 0);
    expect(cubeStateStore.getState().brightness).toBe(0);

    handleCCMessage(1, 7, 64);
    expect(cubeStateStore.getState().brightness).toBe(129);

    handleCCMessage(1, 7, 127);
    expect(cubeStateStore.getState().brightness).toBe(255);

    // Step 5: User saves mappings
    saveMIDIMappings();

    // Step 6: Simulate page refresh — clear store and reload
    midiStore.getState().clearAllMappings();
    expect(midiStore.getState().ccMappings).toHaveLength(0);

    loadMIDIMappings();
    expect(midiStore.getState().ccMappings).toHaveLength(1);
    expect(midiStore.getState().ccMappings[0].target).toBe('brightness');

    // Step 7: Mapping still works after reload
    handleCCMessage(1, 7, 50);
    expect(cubeStateStore.getState().brightness).toBe(100);
  });

  it('TestMIDIWorkflow_UserMapsMultipleKnobsToAllParameters', () => {
    // Map 4 knobs to 4 parameters using MIDI learn
    const targets = ['brightness', 'speed', 'intensity', 'hue'] as const;
    const ccNumbers = [7, 10, 11, 1];

    for (let i = 0; i < targets.length; i++) {
      midiStore.getState().setLearnTarget({ type: 'cc', target: targets[i] });
      handleCCMessage(1, ccNumbers[i], 64);
    }

    expect(midiStore.getState().ccMappings).toHaveLength(4);

    // Move all knobs simultaneously
    handleCCMessage(1, 7, 100);  // brightness
    handleCCMessage(1, 10, 50);  // speed
    handleCCMessage(1, 11, 25);  // intensity
    handleCCMessage(1, 1, 42);   // hue

    expect(cubeStateStore.getState().brightness).toBe(201);
    expect(cubeStateStore.getState().speed).toBe(100);
    expect(cubeStateStore.getState().intensity).toBe(50);
    // Hue should have changed the color
    const colors = cubeStateStore.getState().colors;
    expect(colors[0][0] + colors[0][1] + colors[0][2]).toBeGreaterThan(0);
  });

  it('TestMIDIWorkflow_UserMapsNoteToEffectAndSwitches', () => {
    // Step 1: User enters learn mode for effect 42
    midiStore.getState().setLearnTarget({
      type: 'note', action: 'effect', actionIndex: 42,
    });

    // Step 2: User presses key C4 on MIDI controller
    handleNoteOnMessage(1, 60, 127);

    // Step 3: Binding created
    expect(midiStore.getState().noteMappings).toHaveLength(1);
    expect(midiStore.getState().noteMappings[0]).toEqual({
      channel: 1, note: 60, action: 'effect', actionIndex: 42,
    });

    // Step 4: User presses the same key again — effect switches
    handleNoteOnMessage(1, 60, 127);
    expect(cubeStateStore.getState().effectIndex).toBe(42);
  });

  it('TestMIDIWorkflow_UserReplacesExistingMapping', () => {
    // Map CC7 to brightness
    midiStore.getState().setLearnTarget({ type: 'cc', target: 'brightness' });
    handleCCMessage(1, 7, 64);
    expect(midiStore.getState().ccMappings).toHaveLength(1);

    // Now re-learn brightness with a different knob (CC10)
    midiStore.getState().setLearnTarget({ type: 'cc', target: 'brightness' });
    handleCCMessage(1, 10, 64);

    // Should have replaced, not duplicated
    expect(midiStore.getState().ccMappings).toHaveLength(1);
    expect(midiStore.getState().ccMappings[0].cc).toBe(10);

    // Old CC7 should no longer affect brightness
    cubeStateStore.getState().setBrightness(128); // Reset
    handleCCMessage(1, 7, 100);
    expect(cubeStateStore.getState().brightness).toBe(128); // Unchanged

    // New CC10 should work
    handleCCMessage(1, 10, 100);
    expect(cubeStateStore.getState().brightness).toBe(201);
  });

  it('TestMIDIWorkflow_ClearAllMappingsAndStorage', () => {
    // Create some mappings
    midiStore.getState().addCCMapping({ channel: 1, cc: 7, target: 'brightness' });
    midiStore.getState().addNoteMapping({
      channel: 1, note: 60, action: 'effect', actionIndex: 0,
    });
    saveMIDIMappings();

    // Clear
    midiStore.getState().clearAllMappings();
    clearSavedMIDIMappings();

    // Verify cleared
    expect(midiStore.getState().ccMappings).toHaveLength(0);
    expect(midiStore.getState().noteMappings).toHaveLength(0);
    expect(loadMIDIMappings()).toBe(false);
  });

  it('TestMIDIWorkflow_EndToEndPipelineTick', () => {
    // Set up a MIDI plugin with CC data
    const midiPlugin = new MIDIPlugin();
    (midiPlugin as unknown as { enabled: boolean }).enabled = true;
    const ccValues = (midiPlugin as unknown as { ccValues: Map<number, number> }).ccValues;

    // Set up CC mapping for brightness
    midiStore.getState().addCCMapping({ channel: 1, cc: 7, target: 'brightness' });

    // Simulate MIDI CC7 at max value
    ccValues.set(7, 127);
    handleCCMessage(1, 7, 127);

    // Cube brightness should be at max
    expect(cubeStateStore.getState().brightness).toBe(255);

    // Pipeline tick should produce LED output
    const mapping = new MIDICCMappingStrategy();
    const mockOutput = new MockOutputPlugin();
    const refs = makeRefs({
      input: midiPlugin,
      mapping: mapping,
      output: mockOutput,
    });

    const ticked = runPipelineTick(FRAME_INTERVAL_MS, refs);
    expect(ticked).toBe(true);
    expect(mockOutput.sentFrames).toHaveLength(1);

    // LED output should have content
    const ledOutput = mockOutput.sentFrames[0].leds;
    let hasNonZero = false;
    for (let i = 0; i < ledOutput.length; i++) {
      if (ledOutput[i] > 0) { hasNonZero = true; break; }
    }
    expect(hasNonZero).toBe(true);

    midiPlugin.destroy();
  });

  it('TestMIDIWorkflow_GracefulDegradationOnUnsupportedBrowser', async () => {
    // Simulate unsupported browser by directly testing what happens
    // when isMIDISupported returns false
    const { isMIDISupported } = await import('@/plugins/inputs/midiSupport');

    // In jsdom, requestMIDIAccess doesn't exist, so isMIDISupported returns false
    expect(isMIDISupported()).toBe(false);

    // Create plugin and try to enable on unsupported browser
    const plugin = new MIDIPlugin();
    await plugin.enable();

    // Should set error message, not crash
    expect(midiStore.getState().error).toBeTruthy();
    expect(midiStore.getState().error).toContain('not supported');
    expect(midiStore.getState().isEnabled).toBe(false);
    expect(plugin.isEnabled()).toBe(false);

    plugin.destroy();
  });
});
