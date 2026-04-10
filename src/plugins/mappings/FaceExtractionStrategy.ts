import type { MappingStrategy, FrameData } from '@/core/pipeline/types';
import { DEFAULT_FRAME_SIZE } from '@/core/constants';

/**
 * FaceExtractionStrategy — MappingStrategy that passes through direct LED data.
 *
 * When used with VideoPlugin (which handles face extraction in its Web Worker),
 * this strategy simply passes the pre-computed LED data through.
 *
 * The actual face-to-edge extraction logic lives in workers/faceExtraction.ts
 * and runs in the Web Worker for off-main-thread processing.
 *
 * VID-03: Face-to-edge extraction — maps face content then extracts edge pixels.
 */
export class FaceExtractionStrategy implements MappingStrategy {
  readonly id = 'face-extraction';

  private outputBuffer = new Uint8Array(DEFAULT_FRAME_SIZE);

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
