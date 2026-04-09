import type { MappingStrategy, FrameData } from '@/core/pipeline/types';

/**
 * EdgeSamplingStrategy — MappingStrategy that passes through direct LED data.
 *
 * When used with VideoPlugin (which handles sampling in its Web Worker),
 * this strategy simply passes the pre-computed LED data through.
 *
 * The actual edge sampling logic lives in workers/edgeSampling.ts and
 * runs in the Web Worker for off-main-thread processing.
 *
 * VID-02: Edge sampling strategy — samples pixel colors along 12 edge positions.
 */
export class EdgeSamplingStrategy implements MappingStrategy {
  readonly id = 'edge-sampling';

  private outputBuffer = new Uint8Array(480 * 3);

  map(frame: FrameData, ledCount: number): Uint8Array {
    if (this.outputBuffer.length !== ledCount * 3) {
      this.outputBuffer = new Uint8Array(ledCount * 3);
    }

    if (frame.type === 'direct' && frame.leds) {
      // LED data is pre-computed by the worker — pass through
      this.outputBuffer.set(frame.leds);
      return this.outputBuffer;
    }

    // No data — return black
    this.outputBuffer.fill(0);
    return this.outputBuffer;
  }
}
