/**
 * Module-level singleton for the audio plugin.
 *
 * Why module singleton (not Zustand/context):
 * - AudioContext must persist across React re-renders
 * - Pipeline reads from it in the RAF hot path
 * - Simple import access from both AudioControls and pipeline wiring
 */
import { AudioPlugin } from './AudioPlugin';

export const audioPlugin = new AudioPlugin();
