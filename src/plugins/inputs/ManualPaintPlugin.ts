import type { InputPlugin, FrameData, PluginContext } from '@/core/pipeline/types';
import { getEdgeLedIndices, getFaceEdgeIndices, LED_COUNT } from './cubeTopology';
import { BYTES_PER_LED } from '@/core/constants';

/**
 * ManualPaintPlugin — InputPlugin for direct LED painting on the 3D cube.
 *
 * Owns a persistent 224*3 RGB paint buffer. External callers use setPixel(),
 * setEdge(), setFaceEdges(), and fill() to modify the buffer. Each tick()
 * returns the current buffer as FrameData.
 *
 * The buffer is NOT reset between ticks — painted state persists until
 * explicitly cleared via fill(0,0,0).
 */
export class ManualPaintPlugin implements InputPlugin {
  readonly id = 'manual-paint';
  readonly name = 'Manual Paint';

  private readonly buffer = new Uint8Array(LED_COUNT * BYTES_PER_LED);

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
    if (index < 0 || index >= LED_COUNT) return;
    const off = index * BYTES_PER_LED;
    this.buffer[off] = r;
    this.buffer[off + 1] = g;
    this.buffer[off + 2] = b;
  }

  /**
   * Set all LEDs on an edge to the same color.
   */
  setEdge(edgeIndex: number, r: number, g: number, b: number): void {
    const indices = getEdgeLedIndices(edgeIndex);
    for (const i of indices) {
      this.setPixel(i, r, g, b);
    }
  }

  /**
   * Set all LEDs on all 4 edges of a face to the same color.
   */
  setFaceEdges(faceIndex: number, r: number, g: number, b: number): void {
    const indices = getFaceEdgeIndices(faceIndex);
    for (const i of indices) {
      this.setPixel(i, r, g, b);
    }
  }

  /**
   * Set all LEDs to the same color. Use fill(0,0,0) to clear.
   */
  fill(r: number, g: number, b: number): void {
    for (let i = 0; i < LED_COUNT; i++) {
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
