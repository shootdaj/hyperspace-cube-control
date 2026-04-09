/**
 * MIDI mapping persistence — save/load MIDI mapping configuration to localStorage.
 */
import { midiStore, type MIDIMappingConfig, type CCMapping, type NoteMapping } from '@/stores/midiStore';

const STORAGE_KEY = 'hypercube-midi-mappings';
const CURRENT_VERSION = 1;

/**
 * Save current MIDI mappings from the store to localStorage.
 */
export function saveMIDIMappings(): void {
  const state = midiStore.getState();
  const config: MIDIMappingConfig = {
    version: CURRENT_VERSION,
    ccMappings: state.ccMappings,
    noteMappings: state.noteMappings,
  };

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch {
    // localStorage full or unavailable — silently fail
  }
}

/**
 * Load MIDI mappings from localStorage into the store.
 * Returns true if mappings were loaded, false otherwise.
 */
export function loadMIDIMappings(): boolean {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;

    const config = JSON.parse(raw) as MIDIMappingConfig;

    // Version check
    if (!config || config.version !== CURRENT_VERSION) return false;

    // Validate arrays exist
    if (!Array.isArray(config.ccMappings) || !Array.isArray(config.noteMappings)) {
      return false;
    }

    // Validate individual mappings
    const validCCMappings = config.ccMappings.filter(isValidCCMapping);
    const validNoteMappings = config.noteMappings.filter(isValidNoteMapping);

    midiStore.getState().setCCMappings(validCCMappings);
    midiStore.getState().setNoteMappings(validNoteMappings);
    return true;
  } catch {
    // Corrupted data — silently fail
    return false;
  }
}

/**
 * Clear saved MIDI mappings from localStorage.
 */
export function clearSavedMIDIMappings(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // silently fail
  }
}

/**
 * Validate a CC mapping has correct shape and ranges.
 */
function isValidCCMapping(m: unknown): m is CCMapping {
  if (!m || typeof m !== 'object') return false;
  const mapping = m as Record<string, unknown>;
  return (
    typeof mapping.channel === 'number' &&
    mapping.channel >= 1 &&
    mapping.channel <= 16 &&
    typeof mapping.cc === 'number' &&
    mapping.cc >= 0 &&
    mapping.cc <= 127 &&
    typeof mapping.target === 'string' &&
    ['brightness', 'speed', 'intensity', 'hue'].includes(mapping.target)
  );
}

/**
 * Validate a note mapping has correct shape and ranges.
 */
function isValidNoteMapping(m: unknown): m is NoteMapping {
  if (!m || typeof m !== 'object') return false;
  const mapping = m as Record<string, unknown>;
  return (
    typeof mapping.channel === 'number' &&
    mapping.channel >= 1 &&
    mapping.channel <= 16 &&
    typeof mapping.note === 'number' &&
    mapping.note >= 0 &&
    mapping.note <= 127 &&
    typeof mapping.action === 'string' &&
    ['preset', 'effect'].includes(mapping.action) &&
    typeof mapping.actionIndex === 'number' &&
    mapping.actionIndex >= 0
  );
}
