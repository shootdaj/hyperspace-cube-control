/**
 * Hardware constants for the HyperCube 15-SE.
 *
 * The cube has 224 LEDs across 12 edges. LED distribution:
 * - Edges 0-7 (bottom, top faces): 19 LEDs each (19 * 8 = 152)
 * - Edges 8-11 (vertical pillars): 18 LEDs each (18 * 4 = 72)
 * - Total: 152 + 72 = 224
 *
 * These are the runtime defaults for the physical cube. The app
 * can also read the actual count from the device via /json/info.
 */

export const EDGE_COUNT = 12;

/** Total LED count for the HyperCube 15-SE */
export const DEFAULT_LED_COUNT = 224;

/** LEDs per edge — varies slightly; use EDGE_LED_COUNTS for exact per-edge values */
export const LEDS_PER_EDGE_APPROX = 19;

/**
 * Exact LED count per edge. First 8 edges (bottom + top faces) have 19 LEDs,
 * last 4 edges (vertical pillars) have 18 LEDs. Total = 224.
 */
export const EDGE_LED_COUNTS: readonly number[] = [
  19, 19, 19, 19, // bottom face edges
  19, 19, 19, 19, // top face edges
  18, 18, 18, 18, // vertical pillar edges
];

/** RGB bytes per LED */
export const BYTES_PER_LED = 3;

/** Total frame size in bytes: 224 * 3 = 672 */
export const DEFAULT_FRAME_SIZE = DEFAULT_LED_COUNT * BYTES_PER_LED;

/**
 * Get the starting LED index for a given edge.
 * Accounts for non-uniform LEDs per edge.
 */
export function getEdgeStartIndex(edgeIndex: number): number {
  let start = 0;
  for (let i = 0; i < edgeIndex; i++) {
    start += EDGE_LED_COUNTS[i];
  }
  return start;
}
