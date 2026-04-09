/**
 * Message types for communication between main thread and VideoProcessorWorker.
 *
 * Protocol:
 * - Main → Worker: WorkerRequest (processFrame, processMotion, configure)
 * - Worker → Main: WorkerResponse (frameResult, motionResult, error)
 *
 * Transferable objects:
 * - ImageBitmap (main → worker): zero-copy frame transfer
 * - Uint8Array.buffer (worker → main): zero-copy LED result transfer
 */

/** Mapping strategy identifier */
export type MappingStrategyType = 'edge-sampling' | 'face-extraction';

/** Main thread → Worker messages */
export type WorkerRequest =
  | {
      type: 'processFrame';
      bitmap: ImageBitmap;
      strategy: MappingStrategyType;
      width: number;
      height: number;
    }
  | {
      type: 'processMotion';
      bitmap: ImageBitmap;
      sensitivity: number;
      width: number;
      height: number;
    }
  | {
      type: 'configure';
      canvasWidth: number;
      canvasHeight: number;
    };

/** Worker → Main thread messages */
export type WorkerResponse =
  | {
      type: 'frameResult';
      leds: Uint8Array;
    }
  | {
      type: 'motionResult';
      leds: Uint8Array;
      motionLevel: number;
    }
  | {
      type: 'error';
      message: string;
    };
