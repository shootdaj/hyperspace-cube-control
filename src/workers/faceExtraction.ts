/**
 * Face-to-edge extraction logic — maps video frame to 6 cube faces,
 * then extracts pixel colors along the edges of each face region.
 *
 * Pure functions, no DOM/Worker dependency — fully unit-testable.
 *
 * Layout: Video frame is divided into a 3x2 grid:
 *   [Face 0: Bottom] [Face 1: Top]
 *   [Face 2: Front]  [Face 3: Right]
 *   [Face 4: Back]   [Face 5: Left]
 *
 * For each face, sample the 4 edges (40 LEDs each) from the border pixels
 * of that face's region.
 */

import { EDGE_LED_COUNTS, DEFAULT_LED_COUNT, getEdgeStartIndex } from '@/core/constants';

const LED_COUNT = DEFAULT_LED_COUNT;


/**
 * Face region in normalized [0,1] coordinates.
 */
interface FaceRegion {
  x: number;      // left edge (0-1)
  y: number;      // top edge (0-1)
  width: number;  // width (0-1)
  height: number; // height (0-1)
}

/**
 * 6 face regions in a 3x2 grid layout.
 * Each cell is 1/3 width, 1/2 height of the video frame.
 */
export const FACE_REGIONS: FaceRegion[] = [
  { x: 0.0,   y: 0.0, width: 1/3, height: 0.5 },  // Face 0: Bottom
  { x: 1/3,   y: 0.0, width: 1/3, height: 0.5 },  // Face 1: Top
  { x: 2/3,   y: 0.0, width: 1/3, height: 0.5 },  // Face 2: Front
  { x: 0.0,   y: 0.5, width: 1/3, height: 0.5 },  // Face 3: Right
  { x: 1/3,   y: 0.5, width: 1/3, height: 0.5 },  // Face 4: Back
  { x: 2/3,   y: 0.5, width: 1/3, height: 0.5 },  // Face 5: Left
];

/**
 * Cube face-to-edge mapping: which edges belong to each face, and
 * which border of the face region to sample.
 *
 * Face edges from cubeTopology.ts:
 *   Face 0 (Bottom): edges 0,1,2,3
 *   Face 1 (Top):    edges 4,5,6,7
 *   Face 2 (Front):  edges 0,4,8,9
 *   Face 3 (Right):  edges 1,5,9,10
 *   Face 4 (Back):   edges 2,6,10,11
 *   Face 5 (Left):   edges 3,7,8,11
 *
 * Since each edge belongs to 2 faces, we sample from the first face
 * that references it (to avoid double-processing). The edge-to-border
 * mapping: top, right, bottom, left of the face region.
 */
type BorderSide = 'top' | 'right' | 'bottom' | 'left';

interface EdgeBorderMapping {
  faceIndex: number;
  edgeIndex: number;
  border: BorderSide;
}

/**
 * Maps each of the 12 edges to a specific border of a specific face region.
 * This determines where in the video frame each edge samples its pixels.
 */
export const EDGE_BORDER_MAPPINGS: EdgeBorderMapping[] = [
  // Face 0 (Bottom): edges 0,1,2,3
  { faceIndex: 0, edgeIndex: 0, border: 'top' },
  { faceIndex: 0, edgeIndex: 1, border: 'right' },
  { faceIndex: 0, edgeIndex: 2, border: 'bottom' },
  { faceIndex: 0, edgeIndex: 3, border: 'left' },
  // Face 1 (Top): edges 4,5,6,7
  { faceIndex: 1, edgeIndex: 4, border: 'top' },
  { faceIndex: 1, edgeIndex: 5, border: 'right' },
  { faceIndex: 1, edgeIndex: 6, border: 'bottom' },
  { faceIndex: 1, edgeIndex: 7, border: 'left' },
  // Face 2 (Front): edges 8,9 (edges 0,4 already covered)
  { faceIndex: 2, edgeIndex: 8, border: 'left' },
  { faceIndex: 2, edgeIndex: 9, border: 'right' },
  // Face 3 (Right): edges 10 (edges 1,5,9 already covered)
  { faceIndex: 3, edgeIndex: 10, border: 'right' },
  // Face 4 (Back): edge 11 (edges 2,6,10 already covered)
  { faceIndex: 4, edgeIndex: 11, border: 'left' },
];

/**
 * Sample a single pixel from RGBA image data. Clamps to valid range.
 */
function samplePixelRgb(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  x: number,
  y: number,
): [number, number, number] {
  const px = Math.max(0, Math.min(width - 1, Math.round(x)));
  const py = Math.max(0, Math.min(height - 1, Math.round(y)));
  const offset = (py * width + px) * 4;
  return [data[offset], data[offset + 1], data[offset + 2]];
}

/**
 * Sample pixels along one border of a face region.
 *
 * @param data - RGBA pixel data
 * @param width - Image width
 * @param height - Image height
 * @param region - The face region in normalized coordinates
 * @param border - Which border to sample (top/right/bottom/left)
 * @param sampleCount - Number of samples to take (LEDs on this edge)
 * @returns Array of [r,g,b] triplets
 */
export function sampleBorder(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  region: FaceRegion,
  border: BorderSide,
  sampleCount: number = 19,
): Array<[number, number, number]> {
  const samples: Array<[number, number, number]> = [];

  const left = region.x * (width - 1);
  const top = region.y * (height - 1);
  const right = (region.x + region.width) * (width - 1);
  const bottom = (region.y + region.height) * (height - 1);

  for (let i = 0; i < sampleCount; i++) {
    const t = sampleCount > 1 ? i / (sampleCount - 1) : 0.5;
    let px: number, py: number;

    switch (border) {
      case 'top':
        px = left + (right - left) * t;
        py = top;
        break;
      case 'bottom':
        px = left + (right - left) * t;
        py = bottom;
        break;
      case 'left':
        px = left;
        py = top + (bottom - top) * t;
        break;
      case 'right':
        px = right;
        py = top + (bottom - top) * t;
        break;
    }

    samples.push(samplePixelRgb(data, width, height, px, py));
  }

  return samples;
}

/**
 * Extract 224 LED colors using face-to-edge extraction strategy.
 *
 * Divides the video frame into 6 face regions, then samples the border
 * pixels of each region corresponding to the cube's 12 edges.
 *
 * @param imageData - RGBA pixel data from getImageData()
 * @param width - Image width in pixels
 * @param height - Image height in pixels
 * @returns Uint8Array of LED_COUNT*3 RGB bytes
 */
export function extractFaceEdges(
  imageData: Uint8ClampedArray,
  width: number,
  height: number,
): Uint8Array {
  const result = new Uint8Array(LED_COUNT * 3);

  for (const mapping of EDGE_BORDER_MAPPINGS) {
    const region = FACE_REGIONS[mapping.faceIndex];
    const ledsOnEdge = EDGE_LED_COUNTS[mapping.edgeIndex];
    const samples = sampleBorder(imageData, width, height, region, mapping.border, ledsOnEdge);

    for (let led = 0; led < ledsOnEdge; led++) {
      const [r, g, b] = samples[led];
      const outIdx = (getEdgeStartIndex(mapping.edgeIndex) + led) * 3;
      result[outIdx] = r;
      result[outIdx + 1] = g;
      result[outIdx + 2] = b;
    }
  }

  return result;
}
