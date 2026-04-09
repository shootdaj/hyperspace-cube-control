/**
 * Edge sampling logic — samples pixel colors at positions corresponding to
 * the 12 cube edges (40 LEDs each = 480 total).
 *
 * Pure functions, no DOM/Worker dependency — fully unit-testable.
 *
 * Mapping:
 * - Edges 0-3 (bottom): horizontal lines across bottom quarter of frame
 * - Edges 4-7 (top): horizontal lines across top quarter of frame
 * - Edges 8-11 (vertical): vertical lines at left/right positions
 *
 * Each edge is mapped to a line segment in normalized [0,1] space,
 * then scaled to pixel coordinates for sampling.
 */

const LEDS_PER_EDGE = 40;
const EDGE_COUNT = 12;
const LED_COUNT = EDGE_COUNT * LEDS_PER_EDGE; // 480

/**
 * A line segment in normalized [0,1] coordinates.
 * start/end are [x, y] pairs.
 */
interface EdgeLine {
  start: [number, number];
  end: [number, number];
}

/**
 * 12 edge line segments mapped onto the video frame in normalized coordinates.
 *
 * Bottom face edges (0-3): horizontal lines across the bottom 25% of the frame
 * Top face edges (4-7): horizontal lines across the top 25% of the frame
 * Vertical edges (8-11): vertical lines at the four horizontal positions
 */
export const EDGE_LINES: EdgeLine[] = [
  // Bottom face: edges 0-3 (y = 0.85 to 0.95, spanning full width in segments)
  { start: [0.05, 0.85], end: [0.45, 0.85] },   // Edge 0: bottom-front
  { start: [0.55, 0.85], end: [0.95, 0.85] },   // Edge 1: bottom-right
  { start: [0.55, 0.95], end: [0.05, 0.95] },   // Edge 2: bottom-back
  { start: [0.05, 0.90], end: [0.05, 0.90] },   // Edge 3: bottom-left (short)

  // Top face: edges 4-7 (y = 0.05 to 0.15, spanning full width in segments)
  { start: [0.05, 0.15], end: [0.45, 0.15] },   // Edge 4: top-front
  { start: [0.55, 0.15], end: [0.95, 0.15] },   // Edge 5: top-right
  { start: [0.55, 0.05], end: [0.05, 0.05] },   // Edge 6: top-back
  { start: [0.95, 0.10], end: [0.55, 0.10] },   // Edge 7: top-left

  // Vertical edges 8-11 (spanning y from 0.20 to 0.80)
  { start: [0.10, 0.20], end: [0.10, 0.80] },   // Edge 8: front-left vertical
  { start: [0.40, 0.20], end: [0.40, 0.80] },   // Edge 9: front-right vertical
  { start: [0.60, 0.20], end: [0.60, 0.80] },   // Edge 10: back-right vertical
  { start: [0.90, 0.20], end: [0.90, 0.80] },   // Edge 11: back-left vertical
];

/**
 * Sample a single pixel from RGBA image data at coordinates (x, y).
 * Returns [r, g, b]. Clamps coordinates to valid range.
 */
export function samplePixel(
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
 * Sample 480 LED colors using edge-sampling strategy.
 *
 * For each of the 12 edges, linearly interpolate 40 sample points along
 * the edge's line segment, read the pixel color at each point, and write
 * to the output array.
 *
 * @param imageData - RGBA pixel data from getImageData()
 * @param width - Image width in pixels
 * @param height - Image height in pixels
 * @returns Uint8Array of 480*3 RGB bytes
 */
export function sampleEdges(
  imageData: Uint8ClampedArray,
  width: number,
  height: number,
): Uint8Array {
  const result = new Uint8Array(LED_COUNT * 3);

  for (let edge = 0; edge < EDGE_COUNT; edge++) {
    const line = EDGE_LINES[edge];
    const [sx, sy] = line.start;
    const [ex, ey] = line.end;

    for (let led = 0; led < LEDS_PER_EDGE; led++) {
      const t = led / (LEDS_PER_EDGE - 1);
      const nx = sx + (ex - sx) * t;
      const ny = sy + (ey - sy) * t;

      const px = nx * (width - 1);
      const py = ny * (height - 1);

      const [r, g, b] = samplePixel(imageData, width, height, px, py);

      const outIdx = (edge * LEDS_PER_EDGE + led) * 3;
      result[outIdx] = r;
      result[outIdx + 1] = g;
      result[outIdx + 2] = b;
    }
  }

  return result;
}
