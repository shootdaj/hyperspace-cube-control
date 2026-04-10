import { describe, it, expect } from 'vitest';
import { computeLEDPositions, EDGE_COUNT, LED_COUNT } from '../cubeGeometry';
import { EDGE_LED_COUNTS, getEdgeStartIndex } from '@/core/constants';

describe('cubeGeometry', () => {
  it('TestCubeGeometry_Constants_CorrectValues', () => {
    expect(LED_COUNT).toBe(224);
    expect(EDGE_COUNT).toBe(12);
  });

  it('TestCubeGeometry_ComputeLEDPositions_Returns224Vectors', () => {
    const positions = computeLEDPositions();
    expect(positions).toHaveLength(224);
  });

  it('TestCubeGeometry_AllPositions_AreUnique', () => {
    const positions = computeLEDPositions();
    const keys = new Set(
      positions.map((p) => `${p.x.toFixed(6)},${p.y.toFixed(6)},${p.z.toFixed(6)}`),
    );
    expect(keys.size).toBe(224);
  });

  it('TestCubeGeometry_LED0_IsOnBottomFrontEdge', () => {
    const positions = computeLEDPositions();
    const led0 = positions[0];
    // LED 0 is on edge [0,1]: (-0.5,-0.5,-0.5) -> (+0.5,-0.5,-0.5)
    // t = (0 + 0.5) / 19 = 0.02631... (19 LEDs on edge 0)
    // x = -0.5 + 0.02631 * 1.0 = -0.47368
    expect(led0.x).toBeCloseTo(-0.5 + 0.5/19, 4);
    expect(led0.y).toBeCloseTo(-0.5, 4);
    expect(led0.z).toBeCloseTo(-0.5, 4);
  });

  it('TestCubeGeometry_FirstVerticalEdge_StartsAtCorrectIndex', () => {
    const positions = computeLEDPositions();
    // Edge 8 (first vertical edge [0,4]) starts at sum of LEDs on edges 0-7
    const edge8Start = getEdgeStartIndex(8); // 8 * 19 = 152
    const led = positions[edge8Start];
    // Edge [0,4]: (-0.5,-0.5,-0.5) -> (-0.5,+0.5,-0.5) at t=0.5/18
    const ledsOnEdge = EDGE_LED_COUNTS[8]; // 18
    expect(led.x).toBeCloseTo(-0.5, 4);
    expect(led.y).toBeCloseTo(-0.5 + 0.5/ledsOnEdge, 3);
    expect(led.z).toBeCloseTo(-0.5, 4);
  });

  it('TestCubeGeometry_AllPositions_WithinCubeBounds', () => {
    const positions = computeLEDPositions();
    for (const p of positions) {
      expect(p.x).toBeGreaterThanOrEqual(-0.5);
      expect(p.x).toBeLessThanOrEqual(0.5);
      expect(p.y).toBeGreaterThanOrEqual(-0.5);
      expect(p.y).toBeLessThanOrEqual(0.5);
      expect(p.z).toBeGreaterThanOrEqual(-0.5);
      expect(p.z).toBeLessThanOrEqual(0.5);
    }
  });
});
