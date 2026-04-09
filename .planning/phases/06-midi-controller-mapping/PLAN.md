# Phase 6: MIDI Controller Mapping — Plan

## Objective
Integrate MIDI controller support via WEBMIDI.js v3 as an InputPlugin. Users can map CC knobs/sliders to cube parameters (brightness, speed, intensity, hue) and note-on events to preset activation or effect switching. Config is saved to localStorage. Safari/iOS gets a clear "not supported" message.

## Plans

### Plan 06-01: MIDI Store, Feature Detection, and MIDIPlugin (Wave 1)
**Tasks:**
1. Install `webmidi` package, create `midiStore` (Zustand), create `MIDIPlugin` implementing `InputPlugin`, create MIDI feature detection utility
2. Unit tests for MIDIPlugin, midiStore, feature detection

**Files:**
- `src/stores/midiStore.ts`
- `src/plugins/inputs/MIDIPlugin.ts`
- `src/plugins/inputs/midiSingleton.ts`
- `src/plugins/inputs/midiSupport.ts`
- `src/plugins/inputs/__tests__/MIDIPlugin.test.ts`
- `src/stores/__tests__/midiStore.test.ts`

### Plan 06-02: CC-to-Parameter Mapping and MIDI Learn (Wave 1)
**Tasks:**
1. Implement CC-to-parameter mapping logic with MIDI learn mode
2. Implement note-to-action mapping logic
3. Unit tests for mapping logic

**Files:**
- `src/plugins/inputs/MIDIMappingEngine.ts`
- `src/plugins/inputs/__tests__/MIDIMappingEngine.test.ts`

### Plan 06-03: Mapping Persistence (Wave 2)
**Tasks:**
1. Save/load MIDI mappings to localStorage
2. Unit tests for persistence

**Files:**
- `src/plugins/inputs/midiPersistence.ts`
- `src/plugins/inputs/__tests__/midiPersistence.test.ts`

### Plan 06-04: MIDIControls UI + ControlPanel Integration (Wave 2)
**Tasks:**
1. Create MIDIControls component with device selector, MIDI learn UI, mapping display
2. Add "MIDI" tab to ControlPanel
3. Graceful degradation message for unsupported browsers

**Files:**
- `src/control/MIDIControls.tsx`
- `src/control/ControlPanel.tsx` (modified)

### Plan 06-05: Plugin Registration and Integration Tests (Wave 3)
**Tasks:**
1. Register MIDIPlugin + MIDIMappingStrategy in PluginRegistry
2. Integration tests: MIDI pipeline end-to-end, plugin swap
3. Scenario tests: full user workflow

**Files:**
- `src/plugins/inputs/registerMIDIPlugins.ts`
- `src/plugins/mappings/MIDICCMappingStrategy.ts`
- `test/integration/midi-pipeline.test.ts`
- `test/scenarios/midi-workflow.test.ts`

## Success Criteria
1. App detects connected MIDI devices via Web MIDI API
2. User can map MIDI CC to brightness, speed, intensity, color hue
3. User can map note-on to preset activation or effect switching
4. MIDI mapping config is saveable/loadable
5. Graceful degradation on Safari/iOS with clear message
6. MIDI works as a swappable InputPlugin
