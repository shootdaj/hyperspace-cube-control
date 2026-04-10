import { create } from 'zustand';

/** A CC mapping: a specific MIDI CC on a channel controls a cube parameter */
export interface CCMapping {
  channel: number; // 1-16
  cc: number; // 0-127
  target: 'brightness' | 'speed' | 'intensity' | 'hue';
}

/** A note mapping: a specific MIDI note triggers a preset or effect */
export interface NoteMapping {
  channel: number; // 1-16
  note: number; // 0-127
  action: 'preset' | 'effect';
  actionIndex: number; // index into preset list or effect list
}

/** Serializable MIDI mapping configuration */
export interface MIDIMappingConfig {
  version: 1;
  ccMappings: CCMapping[];
  noteMappings: NoteMapping[];
}

export type MIDILearnTarget =
  | { type: 'cc'; target: CCMapping['target'] }
  | { type: 'note'; action: NoteMapping['action']; actionIndex: number }
  | null;

export interface MIDIDeviceInfo {
  id: string;
  name: string;
  manufacturer: string;
}

interface MIDIState {
  /** Whether Web MIDI API is supported in this browser */
  isSupported: boolean;
  /** Whether WEBMIDI.js has been successfully enabled */
  isEnabled: boolean;
  /** Connected MIDI input devices */
  devices: MIDIDeviceInfo[];
  /** Currently selected input device ID (null = listen to all) */
  selectedDeviceId: string | null;
  /** CC mappings: CC -> parameter */
  ccMappings: CCMapping[];
  /** Note mappings: note -> action */
  noteMappings: NoteMapping[];
  /** Current MIDI learn target (null = not in learn mode) */
  learnTarget: MIDILearnTarget;
  /** Last received CC values for display (cc number -> raw value 0-127) */
  lastCCValues: Record<string, number>;
  /** Error message from MIDI initialization */
  error: string | null;

  /** 8 drum pad colors as RGB tuples (rainbow default) */
  padColors: [number, number, number][];
  /** 8 MIDI note numbers mapped to drum pads (standard drum pad notes) */
  padNoteMap: number[];
  /** Whether pad color holds after note-off (false = fade back to black) */
  padHoldMode: boolean;
  /** Which pad is in learn mode (null = none) */
  padLearnIndex: number | null;

  // Actions
  setIsSupported: (supported: boolean) => void;
  setIsEnabled: (enabled: boolean) => void;
  setDevices: (devices: MIDIDeviceInfo[]) => void;
  setSelectedDeviceId: (id: string | null) => void;
  setCCMappings: (mappings: CCMapping[]) => void;
  setNoteMappings: (mappings: NoteMapping[]) => void;
  addCCMapping: (mapping: CCMapping) => void;
  removeCCMapping: (channel: number, cc: number) => void;
  addNoteMapping: (mapping: NoteMapping) => void;
  removeNoteMapping: (channel: number, note: number) => void;
  setLearnTarget: (target: MIDILearnTarget) => void;
  updateLastCCValue: (cc: number, value: number) => void;
  setError: (error: string | null) => void;
  clearAllMappings: () => void;
  setPadColor: (index: number, rgb: [number, number, number]) => void;
  setPadNote: (index: number, note: number) => void;
  setPadHoldMode: (v: boolean) => void;
  setPadLearnIndex: (index: number | null) => void;
}

export const midiStore = create<MIDIState>((set, get) => ({
  isSupported: false,
  isEnabled: false,
  devices: [],
  selectedDeviceId: null,
  ccMappings: [],
  noteMappings: [],
  learnTarget: null,
  lastCCValues: {},
  error: null,

  padColors: [
    [255, 0, 0], [255, 127, 0], [255, 255, 0], [0, 255, 0],
    [0, 127, 255], [0, 0, 255], [127, 0, 255], [255, 0, 127],
  ],
  padNoteMap: [36, 37, 38, 39, 40, 41, 42, 43],
  padHoldMode: false,
  padLearnIndex: null,

  setIsSupported: (isSupported) => set({ isSupported }),
  setIsEnabled: (isEnabled) => set({ isEnabled }),
  setDevices: (devices) => set({ devices }),
  setSelectedDeviceId: (selectedDeviceId) => set({ selectedDeviceId }),
  setCCMappings: (ccMappings) => set({ ccMappings }),
  setNoteMappings: (noteMappings) => set({ noteMappings }),

  addCCMapping: (mapping) => {
    const current = get().ccMappings;
    // Remove any existing mapping for the same CC+channel
    const filtered = current.filter(
      (m) => !(m.channel === mapping.channel && m.cc === mapping.cc),
    );
    // Also remove any existing mapping for the same target (1:1)
    const deduped = filtered.filter((m) => m.target !== mapping.target);
    set({ ccMappings: [...deduped, mapping] });
  },

  removeCCMapping: (channel, cc) => {
    set({
      ccMappings: get().ccMappings.filter(
        (m) => !(m.channel === channel && m.cc === cc),
      ),
    });
  },

  addNoteMapping: (mapping) => {
    const current = get().noteMappings;
    // Remove any existing mapping for the same note+channel
    const filtered = current.filter(
      (m) => !(m.channel === mapping.channel && m.note === mapping.note),
    );
    set({ noteMappings: [...filtered, mapping] });
  },

  removeNoteMapping: (channel, note) => {
    set({
      noteMappings: get().noteMappings.filter(
        (m) => !(m.channel === channel && m.note === note),
      ),
    });
  },

  setLearnTarget: (learnTarget) => set({ learnTarget }),

  updateLastCCValue: (cc, value) => {
    set({
      lastCCValues: { ...get().lastCCValues, [cc]: value },
    });
  },

  setError: (error) => set({ error }),

  clearAllMappings: () => set({ ccMappings: [], noteMappings: [] }),

  setPadColor: (index, rgb) => {
    const padColors = [...get().padColors];
    padColors[index] = rgb;
    set({ padColors });
  },
  setPadNote: (index, note) => {
    const padNoteMap = [...get().padNoteMap];
    padNoteMap[index] = note;
    set({ padNoteMap });
  },
  setPadHoldMode: (v) => set({ padHoldMode: v }),
  setPadLearnIndex: (v) => set({ padLearnIndex: v }),
}));
