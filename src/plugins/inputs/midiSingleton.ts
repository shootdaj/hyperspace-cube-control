/**
 * Module-level singleton for the MIDI plugin.
 *
 * Why module singleton (not Zustand/context):
 * - WEBMIDI.js state must persist across React re-renders
 * - Pipeline reads from it in the RAF hot path
 * - Simple import access from both MIDIControls and pipeline wiring
 */
import { MIDIPlugin } from './MIDIPlugin';

export const midiPlugin = new MIDIPlugin();
