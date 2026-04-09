import * as THREE from 'three';

export const LEDS_PER_EDGE = 40;
export const EDGE_COUNT = 12;

const HALF = 0.5;

// 8 vertices of a unit cube centered at origin
const V: THREE.Vector3[] = [
  new THREE.Vector3(-HALF, -HALF, -HALF), // 0
  new THREE.Vector3(+HALF, -HALF, -HALF), // 1
  new THREE.Vector3(+HALF, -HALF, +HALF), // 2
  new THREE.Vector3(-HALF, -HALF, +HALF), // 3
  new THREE.Vector3(-HALF, +HALF, -HALF), // 4
  new THREE.Vector3(+HALF, +HALF, -HALF), // 5
  new THREE.Vector3(+HALF, +HALF, +HALF), // 6
  new THREE.Vector3(-HALF, +HALF, +HALF), // 7
];

// 12 edges: [startVertexIndex, endVertexIndex]
// Order matters: WLED LED index 0 maps to edge 0, position 0
const EDGES: [number, number][] = [
  [0, 1], [1, 2], [2, 3], [3, 0], // bottom face edges (CCW from front-left)
  [4, 5], [5, 6], [6, 7], [7, 4], // top face edges
  [0, 4], [1, 5], [2, 6], [3, 7], // vertical edges
];

/**
 * Returns 480 Vector3 LED positions in edge-major order.
 * LED index = edgeIndex * LEDS_PER_EDGE + positionOnEdge.
 *
 * LEDs are evenly spaced within each edge. t=(j+0.5)/LEDS_PER_EDGE
 * places the first LED at 1.25% along the edge (not at the corner vertex).
 * This matches physical LED strip behavior (LED center, not strip end).
 *
 * NOTE: Physical wiring order on HC15-SE may differ. A LED_ORDER_MAPPING
 * constant can be added once validated against hardware (see open question in RESEARCH.md).
 */
export function computeLEDPositions(): THREE.Vector3[] {
  const positions: THREE.Vector3[] = [];
  for (const [startIdx, endIdx] of EDGES) {
    const start = V[startIdx];
    const end = V[endIdx];
    for (let j = 0; j < LEDS_PER_EDGE; j++) {
      const t = (j + 0.5) / LEDS_PER_EDGE;
      positions.push(new THREE.Vector3().lerpVectors(start, end, t));
    }
  }
  return positions;
}
