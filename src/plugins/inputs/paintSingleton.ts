/**
 * Module-level singletons for the paint plugin and output.
 *
 * Why module singletons (not Zustand/context):
 * - CubeMesh pointer handlers run in the R3F hot path — no React hooks allowed
 * - Paint output is stateful (diff buffer) — must be the same instance everywhere
 * - Simple import access from both CubeMesh and PaintControls
 */
import { ManualPaintPlugin } from './ManualPaintPlugin';

export const paintPlugin = new ManualPaintPlugin();
