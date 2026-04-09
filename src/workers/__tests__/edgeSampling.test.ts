import { describe, it, expect } from 'vitest';
import { samplePixel, sampleEdges, EDGE_LINES } from '../edgeSampling';

/**
 * Create a test RGBA image data buffer.
 * Each pixel's color is determined by its position.
 */
function createTestImageData(width: number, height: number): Uint8ClampedArray {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const offset = (y * width + x) * 4;
      data[offset] = x % 256;       // R: x position
      data[offset + 1] = y % 256;   // G: y position
      data[offset + 2] = (x + y) % 256; // B: diagonal
      data[offset + 3] = 255;       // A: opaque
    }
  }
  return data;
}

/**
 * Create a solid-color test image.
 */
function createSolidImage(width: number, height: number, r: number, g: number, b: number): Uint8ClampedArray {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = r;
    data[i + 1] = g;
    data[i + 2] = b;
    data[i + 3] = 255;
  }
  return data;
}

describe('edgeSampling', () => {
  describe('samplePixel', () => {
    it('TestSamplePixel_ReturnsCorrectColor', () => {
      const data = createTestImageData(100, 100);
      const [r, g, b] = samplePixel(data, 100, 100, 50, 30);
      expect(r).toBe(50);
      expect(g).toBe(30);
      expect(b).toBe(80); // (50 + 30) % 256
    });

    it('TestSamplePixel_ClampsOutOfRange', () => {
      const data = createTestImageData(10, 10);
      // Negative coordinates should clamp to 0,0
      const [r, g, b] = samplePixel(data, 10, 10, -5, -5);
      expect(r).toBe(0);
      expect(g).toBe(0);
      expect(b).toBe(0);
    });

    it('TestSamplePixel_ClampsOverflow', () => {
      const data = createTestImageData(10, 10);
      // Coordinates past image boundary should clamp
      const [r, g, b] = samplePixel(data, 10, 10, 100, 100);
      expect(r).toBe(9);
      expect(g).toBe(9);
      expect(b).toBe(18); // (9 + 9) % 256
    });
  });

  describe('EDGE_LINES', () => {
    it('TestEdgeLines_Has12Edges', () => {
      expect(EDGE_LINES).toHaveLength(12);
    });

    it('TestEdgeLines_AllCoordsNormalized', () => {
      for (const line of EDGE_LINES) {
        expect(line.start[0]).toBeGreaterThanOrEqual(0);
        expect(line.start[0]).toBeLessThanOrEqual(1);
        expect(line.start[1]).toBeGreaterThanOrEqual(0);
        expect(line.start[1]).toBeLessThanOrEqual(1);
        expect(line.end[0]).toBeGreaterThanOrEqual(0);
        expect(line.end[0]).toBeLessThanOrEqual(1);
        expect(line.end[1]).toBeGreaterThanOrEqual(0);
        expect(line.end[1]).toBeLessThanOrEqual(1);
      }
    });
  });

  describe('sampleEdges', () => {
    it('TestSampleEdges_Returns480x3Bytes', () => {
      const data = createTestImageData(320, 240);
      const result = sampleEdges(data, 320, 240);
      expect(result).toBeInstanceOf(Uint8Array);
      expect(result.length).toBe(480 * 3);
    });

    it('TestSampleEdges_SolidImageProducesUniformColor', () => {
      const data = createSolidImage(100, 100, 128, 64, 32);
      const result = sampleEdges(data, 100, 100);

      // All samples should be the same solid color
      for (let i = 0; i < result.length; i += 3) {
        expect(result[i]).toBe(128);
        expect(result[i + 1]).toBe(64);
        expect(result[i + 2]).toBe(32);
      }
    });

    it('TestSampleEdges_NonBlackForColoredImage', () => {
      const data = createTestImageData(320, 240);
      const result = sampleEdges(data, 320, 240);

      // Should have some non-zero pixels
      let hasNonZero = false;
      for (let i = 0; i < result.length; i++) {
        if (result[i] > 0) { hasNonZero = true; break; }
      }
      expect(hasNonZero).toBe(true);
    });

    it('TestSampleEdges_DifferentEdgesCanHaveDifferentColors', () => {
      // Create an image with distinct regions
      const data = createTestImageData(320, 240);
      const result = sampleEdges(data, 320, 240);

      // Edge 0 (bottom, y=0.85) and Edge 4 (top, y=0.15) should sample different y positions
      const edge0Start = 0;
      const edge4Start = 4 * 40 * 3;

      // They should differ because they sample from different y positions
      const edge0G = result[edge0Start + 1]; // G channel = y position
      const edge4G = result[edge4Start + 1];
      expect(edge0G).not.toBe(edge4G);
    });

    it('TestSampleEdges_BlackImageReturnsAllBlack', () => {
      const data = createSolidImage(100, 100, 0, 0, 0);
      const result = sampleEdges(data, 100, 100);

      for (let i = 0; i < result.length; i++) {
        expect(result[i]).toBe(0);
      }
    });
  });
});
