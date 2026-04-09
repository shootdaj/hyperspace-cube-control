import { describe, it, expect } from 'vitest';
import { computeMotion, mapMotionToLeds } from '../motionDetection';

/**
 * Create RGBA frame data with a solid grayscale color.
 */
function createSolidFrame(width: number, height: number, gray: number): Uint8ClampedArray {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = gray;
    data[i + 1] = gray;
    data[i + 2] = gray;
    data[i + 3] = 255;
  }
  return data;
}

/**
 * Create a frame with a bright rectangle in the center (simulates movement).
 */
function createFrameWithMotion(
  width: number,
  height: number,
  baseGray: number,
  motionGray: number,
  motionX: number,
  motionY: number,
  motionW: number,
  motionH: number,
): Uint8ClampedArray {
  const data = createSolidFrame(width, height, baseGray);
  for (let y = motionY; y < motionY + motionH && y < height; y++) {
    for (let x = motionX; x < motionX + motionW && x < width; x++) {
      const off = (y * width + x) * 4;
      data[off] = motionGray;
      data[off + 1] = motionGray;
      data[off + 2] = motionGray;
    }
  }
  return data;
}

describe('motionDetection', () => {
  describe('computeMotion', () => {
    it('TestComputeMotion_IdenticalFramesNoMotion', () => {
      const frame = createSolidFrame(10, 10, 128);
      const { motionMap, motionLevel } = computeMotion(frame, frame, 10, 10, 30);

      expect(motionLevel).toBe(0);
      for (let i = 0; i < motionMap.length; i++) {
        expect(motionMap[i]).toBe(0);
      }
    });

    it('TestComputeMotion_CompletelyDifferentFramesMaxMotion', () => {
      const frame1 = createSolidFrame(10, 10, 0);
      const frame2 = createSolidFrame(10, 10, 255);
      const { motionLevel } = computeMotion(frame1, frame2, 10, 10, 30);

      // All pixels should have motion
      expect(motionLevel).toBe(1);
    });

    it('TestComputeMotion_PartialMotion', () => {
      const width = 10;
      const height = 10;
      const frame1 = createSolidFrame(width, height, 50);
      // Frame 2 has a bright block in the top-left quarter
      const frame2 = createFrameWithMotion(width, height, 50, 200, 0, 0, 5, 5);

      const { motionLevel, motionMap } = computeMotion(frame1, frame2, width, height, 30);

      // 25 out of 100 pixels should have motion
      expect(motionLevel).toBeCloseTo(0.25, 1);

      // Motion pixels should be in the top-left
      expect(motionMap[0]).toBeGreaterThan(0);
      // Non-motion pixels should be 0
      expect(motionMap[99]).toBe(0);
    });

    it('TestComputeMotion_BelowThresholdNoMotion', () => {
      const frame1 = createSolidFrame(10, 10, 100);
      const frame2 = createSolidFrame(10, 10, 110); // Only 10 difference
      const { motionLevel } = computeMotion(frame1, frame2, 10, 10, 30); // Threshold 30

      expect(motionLevel).toBe(0);
    });

    it('TestComputeMotion_AboveThresholdDetectsMotion', () => {
      const frame1 = createSolidFrame(10, 10, 100);
      const frame2 = createSolidFrame(10, 10, 140); // 40 difference
      const { motionLevel } = computeMotion(frame1, frame2, 10, 10, 30);

      expect(motionLevel).toBe(1);
    });

    it('TestComputeMotion_MotionMapHasCorrectSize', () => {
      const { motionMap } = computeMotion(
        createSolidFrame(20, 15, 0),
        createSolidFrame(20, 15, 100),
        20,
        15,
        30,
      );
      expect(motionMap.length).toBe(20 * 15);
    });

    it('TestComputeMotion_ZeroSizeImageReturnsZero', () => {
      const empty = new Uint8ClampedArray(0);
      const { motionLevel, motionMap } = computeMotion(empty, empty, 0, 0, 30);
      expect(motionLevel).toBe(0);
      expect(motionMap.length).toBe(0);
    });
  });

  describe('mapMotionToLeds', () => {
    it('TestMapMotionToLeds_Returns480x3Bytes', () => {
      const motionMap = new Uint8Array(100);
      const result = mapMotionToLeds(motionMap, 0.5, 10, 10);
      expect(result).toBeInstanceOf(Uint8Array);
      expect(result.length).toBe(480 * 3);
    });

    it('TestMapMotionToLeds_NoMotionAllBlack', () => {
      const motionMap = new Uint8Array(100); // All zeros
      const result = mapMotionToLeds(motionMap, 0, 10, 10);

      for (let i = 0; i < result.length; i++) {
        expect(result[i]).toBe(0);
      }
    });

    it('TestMapMotionToLeds_HighMotionProducesNonZeroLeds', () => {
      const motionMap = new Uint8Array(100);
      motionMap.fill(255); // Full motion everywhere
      const result = mapMotionToLeds(motionMap, 1.0, 10, 10);

      let hasNonZero = false;
      for (let i = 0; i < result.length; i++) {
        if (result[i] > 0) { hasNonZero = true; break; }
      }
      expect(hasNonZero).toBe(true);
    });

    it('TestMapMotionToLeds_PartialMotionOnlySomeLeds', () => {
      const width = 40;
      const height = 12;
      const motionMap = new Uint8Array(width * height);
      // Only set motion in the first row
      for (let x = 0; x < width; x++) {
        motionMap[x] = 200;
      }

      const result = mapMotionToLeds(motionMap, 0.08, width, height);

      // First edge (row 0) should have non-zero LEDs
      let firstEdgeHasColor = false;
      for (let i = 0; i < 40 * 3; i++) {
        if (result[i] > 0) { firstEdgeHasColor = true; break; }
      }
      expect(firstEdgeHasColor).toBe(true);

      // Last edge (row 11) should be mostly black
      let lastEdgeSum = 0;
      for (let i = 11 * 40 * 3; i < 12 * 40 * 3; i++) {
        lastEdgeSum += result[i];
      }
      expect(lastEdgeSum).toBe(0);
    });
  });
});
