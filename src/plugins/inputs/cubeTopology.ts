/**
 * Cube topology helpers — maps between LED indices, edges, and faces.
 *
 * HyperCube 15-SE: 12 edges, 224 LEDs total.
 * - Edges 0-7 (bottom + top): 19 LEDs each
 * - Edges 8-11 (vertical): 18 LEDs each
 */

import {
  EDGE_COUNT as _EDGE_COUNT,
  DEFAULT_LED_COUNT,
  EDGE_LED_COUNTS,
  getEdgeStartIndex,
} from '@/core/constants';

export const EDGE_COUNT = _EDGE_COUNT;
export const FACE_COUNT = 6;

/** Total LED count (re-exported for convenience) */
export const LED_COUNT = DEFAULT_LED_COUNT;

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
 * Get the edge index (0-11) for a given LED index (0-223).
 * Handles non-uniform LED counts per edge.
 * @throws if ledIndex is out of range
 */
export function getEdgeIndex(ledIndex: number): number {
  if (ledIndex < 0 || ledIndex >= LED_COUNT) {
    throw new RangeError(`LED index ${ledIndex} out of range [0, ${LED_COUNT - 1}]`);
  }
  let cumulative = 0;
  for (let e = 0; e < EDGE_COUNT; e++) {
    cumulative += EDGE_LED_COUNTS[e];
    if (ledIndex < cumulative) return e;
  }
  return EDGE_COUNT - 1; // should not reach here
}

/**
 * Get all LED indices for a given edge (0-11).
 * Returns array of LED indices (19 for edges 0-7, 18 for edges 8-11).
 * @throws if edgeIndex is out of range
 */
export function getEdgeLedIndices(edgeIndex: number): number[] {
  if (edgeIndex < 0 || edgeIndex >= EDGE_COUNT) {
    throw new RangeError(`Edge index ${edgeIndex} out of range [0, ${EDGE_COUNT - 1}]`);
  }
  const start = getEdgeStartIndex(edgeIndex);
  const count = EDGE_LED_COUNTS[edgeIndex];
  const indices: number[] = [];
  for (let i = 0; i < count; i++) {
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
 * Returns array of LED indices (variable count due to non-uniform edges).
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
