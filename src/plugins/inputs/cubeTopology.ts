/**
 * Cube topology helpers — maps between LED indices, edges, and faces.
 *
 * HyperCube 15-SE: 12 edges, 40 LEDs per edge, 480 total.
 * LED index = edgeIndex * LEDS_PER_EDGE + positionOnEdge.
 */

export const LEDS_PER_EDGE = 40;
export const EDGE_COUNT = 12;
export const FACE_COUNT = 6;

/**
 * 6 cube faces, each defined by its 4 edge indices.
 *
 * Face 0: Bottom (edges 0,1,2,3)  — vertices 0-1-2-3
 * Face 1: Top    (edges 4,5,6,7)  — vertices 4-5-6-7
 * Face 2: Front  (edges 0,4,8,9)  — vertices 0-1-5-4
 * Face 3: Right  (edges 1,5,9,10) — vertices 1-2-6-5
 * Face 4: Back   (edges 2,6,10,11)— vertices 2-3-7-6
 * Face 5: Left   (edges 3,7,8,11) — vertices 3-0-4-7
 */
export const FACE_EDGES: readonly number[][] = [
  [0, 1, 2, 3],     // Bottom
  [4, 5, 6, 7],     // Top
  [0, 4, 8, 9],     // Front
  [1, 5, 9, 10],    // Right
  [2, 6, 10, 11],   // Back
  [3, 7, 8, 11],    // Left
];

/**
 * Get the edge index (0-11) for a given LED index (0-479).
 * @throws if ledIndex is out of range
 */
export function getEdgeIndex(ledIndex: number): number {
  if (ledIndex < 0 || ledIndex >= LEDS_PER_EDGE * EDGE_COUNT) {
    throw new RangeError(`LED index ${ledIndex} out of range [0, ${LEDS_PER_EDGE * EDGE_COUNT - 1}]`);
  }
  return Math.floor(ledIndex / LEDS_PER_EDGE);
}

/**
 * Get all LED indices for a given edge (0-11).
 * Returns array of 40 LED indices.
 * @throws if edgeIndex is out of range
 */
export function getEdgeLedIndices(edgeIndex: number): number[] {
  if (edgeIndex < 0 || edgeIndex >= EDGE_COUNT) {
    throw new RangeError(`Edge index ${edgeIndex} out of range [0, ${EDGE_COUNT - 1}]`);
  }
  const start = edgeIndex * LEDS_PER_EDGE;
  const indices: number[] = [];
  for (let i = 0; i < LEDS_PER_EDGE; i++) {
    indices.push(start + i);
  }
  return indices;
}

/**
 * Get the face indices (0-5) that contain a given edge (0-11).
 * Each edge belongs to exactly 2 faces.
 * @throws if edgeIndex is out of range
 */
export function getEdgeFaces(edgeIndex: number): number[] {
  if (edgeIndex < 0 || edgeIndex >= EDGE_COUNT) {
    throw new RangeError(`Edge index ${edgeIndex} out of range [0, ${EDGE_COUNT - 1}]`);
  }
  const faces: number[] = [];
  for (let f = 0; f < FACE_COUNT; f++) {
    if (FACE_EDGES[f].includes(edgeIndex)) {
      faces.push(f);
    }
  }
  return faces;
}

/**
 * Get all LED indices for all edges of a given face (0-5).
 * Returns array of 160 LED indices (4 edges * 40 LEDs).
 * @throws if faceIndex is out of range
 */
export function getFaceEdgeIndices(faceIndex: number): number[] {
  if (faceIndex < 0 || faceIndex >= FACE_COUNT) {
    throw new RangeError(`Face index ${faceIndex} out of range [0, ${FACE_COUNT - 1}]`);
  }
  const indices: number[] = [];
  for (const edgeIndex of FACE_EDGES[faceIndex]) {
    const edgeLeds = getEdgeLedIndices(edgeIndex);
    indices.push(...edgeLeds);
  }
  return indices;
}
