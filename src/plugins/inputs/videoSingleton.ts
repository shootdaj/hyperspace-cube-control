/**
 * Module-level singleton for the video plugin.
 *
 * Why module singleton (not Zustand/context):
 * - HTMLVideoElement + Worker must persist across React re-renders
 * - Pipeline reads from it in the RAF hot path
 * - Simple import access from both VideoControls and pipeline wiring
 */
import { VideoPlugin } from './VideoPlugin';

export const videoPlugin = new VideoPlugin();
