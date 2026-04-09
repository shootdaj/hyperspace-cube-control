import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { saveMIDIMappings, loadMIDIMappings, clearSavedMIDIMappings } from '../midiPersistence';
import { midiStore } from '@/stores/midiStore';

const STORAGE_KEY = 'hypercube-midi-mappings';

describe('midiPersistence', () => {
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
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('saveMIDIMappings', () => {
    it('TestMIDIPersist_SavesEmptyMappings', () => {
      saveMIDIMappings();
      const raw = localStorage.getItem(STORAGE_KEY);
      expect(raw).not.toBeNull();
      const config = JSON.parse(raw!);
      expect(config.version).toBe(1);
      expect(config.ccMappings).toEqual([]);
      expect(config.noteMappings).toEqual([]);
    });

    it('TestMIDIPersist_SavesCCMappings', () => {
      midiStore.getState().addCCMapping({ channel: 1, cc: 7, target: 'brightness' });
      midiStore.getState().addCCMapping({ channel: 1, cc: 10, target: 'speed' });
      saveMIDIMappings();

      const raw = localStorage.getItem(STORAGE_KEY);
      const config = JSON.parse(raw!);
      expect(config.ccMappings).toHaveLength(2);
      expect(config.ccMappings[0].target).toBe('brightness');
      expect(config.ccMappings[1].target).toBe('speed');
    });

    it('TestMIDIPersist_SavesNoteMappings', () => {
      midiStore.getState().addNoteMapping({
        channel: 1, note: 60, action: 'preset', actionIndex: 0,
      });
      saveMIDIMappings();

      const raw = localStorage.getItem(STORAGE_KEY);
      const config = JSON.parse(raw!);
      expect(config.noteMappings).toHaveLength(1);
      expect(config.noteMappings[0].note).toBe(60);
    });

    it('TestMIDIPersist_HandleslocalStorageError', () => {
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('QuotaExceeded');
      });
      // Should not throw
      expect(() => saveMIDIMappings()).not.toThrow();
    });
  });

  describe('loadMIDIMappings', () => {
    it('TestMIDIPersist_LoadsValidConfig', () => {
      const config = {
        version: 1,
        ccMappings: [{ channel: 1, cc: 7, target: 'brightness' }],
        noteMappings: [{ channel: 1, note: 60, action: 'preset', actionIndex: 0 }],
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(config));

      const result = loadMIDIMappings();
      expect(result).toBe(true);
      expect(midiStore.getState().ccMappings).toHaveLength(1);
      expect(midiStore.getState().noteMappings).toHaveLength(1);
    });

    it('TestMIDIPersist_ReturnsFalseWhenNoData', () => {
      const result = loadMIDIMappings();
      expect(result).toBe(false);
    });

    it('TestMIDIPersist_ReturnsFalseForCorruptedData', () => {
      localStorage.setItem(STORAGE_KEY, 'not-json');
      const result = loadMIDIMappings();
      expect(result).toBe(false);
    });

    it('TestMIDIPersist_ReturnsFalseForWrongVersion', () => {
      const config = {
        version: 99,
        ccMappings: [],
        noteMappings: [],
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
      const result = loadMIDIMappings();
      expect(result).toBe(false);
    });

    it('TestMIDIPersist_FiltersInvalidCCMappings', () => {
      const config = {
        version: 1,
        ccMappings: [
          { channel: 1, cc: 7, target: 'brightness' }, // valid
          { channel: 0, cc: 7, target: 'brightness' }, // invalid channel
          { channel: 1, cc: 200, target: 'brightness' }, // invalid cc
          { channel: 1, cc: 7, target: 'invalid_target' }, // invalid target
          null, // null entry
        ],
        noteMappings: [],
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
      loadMIDIMappings();
      expect(midiStore.getState().ccMappings).toHaveLength(1);
    });

    it('TestMIDIPersist_FiltersInvalidNoteMappings', () => {
      const config = {
        version: 1,
        ccMappings: [],
        noteMappings: [
          { channel: 1, note: 60, action: 'preset', actionIndex: 0 }, // valid
          { channel: 0, note: 60, action: 'preset', actionIndex: 0 }, // invalid channel
          { channel: 1, note: 200, action: 'preset', actionIndex: 0 }, // invalid note
          { channel: 1, note: 60, action: 'invalid', actionIndex: 0 }, // invalid action
          { channel: 1, note: 60, action: 'preset', actionIndex: -1 }, // invalid index
        ],
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
      loadMIDIMappings();
      expect(midiStore.getState().noteMappings).toHaveLength(1);
    });

    it('TestMIDIPersist_RoundTripSaveLoad', () => {
      midiStore.getState().addCCMapping({ channel: 1, cc: 7, target: 'brightness' });
      midiStore.getState().addCCMapping({ channel: 2, cc: 10, target: 'speed' });
      midiStore.getState().addNoteMapping({
        channel: 1, note: 60, action: 'preset', actionIndex: 0,
      });
      midiStore.getState().addNoteMapping({
        channel: 1, note: 72, action: 'effect', actionIndex: 5,
      });

      saveMIDIMappings();

      // Clear store
      midiStore.getState().clearAllMappings();
      expect(midiStore.getState().ccMappings).toHaveLength(0);

      // Load back
      const result = loadMIDIMappings();
      expect(result).toBe(true);
      expect(midiStore.getState().ccMappings).toHaveLength(2);
      expect(midiStore.getState().noteMappings).toHaveLength(2);
    });
  });

  describe('clearSavedMIDIMappings', () => {
    it('TestMIDIPersist_ClearsStoredMappings', () => {
      localStorage.setItem(STORAGE_KEY, '{"version":1}');
      clearSavedMIDIMappings();
      expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    });
  });
});
