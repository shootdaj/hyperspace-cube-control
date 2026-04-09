/**
 * Module-level singleton for the camera plugin.
 *
 * Why module singleton (not Zustand/context):
 * - getUserMedia stream + Worker must persist across React re-renders
 * - Pipeline reads from it in the RAF hot path
 * - Simple import access from both CameraControls and pipeline wiring
 */
import { CameraPlugin } from './CameraPlugin';

export const cameraPlugin = new CameraPlugin();
