/**
 * Motion detection via frame differencing.
 *
 * Compares current frame with previous frame pixel-by-pixel.
 * Pixels with difference above threshold are considered "motion".
 * Motion intensity maps to LED brightness.
 *
 * Pure functions, no DOM/Worker dependency — fully unit-testable.
 */

const LEDS_PER_EDGE = 40;
const EDGE_COUNT = 12;
const LED_COUNT = EDGE_COUNT * LEDS_PER_EDGE; // 480

/**
 * Compute motion map from two consecutive frames.
 *
 * For each pixel, computes grayscale difference between current and previous.
 * Pixels exceeding threshold are marked as motion with intensity proportional
 * to the difference magnitude.
 *
 * @param current - Current frame RGBA data
 * @param previous - Previous frame RGBA data
 * @param width - Frame width in pixels
 * @param height - Frame height in pixels
 * @param threshold - Motion threshold (0-255). Default 30.
 * @returns motionMap (grayscale motion intensity per pixel) and motionLevel (0-1 fraction of pixels with motion)
 */
export function computeMotion(
  current: Uint8ClampedArray,
  previous: Uint8ClampedArray,
  width: number,
  height: number,
  threshold: number = 30,
): { motionMap: Uint8Array; motionLevel: number } {
  const pixelCount = width * height;
  const motionMap = new Uint8Array(pixelCount);
  let motionPixels = 0;

  for (let i = 0; i < pixelCount; i++) {
    const off = i * 4;
    // Grayscale: simple average of RGB channels
    const gray1 = (current[off] + current[off + 1] + current[off + 2]) / 3;
    const gray2 = (previous[off] + previous[off + 1] + previous[off + 2]) / 3;
    const diff = Math.abs(gray1 - gray2);

    if (diff > threshold) {
      motionMap[i] = Math.min(255, Math.round(diff * 2));
      motionPixels++;
    }
    // else motionMap[i] stays 0
  }

  return {
    motionMap,
    motionLevel: pixelCount > 0 ? motionPixels / pixelCount : 0,
  };
}

/**
 * Map motion data to 480 LED colors.
 *
 * Divides the motion map into a grid matching the cube's edge layout,
 * then maps average motion intensity in each region to LED brightness.
 *
 * Motion produces white-to-cyan-to-blue gradient based on intensity.
 *
 * @param motionMap - Grayscale motion intensity per pixel (from computeMotion)
 * @param motionLevel - Overall motion level (0-1)
 * @param width - Frame width
 * @param height - Frame height
 * @returns Uint8Array of 480*3 RGB bytes
 */
export function mapMotionToLeds(
  motionMap: Uint8Array,
  _motionLevel: number,
  width: number,
  height: number,
): Uint8Array {
  const result = new Uint8Array(LED_COUNT * 3);

  // Divide frame into 12 horizontal strips (one per edge)
  // Then sample 40 positions within each strip
  for (let edge = 0; edge < EDGE_COUNT; edge++) {
    const stripTop = Math.floor((edge / EDGE_COUNT) * height);
    const stripBottom = Math.floor(((edge + 1) / EDGE_COUNT) * height);

    for (let led = 0; led < LEDS_PER_EDGE; led++) {
      const colStart = Math.floor((led / LEDS_PER_EDGE) * width);
      const colEnd = Math.floor(((led + 1) / LEDS_PER_EDGE) * width);

      // Average motion intensity in this cell
      let sum = 0;
      let count = 0;
      for (let y = stripTop; y < stripBottom; y++) {
        for (let x = colStart; x < colEnd; x++) {
          sum += motionMap[y * width + x];
          count++;
        }
      }
      const intensity = count > 0 ? sum / count / 255 : 0;

      // Color mapping: motion intensity drives brightness
      // Hue shifts from cyan (low motion) to white (high motion)
      const brightness = Math.pow(intensity, 1.5); // Gamma for perceptual
      const r = Math.round(brightness * 180);
      const g = Math.round(brightness * 220);
      const b = Math.round(brightness * 255);

      const outIdx = (edge * LEDS_PER_EDGE + led) * 3;
      result[outIdx] = r;
      result[outIdx + 1] = g;
      result[outIdx + 2] = b;
    }
  }

  return result;
}
