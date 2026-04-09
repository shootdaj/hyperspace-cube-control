import { describe, it, expect } from 'vitest';
import { computeLEDPositions, LEDS_PER_EDGE, EDGE_COUNT } from '../cubeGeometry';

describe('cubeGeometry', () => {
  it('TestCubeGeometry_Constants_CorrectValues', () => {
    expect(LEDS_PER_EDGE).toBe(40);
    expect(EDGE_COUNT).toBe(12);
  });

  it('TestCubeGeometry_ComputeLEDPositions_Returns480Vectors', () => {
    const positions = computeLEDPositions();
    expect(positions).toHaveLength(480);
  });

  it('TestCubeGeometry_AllPositions_AreUnique', () => {
    const positions = computeLEDPositions();
    const keys = new Set(
      positions.map((p) => `${p.x.toFixed(6)},${p.y.toFixed(6)},${p.z.toFixed(6)}`),
    );
    expect(keys.size).toBe(480);
  });

  it('TestCubeGeometry_LED0_IsOnBottomFrontEdge', () => {
    const positions = computeLEDPositions();
    const led0 = positions[0];
    // LED 0 is on edge [0,1]: (-0.5,-0.5,-0.5) -> (+0.5,-0.5,-0.5) at t=0.0125
    // t = (0 + 0.5) / 40 = 0.0125
    // x = -0.5 + 0.0125 * 1.0 = -0.4875
    expect(led0.x).toBeCloseTo(-0.4875, 4);
    expect(led0.y).toBeCloseTo(-0.5, 4);
    expect(led0.z).toBeCloseTo(-0.5, 4);
  });

  it('TestCubeGeometry_LED320_StartsFirstVerticalEdge', () => {
    const positions = computeLEDPositions();
    // Edge 8 (first vertical edge [0,4]) starts at LED index 8 * 40 = 320
    // Edge [0,4]: (-0.5,-0.5,-0.5) -> (-0.5,+0.5,-0.5) at t=0.0125
    // y = -0.5 + 0.0125 * 1.0 = -0.4875
    const led320 = positions[320];
    expect(led320.x).toBeCloseTo(-0.5, 4);
    expect(led320.y).toBeCloseTo(-0.4875, 4);
    expect(led320.z).toBeCloseTo(-0.5, 4);
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
