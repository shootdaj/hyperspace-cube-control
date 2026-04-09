import { describe, it, expect, beforeEach } from 'vitest';
import { midiStore } from '../midiStore';

describe('midiStore', () => {
  beforeEach(() => {
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

  it('TestMIDIStore_InitialState', () => {
    const state = midiStore.getState();
    expect(state.isSupported).toBe(false);
    expect(state.isEnabled).toBe(false);
    expect(state.devices).toEqual([]);
    expect(state.ccMappings).toEqual([]);
    expect(state.noteMappings).toEqual([]);
    expect(state.learnTarget).toBeNull();
    expect(state.error).toBeNull();
  });

  describe('CC Mappings', () => {
    it('TestMIDIStore_AddCCMapping', () => {
      midiStore.getState().addCCMapping({ channel: 1, cc: 7, target: 'brightness' });
      expect(midiStore.getState().ccMappings).toHaveLength(1);
      expect(midiStore.getState().ccMappings[0]).toEqual({
        channel: 1, cc: 7, target: 'brightness',
      });
    });

    it('TestMIDIStore_AddCCMapping_ReplacesExistingTargetMapping', () => {
      midiStore.getState().addCCMapping({ channel: 1, cc: 7, target: 'brightness' });
      midiStore.getState().addCCMapping({ channel: 1, cc: 10, target: 'brightness' });
      // Should only have one mapping for brightness — the new one
      const brightnessMappings = midiStore.getState().ccMappings.filter(
        (m) => m.target === 'brightness',
      );
      expect(brightnessMappings).toHaveLength(1);
      expect(brightnessMappings[0].cc).toBe(10);
    });

    it('TestMIDIStore_AddCCMapping_ReplacesExistingSameCC', () => {
      midiStore.getState().addCCMapping({ channel: 1, cc: 7, target: 'brightness' });
      midiStore.getState().addCCMapping({ channel: 1, cc: 7, target: 'speed' });
      // CC 7 should now map to speed, not brightness
      expect(midiStore.getState().ccMappings).toHaveLength(1);
      expect(midiStore.getState().ccMappings[0].target).toBe('speed');
    });

    it('TestMIDIStore_RemoveCCMapping', () => {
      midiStore.getState().addCCMapping({ channel: 1, cc: 7, target: 'brightness' });
      midiStore.getState().removeCCMapping(1, 7);
      expect(midiStore.getState().ccMappings).toHaveLength(0);
    });

    it('TestMIDIStore_MultipleCCMappings_DifferentTargets', () => {
      midiStore.getState().addCCMapping({ channel: 1, cc: 7, target: 'brightness' });
      midiStore.getState().addCCMapping({ channel: 1, cc: 10, target: 'speed' });
      midiStore.getState().addCCMapping({ channel: 1, cc: 11, target: 'intensity' });
      midiStore.getState().addCCMapping({ channel: 1, cc: 1, target: 'hue' });
      expect(midiStore.getState().ccMappings).toHaveLength(4);
    });
  });

  describe('Note Mappings', () => {
    it('TestMIDIStore_AddNoteMapping', () => {
      midiStore.getState().addNoteMapping({
        channel: 1, note: 60, action: 'preset', actionIndex: 0,
      });
      expect(midiStore.getState().noteMappings).toHaveLength(1);
      expect(midiStore.getState().noteMappings[0]).toEqual({
        channel: 1, note: 60, action: 'preset', actionIndex: 0,
      });
    });

    it('TestMIDIStore_AddNoteMapping_ReplacesExistingSameNote', () => {
      midiStore.getState().addNoteMapping({
        channel: 1, note: 60, action: 'preset', actionIndex: 0,
      });
      midiStore.getState().addNoteMapping({
        channel: 1, note: 60, action: 'effect', actionIndex: 5,
      });
      expect(midiStore.getState().noteMappings).toHaveLength(1);
      expect(midiStore.getState().noteMappings[0].action).toBe('effect');
    });

    it('TestMIDIStore_RemoveNoteMapping', () => {
      midiStore.getState().addNoteMapping({
        channel: 1, note: 60, action: 'preset', actionIndex: 0,
      });
      midiStore.getState().removeNoteMapping(1, 60);
      expect(midiStore.getState().noteMappings).toHaveLength(0);
    });
  });

  describe('Learn Target', () => {
    it('TestMIDIStore_SetLearnTarget_CC', () => {
      midiStore.getState().setLearnTarget({ type: 'cc', target: 'brightness' });
      expect(midiStore.getState().learnTarget).toEqual({ type: 'cc', target: 'brightness' });
    });

    it('TestMIDIStore_SetLearnTarget_Note', () => {
      midiStore.getState().setLearnTarget({ type: 'note', action: 'preset', actionIndex: 2 });
      expect(midiStore.getState().learnTarget).toEqual({
        type: 'note', action: 'preset', actionIndex: 2,
      });
    });

    it('TestMIDIStore_ClearLearnTarget', () => {
      midiStore.getState().setLearnTarget({ type: 'cc', target: 'brightness' });
      midiStore.getState().setLearnTarget(null);
      expect(midiStore.getState().learnTarget).toBeNull();
    });
  });

  describe('Other Actions', () => {
    it('TestMIDIStore_UpdateLastCCValue', () => {
      midiStore.getState().updateLastCCValue(7, 64);
      expect(midiStore.getState().lastCCValues['7']).toBe(64);
    });

    it('TestMIDIStore_ClearAllMappings', () => {
      midiStore.getState().addCCMapping({ channel: 1, cc: 7, target: 'brightness' });
      midiStore.getState().addNoteMapping({
        channel: 1, note: 60, action: 'preset', actionIndex: 0,
      });
      midiStore.getState().clearAllMappings();
      expect(midiStore.getState().ccMappings).toHaveLength(0);
      expect(midiStore.getState().noteMappings).toHaveLength(0);
    });

    it('TestMIDIStore_SetDevices', () => {
      midiStore.getState().setDevices([
        { id: 'dev1', name: 'Controller A', manufacturer: 'Akai' },
      ]);
      expect(midiStore.getState().devices).toHaveLength(1);
      expect(midiStore.getState().devices[0].name).toBe('Controller A');
    });

    it('TestMIDIStore_SetError', () => {
      midiStore.getState().setError('Something went wrong');
      expect(midiStore.getState().error).toBe('Something went wrong');
    });
  });
});
