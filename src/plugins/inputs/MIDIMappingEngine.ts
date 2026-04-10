/**
 * MIDIMappingEngine — handles the logic of mapping MIDI CC/note events
 * to cube parameters and actions.
 *
 * Pure logic, no WEBMIDI.js dependency — testable without browser MIDI API.
 */
import { midiStore, type CCMapping, type NoteMapping } from '@/stores/midiStore';
import { cubeStateStore } from '@/core/store/cubeStateStore';
import { presetStore } from '@/core/store/presetStore';
import { connectionStore } from '@/core/store/connectionStore';
import { WLEDControlService } from '@/core/wled/WLEDControlService';
import { ledStateProxy } from '@/core/store/ledStateProxy';
import { DEFAULT_LED_COUNT } from '@/core/constants';


/**
 * Maps a raw CC value (0-127) to a parameter's native range.
 */
export function mapCCToParameterValue(
  ccValue: number,
  target: CCMapping['target'],
): number {
  const clamped = Math.max(0, Math.min(127, Math.round(ccValue)));
  switch (target) {
    case 'brightness':
      return Math.round(clamped * (255 / 127));
    case 'speed':
      return Math.round(clamped * (255 / 127));
    case 'intensity':
      return Math.round(clamped * (255 / 127));
    case 'hue':
      return Math.round(clamped * (360 / 127));
    default:
      return clamped;
  }
}

/**
 * Converts a hue (0-360) to an RGB color.
 * Returns [r, g, b] with full saturation and lightness.
 */
export function hueToRGB(hue: number): [number, number, number] {
  const h = ((hue % 360) + 360) % 360;
  const s = 1;
  const l = 0.5;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;

  let r = 0, g = 0, b = 0;
  if (h < 60) { r = c; g = x; b = 0; }
  else if (h < 120) { r = x; g = c; b = 0; }
  else if (h < 180) { r = 0; g = c; b = x; }
  else if (h < 240) { r = 0; g = x; b = c; }
  else if (h < 300) { r = x; g = 0; b = c; }
  else { r = c; g = 0; b = x; }

  return [
    Math.round((r + m) * 255),
    Math.round((g + m) * 255),
    Math.round((b + m) * 255),
  ];
}

/**
 * Process an incoming CC message. If in learn mode, captures the binding.
 * Otherwise, applies the mapped parameter change.
 */
export function handleCCMessage(channel: number, cc: number, rawValue: number): void {
  const state = midiStore.getState();

  // Update last CC value for display
  midiStore.getState().updateLastCCValue(cc, rawValue);

  // MIDI Learn mode: capture the CC and bind it to the learn target
  if (state.learnTarget && state.learnTarget.type === 'cc') {
    const mapping: CCMapping = {
      channel,
      cc,
      target: state.learnTarget.target,
    };
    midiStore.getState().addCCMapping(mapping);
    midiStore.getState().setLearnTarget(null);
    return;
  }

  // Find matching CC mapping
  const mapping = state.ccMappings.find(
    (m) => m.channel === channel && m.cc === cc,
  );
  if (!mapping) return;

  const value = mapCCToParameterValue(rawValue, mapping.target);
  applyCCParameter(mapping.target, value);
}

/**
 * Apply a mapped parameter value to the cube state.
 */
export function applyCCParameter(target: CCMapping['target'], value: number): void {
  const ip = connectionStore.getState().ip;
  const service = ip ? WLEDControlService.getInstance(ip) : null;

  switch (target) {
    case 'brightness':
      cubeStateStore.getState().setBrightness(value);
      service?.setBrightness(value);
      break;
    case 'speed':
      cubeStateStore.getState().setSpeed(value);
      service?.setSpeed(value);
      break;
    case 'intensity':
      cubeStateStore.getState().setIntensity(value);
      service?.setIntensity(value);
      break;
    case 'hue': {
      const [r, g, b] = hueToRGB(value);
      const colors = [...cubeStateStore.getState().colors];
      colors[0] = [r, g, b];
      cubeStateStore.getState().setColors(colors);
      service?.setColors(colors);
      break;
    }
  }
}

/**
 * Handle a drum pad note-on: fills all 224 LEDs with the pad's color.
 * Returns true if the note was consumed by a drum pad, false otherwise.
 */
export function handleDrumPadNoteOn(_channel: number, note: number, _velocity: number): boolean {
  const state = midiStore.getState();
  const padIndex = state.padNoteMap.indexOf(note);
  if (padIndex === -1) return false;

  const [r, g, b] = state.padColors[padIndex];

  // Update local visualization
  const colors = ledStateProxy.colors;
  for (let i = 0; i < DEFAULT_LED_COUNT; i++) {
    colors[i * 3] = r;
    colors[i * 3 + 1] = g;
    colors[i * 3 + 2] = b;
  }
  ledStateProxy.lastUpdated = performance.now();

  // Fire REST directly to cube — bypasses sACN for instant response
  const ip = connectionStore.getState().ip;
    if (ip) {
      fetch(`http://${ip}/json/state`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ on: true, bri: 255, seg: [{ col: [[r, g, b]] }] }),
    }).catch(() => {});
  }

  return true;
}

/**
 * Handle a drum pad note-off: clears all LEDs to black if hold mode is off.
 */
export function handleDrumPadNoteOff(note: number): void {
  const state = midiStore.getState();
  if (state.padHoldMode) return;
  const padIndex = state.padNoteMap.indexOf(note);
  if (padIndex === -1) return;

  const colors = ledStateProxy.colors;
  for (let i = 0; i < DEFAULT_LED_COUNT; i++) {
    colors[i * 3] = 0;
    colors[i * 3 + 1] = 0;
    colors[i * 3 + 2] = 0;
  }
  ledStateProxy.lastUpdated = performance.now();

  // Direct REST for instant response
  const ip = connectionStore.getState().ip;
    if (ip) {
      fetch(`http://${ip}/json/state`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ seg: [{ col: [[0, 0, 0]] }] }),
    }).catch(() => {});
  }
}

/**
 * Handle note-off messages from MIDI inputs.
 */
export function handleNoteOffMessage(_channel: number, note: number): void {
  handleDrumPadNoteOff(note);
}

/**
 * Process an incoming note-on message. If in learn mode, captures the binding.
 * Otherwise, triggers the mapped action.
 */
export function handleNoteOnMessage(channel: number, note: number, _velocity: number): void {
  const state = midiStore.getState();

  // Pad learn mode: assign the incoming note to the selected pad
  if (state.padLearnIndex !== null) {
    midiStore.getState().setPadNote(state.padLearnIndex, note);
    midiStore.getState().setPadLearnIndex(null);
    return;
  }

  // Drum pad note-on: fills all LEDs with pad color
  if (handleDrumPadNoteOn(channel, note, _velocity)) {
    return;
  }

  // MIDI Learn mode: capture the note and bind it to the learn target
  if (state.learnTarget && state.learnTarget.type === 'note') {
    const mapping: NoteMapping = {
      channel,
      note,
      action: state.learnTarget.action,
      actionIndex: state.learnTarget.actionIndex,
    };
    midiStore.getState().addNoteMapping(mapping);
    midiStore.getState().setLearnTarget(null);
    return;
  }

  // Find matching note mapping
  const mapping = state.noteMappings.find(
    (m) => m.channel === channel && m.note === note,
  );
  if (!mapping) return;

  executeNoteAction(mapping);
}

/**
 * Execute the action bound to a note mapping.
 */
export function executeNoteAction(mapping: NoteMapping): void {
  const ip = connectionStore.getState().ip;

  switch (mapping.action) {
    case 'preset': {
      const presets = presetStore.getState().presets;
      if (mapping.actionIndex >= 0 && mapping.actionIndex < presets.length && ip) {
        presetStore.getState().applyPreset(presets[mapping.actionIndex].id, ip);
      }
      break;
    }
    case 'effect': {
      cubeStateStore.getState().setEffectIndex(mapping.actionIndex);
      break;
    }
  }
}
