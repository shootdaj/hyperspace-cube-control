/**
 * VideoProcessorWorker — Web Worker for off-main-thread video frame processing.
 *
 * Receives ImageBitmap frames via postMessage, processes them using
 * OffscreenCanvas + getImageData, applies the requested mapping strategy,
 * and returns the LED color array as a transferable Uint8Array.
 *
 * This worker handles both video mapping (edge-sampling, face-extraction)
 * and camera motion detection (frame differencing).
 */

import { sampleEdges } from './edgeSampling';
import { extractFaceEdges } from './faceExtraction';
import { computeMotion, mapMotionToLeds } from './motionDetection';
import { DEFAULT_FRAME_SIZE } from '@/core/constants';
import type { WorkerRequest, WorkerResponse } from './videoWorkerTypes';

let canvas: OffscreenCanvas | null = null;
let ctx: OffscreenCanvasRenderingContext2D | null = null;
let previousFrameData: Uint8ClampedArray | null = null;

/**
 * Ensure the OffscreenCanvas is sized correctly.
 */
function ensureCanvas(width: number, height: number): void {
  if (!canvas || canvas.width !== width || canvas.height !== height) {
    canvas = new OffscreenCanvas(width, height);
    ctx = canvas.getContext('2d');
  }
}

/**
 * Draw an ImageBitmap to the canvas and return RGBA pixel data.
 */
function getPixelData(bitmap: ImageBitmap, width: number, height: number): ImageData {
  ensureCanvas(width, height);
  if (!ctx) throw new Error('Failed to get 2D context from OffscreenCanvas');

  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close(); // Release the bitmap resource
  return ctx.getImageData(0, 0, width, height);
}

/**
 * Process a video frame using the specified mapping strategy.
 */
function processFrame(
  bitmap: ImageBitmap,
  strategy: 'edge-sampling' | 'face-extraction',
  width: number,
  height: number,
): WorkerResponse {
  const imageData = getPixelData(bitmap, width, height);

  let leds: Uint8Array;
  if (strategy === 'edge-sampling') {
    leds = sampleEdges(imageData.data, width, height);
  } else {
    leds = extractFaceEdges(imageData.data, width, height);
  }

  return { type: 'frameResult', leds };
}

/**
 * Process a camera frame for motion detection.
 */
function processMotion(
  bitmap: ImageBitmap,
  sensitivity: number,
  width: number,
  height: number,
): WorkerResponse {
  const imageData = getPixelData(bitmap, width, height);
  const currentData = imageData.data;

  if (!previousFrameData) {
    // First frame — no previous to compare against
    previousFrameData = new Uint8ClampedArray(currentData);
    return {
      type: 'motionResult',
      leds: new Uint8Array(DEFAULT_FRAME_SIZE),
      motionLevel: 0,
    };
  }

  // Convert sensitivity (0-255) to threshold (higher sensitivity = lower threshold)
  const threshold = Math.max(1, 255 - sensitivity);
  const { motionMap, motionLevel } = computeMotion(
    currentData,
    previousFrameData,
    width,
    height,
    threshold,
  );

  const leds = mapMotionToLeds(motionMap, motionLevel, width, height);

  // Store current frame as previous for next comparison
  previousFrameData = new Uint8ClampedArray(currentData);

  return { type: 'motionResult', leds, motionLevel };
}

/**
 * Worker message handler.
 */
self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const msg = event.data;

  try {
    let response: WorkerResponse;

    switch (msg.type) {
      case 'processFrame':
        response = processFrame(msg.bitmap, msg.strategy, msg.width, msg.height);
        break;
      case 'processMotion':
        response = processMotion(msg.bitmap, msg.sensitivity, msg.width, msg.height);
        break;
      case 'configure':
        ensureCanvas(msg.canvasWidth, msg.canvasHeight);
        return; // No response needed for configure
      default:
        response = { type: 'error', message: `Unknown message type: ${(msg as { type: string }).type}` };
    }

    // Transfer the LED buffer for zero-copy
    if (response.type === 'frameResult' || response.type === 'motionResult') {
      (self as unknown as Worker).postMessage(response, [response.leds.buffer]);
    } else {
      (self as unknown as Worker).postMessage(response);
    }
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    const response: WorkerResponse = { type: 'error', message: errorMsg };
    (self as unknown as Worker).postMessage(response);
  }
};
