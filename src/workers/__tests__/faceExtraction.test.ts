import { describe, it, expect } from 'vitest';
import {
  extractFaceEdges,
  sampleBorder,
  FACE_REGIONS,
  EDGE_BORDER_MAPPINGS,
} from '../faceExtraction';

/**
 * Create a test RGBA image with position-based colors.
 */
function createTestImageData(width: number, height: number): Uint8ClampedArray {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const offset = (y * width + x) * 4;
      data[offset] = x % 256;
      data[offset + 1] = y % 256;
      data[offset + 2] = (x + y) % 256;
      data[offset + 3] = 255;
    }
  }
  return data;
}

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

describe('faceExtraction', () => {
  describe('FACE_REGIONS', () => {
    it('TestFaceRegions_Has6Faces', () => {
      expect(FACE_REGIONS).toHaveLength(6);
    });

    it('TestFaceRegions_AllNormalized', () => {
      for (const region of FACE_REGIONS) {
        expect(region.x).toBeGreaterThanOrEqual(0);
        expect(region.x + region.width).toBeLessThanOrEqual(1.001); // allow tiny float error
        expect(region.y).toBeGreaterThanOrEqual(0);
        expect(region.y + region.height).toBeLessThanOrEqual(1.001);
      }
    });
  });

  describe('EDGE_BORDER_MAPPINGS', () => {
    it('TestEdgeBorderMappings_CoversAll12Edges', () => {
      const edgesCovered = new Set(EDGE_BORDER_MAPPINGS.map((m) => m.edgeIndex));
      expect(edgesCovered.size).toBe(12);
      for (let i = 0; i < 12; i++) {
        expect(edgesCovered.has(i)).toBe(true);
      }
    });

    it('TestEdgeBorderMappings_FaceIndicesValid', () => {
      for (const m of EDGE_BORDER_MAPPINGS) {
        expect(m.faceIndex).toBeGreaterThanOrEqual(0);
        expect(m.faceIndex).toBeLessThan(6);
      }
    });
  });

  describe('sampleBorder', () => {
    it('TestSampleBorder_ReturnsDefaultSamples', () => {
      const data = createTestImageData(300, 200);
      const samples = sampleBorder(data, 300, 200, FACE_REGIONS[0], 'top');
      expect(samples).toHaveLength(19); // default sampleCount
    });

    it('TestSampleBorder_EachSampleHas3Components', () => {
      const data = createTestImageData(300, 200);
      const samples = sampleBorder(data, 300, 200, FACE_REGIONS[0], 'left');
      for (const [r, g, b] of samples) {
        expect(typeof r).toBe('number');
        expect(typeof g).toBe('number');
        expect(typeof b).toBe('number');
      }
    });

    it('TestSampleBorder_TopBorderHasConstantY', () => {
      const data = createTestImageData(300, 200);
      const samples = sampleBorder(data, 300, 200, FACE_REGIONS[0], 'top');
      // Top border of face 0: y=0 → all green values should be 0
      for (const [, g] of samples) {
        expect(g).toBe(0); // y coordinate = 0 for top of frame
      }
    });

    it('TestSampleBorder_LeftBorderHasConstantX', () => {
      const data = createTestImageData(300, 200);
      const samples = sampleBorder(data, 300, 200, FACE_REGIONS[0], 'left');
      // Left border of face 0: x=0 → all red values should be 0
      for (const [r] of samples) {
        expect(r).toBe(0);
      }
    });
  });

  describe('extractFaceEdges', () => {
    it('TestExtractFaceEdges_Returns224x3Bytes', () => {
      const data = createTestImageData(300, 200);
      const result = extractFaceEdges(data, 300, 200);
      expect(result).toBeInstanceOf(Uint8Array);
      expect(result.length).toBe(224 * 3);
    });

    it('TestExtractFaceEdges_SolidImageProducesUniformColor', () => {
      const data = createSolidImage(100, 100, 200, 100, 50);
      const result = extractFaceEdges(data, 100, 100);

      for (let i = 0; i < result.length; i += 3) {
        expect(result[i]).toBe(200);
        expect(result[i + 1]).toBe(100);
        expect(result[i + 2]).toBe(50);
      }
    });

    it('TestExtractFaceEdges_BlackImageReturnsAllBlack', () => {
      const data = createSolidImage(100, 100, 0, 0, 0);
      const result = extractFaceEdges(data, 100, 100);

      for (let i = 0; i < result.length; i++) {
        expect(result[i]).toBe(0);
      }
    });

    it('TestExtractFaceEdges_DifferentEdgesFromDifferentFaces', () => {
      const data = createTestImageData(300, 200);
      const result = extractFaceEdges(data, 300, 200);

      // Edge 0 (face 0, top) and Edge 4 (face 1, top) should sample from different face regions
      const edge0Start = 0;
      const edge4Start = 4 * 40 * 3;

      // They map to different face regions, so should have different colors
      // (unless they happen to be at the same pixel, which is unlikely)
      let anyDiff = false;
      for (let i = 0; i < 40 * 3; i++) {
        if (result[edge0Start + i] !== result[edge4Start + i]) {
          anyDiff = true;
          break;
        }
      }
      expect(anyDiff).toBe(true);
    });

    it('TestExtractFaceEdges_HasNonZeroValues', () => {
      const data = createTestImageData(300, 200);
      const result = extractFaceEdges(data, 300, 200);

      let hasNonZero = false;
      for (let i = 0; i < result.length; i++) {
        if (result[i] > 0) { hasNonZero = true; break; }
      }
      expect(hasNonZero).toBe(true);
    });
  });
});
