import type { InputPlugin, FrameData, PluginContext } from '@/core/pipeline/types';
import type { WorkerRequest, WorkerResponse } from '@/workers/videoWorkerTypes';
import { cameraStore } from '@/stores/cameraStore';
import { DEFAULT_FRAME_SIZE } from '@/core/constants';

/**
 * CameraPlugin — InputPlugin for webcam motion-reactive LED output.
 *
 * Uses getUserMedia to capture webcam video, sends frames to a Web Worker
 * for motion detection via frame differencing, and returns the resulting
 * LED colors as FrameData.
 *
 * Motion detection: compares consecutive frames, pixels with difference
 * above the sensitivity threshold produce LED light output.
 *
 * Camera permissions are handled gracefully — denied permissions show
 * a clear UI prompt instead of silently failing (CAM-05).
 */
export class CameraPlugin implements InputPlugin {
  readonly id = 'camera-input';
  readonly name = 'Camera Input';

  private worker: Worker | null = null;
  private video: HTMLVideoElement | null = null;
  private stream: MediaStream | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private latestLeds: Uint8Array = new Uint8Array(DEFAULT_FRAME_SIZE);
  private latestMotionLevel = 0;
  private pendingFrame = false;
  private sensitivity = 128;
  private processWidth = 160;  // Smaller for faster motion detection
  private processHeight = 120;

  /** Optional injected worker for testing */
  private injectedWorker: Worker | null;

  constructor(worker?: Worker) {
    this.injectedWorker = worker ?? null;
  }

  async initialize(_ctx: PluginContext): Promise<void> {
    // Guard: skip if already initialized (idempotent)
    if (this.worker) return;

    this.worker = this.injectedWorker ?? new Worker(
      new URL('@/workers/VideoProcessorWorker.ts', import.meta.url),
      { type: 'module' },
    );

    this.worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      this.handleWorkerResponse(event.data);
    };

    this.worker.onerror = (err) => {
      console.error('VideoProcessorWorker error:', err);
      this.pendingFrame = false;
    };

    this.canvas = document.createElement('canvas');
    this.canvas.width = this.processWidth;
    this.canvas.height = this.processHeight;
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
  }

  /**
   * Start webcam capture. Must be called from a user gesture context.
   *
   * Handles permission states:
   * - granted: starts stream
   * - denied: sets error in store with UI guidance
   * - prompt: shows native browser permission dialog
   */
  async startCamera(deviceId?: string): Promise<void> {
    try {
      const constraints: MediaStreamConstraints = {
        video: deviceId
          ? { deviceId: { exact: deviceId }, width: { ideal: 320 }, height: { ideal: 240 } }
          : { width: { ideal: 320 }, height: { ideal: 240 } },
        audio: false,
      };

      this.stream = await navigator.mediaDevices.getUserMedia(constraints);

      this.video = document.createElement('video');
      this.video.srcObject = this.stream;
      this.video.playsInline = true;
      this.video.muted = true;

      await this.video.play();

      cameraStore.getState().setIsActive(true);
      cameraStore.getState().setPermissionState('granted');
      cameraStore.getState().setError(null);
    } catch (err) {
      if (err instanceof DOMException) {
        if (err.name === 'NotAllowedError') {
          cameraStore.getState().setPermissionState('denied');
          cameraStore.getState().setError(
            'Camera access was denied. Please allow camera access in your browser settings and try again.',
          );
        } else if (err.name === 'NotFoundError') {
          cameraStore.getState().setError(
            'No camera found. Please connect a camera and try again.',
          );
        } else {
          cameraStore.getState().setError(`Camera error: ${err.message}`);
        }
      } else {
        cameraStore.getState().setError(
          `Failed to start camera: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
      cameraStore.getState().setIsActive(false);
      throw err;
    }
  }

  /**
   * Stop webcam capture and release the stream.
   */
  stopCamera(): void {
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }
    if (this.video) {
      this.video.srcObject = null;
      this.video = null;
    }
    this.latestLeds = new Uint8Array(DEFAULT_FRAME_SIZE);
    this.latestMotionLevel = 0;
    cameraStore.getState().setIsActive(false);
    cameraStore.getState().setMotionLevel(0);
  }

  /**
   * Set motion sensitivity (0-255).
   * Higher = more sensitive (lower threshold for motion detection).
   */
  setSensitivity(value: number): void {
    this.sensitivity = Math.max(0, Math.min(255, Math.round(value)));
    cameraStore.getState().setSensitivity(this.sensitivity);
  }

  getSensitivity(): number {
    return this.sensitivity;
  }

  /**
   * Enumerate available camera devices.
   */
  async getDevices(): Promise<MediaDeviceInfo[]> {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const cameras = devices.filter((d) => d.kind === 'videoinput');
      cameraStore.getState().setDevices(cameras);
      return cameras;
    } catch {
      return [];
    }
  }

  /**
   * Get the latest motion level (0-1).
   */
  getMotionLevel(): number {
    return this.latestMotionLevel;
  }

  tick(_deltaMs: number): FrameData | null {
    if (!this.worker || !this.video || !this.stream) return null;
    if (this.video.readyState < 2) return null; // HAVE_CURRENT_DATA

    if (!this.pendingFrame) {
      this.sendFrameToWorker();
    }

    return { type: 'direct', leds: this.latestLeds };
  }

  private sendFrameToWorker(): void {
    if (!this.ctx || !this.canvas || !this.worker || !this.video) return;

    this.ctx.drawImage(this.video, 0, 0, this.canvas.width, this.canvas.height);

    createImageBitmap(this.canvas).then((bitmap) => {
      if (!this.worker) return;

      const msg: WorkerRequest = {
        type: 'processMotion',
        bitmap,
        sensitivity: this.sensitivity,
        width: this.processWidth,
        height: this.processHeight,
      };

      this.pendingFrame = true;
      this.worker.postMessage(msg, [bitmap]);
    }).catch(() => {
      this.pendingFrame = false;
    });
  }

  private handleWorkerResponse(response: WorkerResponse): void {
    this.pendingFrame = false;

    if (response.type === 'motionResult') {
      this.latestLeds = response.leds;
      this.latestMotionLevel = response.motionLevel;
      cameraStore.getState().setMotionLevel(response.motionLevel);
    } else if (response.type === 'error') {
      console.error('VideoProcessorWorker:', response.message);
    }
  }

  destroy(): void {
    this.stopCamera();
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    this.canvas = null;
    this.ctx = null;
    cameraStore.getState().reset();
  }
}
