import { proxy } from 'valtio';

/**
 * High-frequency LED color state -- 480 LEDs x 3 channels (RGB).
 *
 * IMPORTANT: Use Valtio proxy(), NOT Zustand create().
 * - Pipeline writes here at 30-60fps via direct mutation
 * - Three.js reads here in useFrame() -- zero React re-renders
 * - React components that need to display LED data use `useSnapshot(ledStateProxy)`
 *
 * Layout: colors[i*3] = R, colors[i*3+1] = G, colors[i*3+2] = B for LED index i
 */
export const ledStateProxy = proxy({
  colors: new Uint8Array(480 * 3),
  lastUpdated: 0,
});
