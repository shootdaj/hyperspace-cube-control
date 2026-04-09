import { describe, it, expect } from 'vitest';
import {
  LEDS_PER_EDGE,
  EDGE_COUNT,
  FACE_EDGES,
  getEdgeIndex,
  getEdgeLedIndices,
  getEdgeFaces,
  getFaceEdgeIndices,
} from '../cubeTopology';

describe('cubeTopology', () => {
  describe('constants', () => {
    it('TestCubeTopology_Constants_CorrectValues', () => {
      expect(LEDS_PER_EDGE).toBe(40);
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
  });

  describe('getEdgeIndex', () => {
    it('TestCubeTopology_GetEdgeIndex_FirstLed', () => {
      expect(getEdgeIndex(0)).toBe(0);
    });

    it('TestCubeTopology_GetEdgeIndex_LastLedOnFirstEdge', () => {
      expect(getEdgeIndex(39)).toBe(0);
    });

    it('TestCubeTopology_GetEdgeIndex_FirstLedOnSecondEdge', () => {
      expect(getEdgeIndex(40)).toBe(1);
    });

    it('TestCubeTopology_GetEdgeIndex_LastLed', () => {
      expect(getEdgeIndex(479)).toBe(11);
    });

    it('TestCubeTopology_GetEdgeIndex_MiddleLed', () => {
      // LED 200 = edge 5 (200/40 = 5)
      expect(getEdgeIndex(200)).toBe(5);
    });

    it('TestCubeTopology_GetEdgeIndex_NegativeIndex_Throws', () => {
      expect(() => getEdgeIndex(-1)).toThrow();
    });

    it('TestCubeTopology_GetEdgeIndex_OutOfRange_Throws', () => {
      expect(() => getEdgeIndex(480)).toThrow();
    });
  });

  describe('getEdgeLedIndices', () => {
    it('TestCubeTopology_GetEdgeLedIndices_Edge0', () => {
      const indices = getEdgeLedIndices(0);
      expect(indices).toHaveLength(40);
      expect(indices[0]).toBe(0);
      expect(indices[39]).toBe(39);
    });

    it('TestCubeTopology_GetEdgeLedIndices_Edge11', () => {
      const indices = getEdgeLedIndices(11);
      expect(indices).toHaveLength(40);
      expect(indices[0]).toBe(440);
      expect(indices[39]).toBe(479);
    });

    it('TestCubeTopology_GetEdgeLedIndices_Edge5', () => {
      const indices = getEdgeLedIndices(5);
      expect(indices).toHaveLength(40);
      expect(indices[0]).toBe(200);
      expect(indices[39]).toBe(239);
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
      // Edge 0 is in bottom face (index 0) and front face (index 2)
      const faces = getEdgeFaces(0);
      expect(faces).toHaveLength(2);
      expect(faces).toContain(0); // bottom
      expect(faces).toContain(2); // front
    });

    it('TestCubeTopology_GetEdgeFaces_Edge4_TopAndFront', () => {
      // Edge 4 is in top face (index 1) and front face (index 2)
      const faces = getEdgeFaces(4);
      expect(faces).toHaveLength(2);
      expect(faces).toContain(1); // top
      expect(faces).toContain(2); // front
    });

    it('TestCubeTopology_GetEdgeFaces_Edge9_FrontAndRight', () => {
      // Edge 9 is in front face (index 2) and right face (index 3)
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
    it('TestCubeTopology_GetFaceEdgeIndices_BottomFace_160Leds', () => {
      // Bottom face = edges 0,1,2,3 = 160 LEDs
      const indices = getFaceEdgeIndices(0);
      expect(indices).toHaveLength(160);
    });

    it('TestCubeTopology_GetFaceEdgeIndices_BottomFace_CorrectRange', () => {
      const indices = getFaceEdgeIndices(0);
      // Should contain LEDs 0-159 (edges 0-3, each 40 LEDs)
      expect(indices).toContain(0);   // edge 0 start
      expect(indices).toContain(39);  // edge 0 end
      expect(indices).toContain(40);  // edge 1 start
      expect(indices).toContain(79);  // edge 1 end
      expect(indices).toContain(80);  // edge 2 start
      expect(indices).toContain(119); // edge 2 end
      expect(indices).toContain(120); // edge 3 start
      expect(indices).toContain(159); // edge 3 end
    });

    it('TestCubeTopology_GetFaceEdgeIndices_TopFace_160Leds', () => {
      // Top face = edges 4,5,6,7
      const indices = getFaceEdgeIndices(1);
      expect(indices).toHaveLength(160);
      expect(indices).toContain(160); // edge 4 start
      expect(indices).toContain(319); // edge 7 end
    });

    it('TestCubeTopology_GetFaceEdgeIndices_FrontFace_CorrectEdges', () => {
      // Front face = edges 0,4,8,9
      const indices = getFaceEdgeIndices(2);
      expect(indices).toHaveLength(160);
      expect(indices).toContain(0);   // edge 0
      expect(indices).toContain(160); // edge 4
      expect(indices).toContain(320); // edge 8
      expect(indices).toContain(360); // edge 9
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
