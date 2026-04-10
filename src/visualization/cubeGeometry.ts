import * as THREE from 'three';
import { EDGE_COUNT, EDGE_LED_COUNTS, DEFAULT_LED_COUNT } from '@/core/constants';

export { EDGE_COUNT, DEFAULT_LED_COUNT as LED_COUNT };

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
 * Returns 224 Vector3 LED positions in edge-major order.
 *
 * HyperCube 15-SE has 224 LEDs across 12 edges:
 * - Edges 0-7 (bottom + top): 19 LEDs each
 * - Edges 8-11 (vertical): 18 LEDs each
 *
 * LEDs are evenly spaced within each edge. t=(j+0.5)/ledsOnEdge
 * places the first LED at a small offset along the edge (not at the corner vertex).
 * This matches physical LED strip behavior (LED center, not strip end).
 */
export function computeLEDPositions(): THREE.Vector3[] {
  const positions: THREE.Vector3[] = [];
  for (let edgeIdx = 0; edgeIdx < EDGES.length; edgeIdx++) {
    const [startIdx, endIdx] = EDGES[edgeIdx];
    const start = V[startIdx];
    const end = V[endIdx];
    const ledsOnEdge = EDGE_LED_COUNTS[edgeIdx];
    for (let j = 0; j < ledsOnEdge; j++) {
      const t = (j + 0.5) / ledsOnEdge;
      positions.push(new THREE.Vector3().lerpVectors(start, end, t));
    }
  }
  return positions;
}
