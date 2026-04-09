import type { InputPlugin, FrameData, PluginContext } from '@/core/pipeline/types';
import { getEdgeLedIndices, getFaceEdgeIndices } from './cubeTopology';

/**
 * ManualPaintPlugin — InputPlugin for direct LED painting on the 3D cube.
 *
 * Owns a persistent 480*3 RGB paint buffer. External callers use setPixel(),
 * setEdge(), setFaceEdges(), and fill() to modify the buffer. Each tick()
 * returns the current buffer as FrameData.
 *
 * The buffer is NOT reset between ticks — painted state persists until
 * explicitly cleared via fill(0,0,0).
 */
export class ManualPaintPlugin implements InputPlugin {
  readonly id = 'manual-paint';
  readonly name = 'Manual Paint';

  private readonly buffer = new Uint8Array(480 * 3);

  async initialize(_ctx: PluginContext): Promise<void> {
    // No async setup needed for manual paint
  }

  /**
   * Returns the current paint buffer every tick.
   * Paint is persistent — always returns data regardless of delta.
   */
  tick(_deltaMs: number): FrameData | null {
    return { type: 'direct', leds: this.buffer };
  }

  /**
   * Set a single LED color. Out-of-range indices are silently ignored.
   */
  setPixel(index: number, r: number, g: number, b: number): void {
    if (index < 0 || index >= 480) return;
    const off = index * 3;
    this.buffer[off] = r;
    this.buffer[off + 1] = g;
    this.buffer[off + 2] = b;
  }

  /**
   * Set all 40 LEDs on an edge to the same color.
   */
  setEdge(edgeIndex: number, r: number, g: number, b: number): void {
    const indices = getEdgeLedIndices(edgeIndex);
    for (const i of indices) {
      this.setPixel(i, r, g, b);
    }
  }

  /**
   * Set all LEDs on all 4 edges of a face to the same color (160 LEDs).
   */
  setFaceEdges(faceIndex: number, r: number, g: number, b: number): void {
    const indices = getFaceEdgeIndices(faceIndex);
    for (const i of indices) {
      this.setPixel(i, r, g, b);
    }
  }

  /**
   * Set all 480 LEDs to the same color. Use fill(0,0,0) to clear.
   */
  fill(r: number, g: number, b: number): void {
    for (let i = 0; i < 480; i++) {
      this.setPixel(i, r, g, b);
    }
  }

  /**
   * Direct access to the underlying buffer.
   * Used by CubeMesh to copy paint state to ledStateProxy.
   */
  getBuffer(): Uint8Array {
    return this.buffer;
  }

  destroy(): void {
    // Nothing to clean up
  }
}
