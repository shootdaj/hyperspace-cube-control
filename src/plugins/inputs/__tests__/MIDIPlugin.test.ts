import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MIDIPlugin } from '../MIDIPlugin';
import { midiStore } from '@/stores/midiStore';

// Mock the midiSupport module
vi.mock('../midiSupport', () => ({
  isMIDISupported: vi.fn(() => false), // Default to unsupported for safety
}));

// We don't mock webmidi — the MIDIPlugin handles dynamic import internally.
// Tests that test the non-MIDI-API path (no browser support) won't hit it.

describe('MIDIPlugin', () => {
  let plugin: MIDIPlugin;

  beforeEach(() => {
    plugin = new MIDIPlugin();
    midiStore.setState({
      isSupported: false,
      isEnabled: false,
      devices: [],
      selectedDeviceId: null,
      ccMappings: [],
      noteMappings: [],
      learnTarget: null,
      lastCCValues: {},
      error: null,
    });
  });

  it('TestMIDIPlugin_HasCorrectIdAndName', () => {
    expect(plugin.id).toBe('midi-controller');
    expect(plugin.name).toBe('MIDI Controller');
  });

  it('TestMIDIPlugin_TickReturnsNullWhenNotEnabled', () => {
    const frame = plugin.tick(16);
    expect(frame).toBeNull();
  });

  it('TestMIDIPlugin_TickReturnsNullWhenNoCCData', () => {
    // Simulate enabled state without going through WebMidi
    (plugin as unknown as { enabled: boolean }).enabled = true;
    const frame = plugin.tick(16);
    expect(frame).toBeNull();
  });

  it('TestMIDIPlugin_TickReturnsMidiFrameDataWithCCValues', () => {
    (plugin as unknown as { enabled: boolean }).enabled = true;
    const ccValues = (plugin as unknown as { ccValues: Map<number, number> }).ccValues;
    ccValues.set(7, 100);
    ccValues.set(10, 50);

    const frame = plugin.tick(16);
    expect(frame).not.toBeNull();
    expect(frame!.type).toBe('midi');
    expect(frame!.midiCC).toBeInstanceOf(Map);
    expect(frame!.midiCC!.get(7)).toBe(100);
    expect(frame!.midiCC!.get(10)).toBe(50);
  });

  it('TestMIDIPlugin_TickReturnsCopyOfCCValues', () => {
    (plugin as unknown as { enabled: boolean }).enabled = true;
    const ccValues = (plugin as unknown as { ccValues: Map<number, number> }).ccValues;
    ccValues.set(7, 100);

    const frame = plugin.tick(16);
    // Modify the returned map — should not affect internal state
    frame!.midiCC!.set(7, 0);
    expect(ccValues.get(7)).toBe(100); // Internal state unchanged
  });

  it('TestMIDIPlugin_InitializeSetsSupported', async () => {
    // isMIDISupported is mocked to return false
    await plugin.initialize({ ledCount: 480, frameRate: 30 });
    expect(midiStore.getState().isSupported).toBe(false);
  });

  it('TestMIDIPlugin_EnableSetsErrorWhenUnsupported', async () => {
    // isMIDISupported returns false (mocked)
    await plugin.enable();
    expect(midiStore.getState().error).toBeTruthy();
    expect(midiStore.getState().isEnabled).toBe(false);
  });

  it('TestMIDIPlugin_IsEnabledReturnsFalseInitially', () => {
    expect(plugin.isEnabled()).toBe(false);
  });

  it('TestMIDIPlugin_GetCCValuesReturnsEmptyMapInitially', () => {
    const ccValues = plugin.getCCValues();
    expect(ccValues.size).toBe(0);
  });

  it('TestMIDIPlugin_DestroyResetsState', () => {
    (plugin as unknown as { enabled: boolean }).enabled = true;
    const ccValues = (plugin as unknown as { ccValues: Map<number, number> }).ccValues;
    ccValues.set(7, 100);

    plugin.destroy();

    expect(plugin.isEnabled()).toBe(false);
    expect(plugin.getCCValues().size).toBe(0);
    expect(midiStore.getState().isEnabled).toBe(false);
  });
});
