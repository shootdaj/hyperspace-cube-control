import { describe, it, expect } from 'vitest';
import {
  EDGE_COUNT,
  LED_COUNT,
  FACE_EDGES,
  getEdgeIndex,
  getEdgeLedIndices,
  getEdgeFaces,
  getFaceEdgeIndices,
} from '../cubeTopology';
import { EDGE_LED_COUNTS, getEdgeStartIndex } from '@/core/constants';

describe('cubeTopology', () => {
  describe('constants', () => {
    it('TestCubeTopology_Constants_CorrectValues', () => {
      expect(LED_COUNT).toBe(224);
      expect(EDGE_COUNT).toBe(12);
    });

    it('TestCubeTopology_FaceEdges_Has6FacesWith4EdgesEach', () => {
      expect(FACE_EDGES).toHaveLength(6);
      for (const face of FACE_EDGES) {
        expect(face).toHaveLength(4);
      }
    });

    it('TestCubeTopology_FaceEdges_AllEdgeIndicesValid', () => {
      for (const face of FACE_EDGES) {
        for (const edgeIdx of face) {
          expect(edgeIdx).toBeGreaterThanOrEqual(0);
          expect(edgeIdx).toBeLessThan(12);
        }
      }
    });

    it('TestCubeTopology_FaceEdges_EachEdgeBelongsToExactly2Faces', () => {
      const edgeFaceCount = new Array(12).fill(0);
      for (const face of FACE_EDGES) {
        for (const edgeIdx of face) {
          edgeFaceCount[edgeIdx]++;
        }
      }
      for (let e = 0; e < 12; e++) {
        expect(edgeFaceCount[e]).toBe(2);
      }
    });

    it('TestCubeTopology_EdgeLedCounts_SumTo224', () => {
      let total = 0;
      for (const count of EDGE_LED_COUNTS) {
        total += count;
      }
      expect(total).toBe(224);
    });
  });

  describe('getEdgeIndex', () => {
    it('TestCubeTopology_GetEdgeIndex_FirstLed', () => {
      expect(getEdgeIndex(0)).toBe(0);
    });

    it('TestCubeTopology_GetEdgeIndex_LastLedOnFirstEdge', () => {
      // Edge 0 has 19 LEDs (indices 0-18)
      expect(getEdgeIndex(18)).toBe(0);
    });

    it('TestCubeTopology_GetEdgeIndex_FirstLedOnSecondEdge', () => {
      // Edge 1 starts at index 19
      expect(getEdgeIndex(19)).toBe(1);
    });

    it('TestCubeTopology_GetEdgeIndex_LastLed', () => {
      expect(getEdgeIndex(223)).toBe(11);
    });

    it('TestCubeTopology_GetEdgeIndex_MiddleLed', () => {
      // Edge 5 starts at 5*19=95, has 19 LEDs (indices 95-113)
      expect(getEdgeIndex(100)).toBe(5);
    });

    it('TestCubeTopology_GetEdgeIndex_NegativeIndex_Throws', () => {
      expect(() => getEdgeIndex(-1)).toThrow();
    });

    it('TestCubeTopology_GetEdgeIndex_OutOfRange_Throws', () => {
      expect(() => getEdgeIndex(224)).toThrow();
    });
  });

  describe('getEdgeLedIndices', () => {
    it('TestCubeTopology_GetEdgeLedIndices_Edge0', () => {
      const indices = getEdgeLedIndices(0);
      expect(indices).toHaveLength(19); // Edge 0 has 19 LEDs
      expect(indices[0]).toBe(0);
      expect(indices[18]).toBe(18);
    });

    it('TestCubeTopology_GetEdgeLedIndices_Edge11', () => {
      const indices = getEdgeLedIndices(11);
      expect(indices).toHaveLength(18); // Edge 11 (vertical) has 18 LEDs
      const start = getEdgeStartIndex(11);
      expect(indices[0]).toBe(start);
      expect(indices[17]).toBe(start + 17);
    });

    it('TestCubeTopology_GetEdgeLedIndices_Edge5', () => {
      const indices = getEdgeLedIndices(5);
      expect(indices).toHaveLength(19); // Edge 5 (top face) has 19 LEDs
      const start = getEdgeStartIndex(5);
      expect(indices[0]).toBe(start);
      expect(indices[18]).toBe(start + 18);
    });

    it('TestCubeTopology_GetEdgeLedIndices_NegativeEdge_Throws', () => {
      expect(() => getEdgeLedIndices(-1)).toThrow();
    });

    it('TestCubeTopology_GetEdgeLedIndices_OutOfRange_Throws', () => {
      expect(() => getEdgeLedIndices(12)).toThrow();
    });
  });

  describe('getEdgeFaces', () => {
    it('TestCubeTopology_GetEdgeFaces_Edge0_BottomAndFront', () => {
      const faces = getEdgeFaces(0);
      expect(faces).toHaveLength(2);
      expect(faces).toContain(0); // bottom
      expect(faces).toContain(2); // front
    });

    it('TestCubeTopology_GetEdgeFaces_Edge4_TopAndFront', () => {
      const faces = getEdgeFaces(4);
      expect(faces).toHaveLength(2);
      expect(faces).toContain(1); // top
      expect(faces).toContain(2); // front
    });

    it('TestCubeTopology_GetEdgeFaces_Edge9_FrontAndRight', () => {
      const faces = getEdgeFaces(9);
      expect(faces).toHaveLength(2);
      expect(faces).toContain(2); // front
      expect(faces).toContain(3); // right
    });

    it('TestCubeTopology_GetEdgeFaces_AllEdgesHave2Faces', () => {
      for (let e = 0; e < 12; e++) {
        expect(getEdgeFaces(e)).toHaveLength(2);
      }
    });

    it('TestCubeTopology_GetEdgeFaces_NegativeEdge_Throws', () => {
      expect(() => getEdgeFaces(-1)).toThrow();
    });

    it('TestCubeTopology_GetEdgeFaces_OutOfRange_Throws', () => {
      expect(() => getEdgeFaces(12)).toThrow();
    });
  });

  describe('getFaceEdgeIndices', () => {
    it('TestCubeTopology_GetFaceEdgeIndices_BottomFace', () => {
      // Bottom face = edges 0,1,2,3 (19 LEDs each = 76 LEDs)
      const indices = getFaceEdgeIndices(0);
      expect(indices).toHaveLength(76);
    });

    it('TestCubeTopology_GetFaceEdgeIndices_BottomFace_CorrectRange', () => {
      const indices = getFaceEdgeIndices(0);
      // Should contain LEDs from edges 0-3
      expect(indices).toContain(0);  // edge 0 start
      expect(indices).toContain(18); // edge 0 end
      expect(indices).toContain(19); // edge 1 start
      expect(indices).toContain(37); // edge 1 end
      expect(indices).toContain(38); // edge 2 start
      expect(indices).toContain(56); // edge 2 end
      expect(indices).toContain(57); // edge 3 start
      expect(indices).toContain(75); // edge 3 end
    });

    it('TestCubeTopology_GetFaceEdgeIndices_TopFace', () => {
      // Top face = edges 4,5,6,7 (19 LEDs each = 76 LEDs)
      const indices = getFaceEdgeIndices(1);
      expect(indices).toHaveLength(76);
      const edge4Start = getEdgeStartIndex(4); // 76
      const edge7End = getEdgeStartIndex(7) + EDGE_LED_COUNTS[7] - 1; // 151
      expect(indices).toContain(edge4Start);
      expect(indices).toContain(edge7End);
    });

    it('TestCubeTopology_GetFaceEdgeIndices_FrontFace_CorrectEdges', () => {
      // Front face = edges 0,4,8,9
      const indices = getFaceEdgeIndices(2);
      // Edges 0,4 have 19 LEDs, edges 8,9 have 18 LEDs = 74 total
      expect(indices).toHaveLength(74);
      expect(indices).toContain(0); // edge 0
      expect(indices).toContain(getEdgeStartIndex(4)); // edge 4
      expect(indices).toContain(getEdgeStartIndex(8)); // edge 8
      expect(indices).toContain(getEdgeStartIndex(9)); // edge 9
    });

    it('TestCubeTopology_GetFaceEdgeIndices_NegativeFace_Throws', () => {
      expect(() => getFaceEdgeIndices(-1)).toThrow();
    });

    it('TestCubeTopology_GetFaceEdgeIndices_OutOfRange_Throws', () => {
      expect(() => getFaceEdgeIndices(6)).toThrow();
    });

    it('TestCubeTopology_GetFaceEdgeIndices_NoDuplicates', () => {
      for (let f = 0; f < 6; f++) {
        const indices = getFaceEdgeIndices(f);
        const unique = new Set(indices);
        expect(unique.size).toBe(indices.length);
      }
    });
  });
});
