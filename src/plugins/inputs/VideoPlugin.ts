import type { InputPlugin, FrameData, PluginContext } from '@/core/pipeline/types';
import type { WorkerRequest, WorkerResponse, MappingStrategyType } from '@/workers/videoWorkerTypes';
import { videoStore } from '@/stores/videoStore';

/**
 * VideoPlugin — InputPlugin for video/image-to-LED mapping.
 *
 * Loads a video file or image URL into an HTMLVideoElement/Image,
 * sends frames to a Web Worker for processing, and returns the
 * resulting LED colors as FrameData.
 *
 * Video processing runs entirely in a Web Worker to avoid blocking
 * the main thread (VID-05). The worker uses OffscreenCanvas +
 * getImageData for pixel sampling.
 *
 * Supports two mapping strategies:
 * - edge-sampling: samples colors along 12 edge positions (VID-02)
 * - face-extraction: maps face regions then extracts edge pixels (VID-03)
 *
 * Strategy can be switched at runtime via setStrategy() (VID-04).
 */
export class VideoPlugin implements InputPlugin {
  readonly id = 'video-input';
  readonly name = 'Video Input';

  private worker: Worker | null = null;
  private video: HTMLVideoElement | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private latestLeds: Uint8Array = new Uint8Array(480 * 3);
  private pendingFrame = false;
  private strategy: MappingStrategyType = 'edge-sampling';
  private processWidth = 320;  // Downscale for performance
  private processHeight = 240;
  private isImage = false;
  private imageLoaded = false;

  /** Optional injected worker for testing (avoids needing real Worker + URL) */
  private injectedWorker: Worker | null;

  constructor(worker?: Worker) {
    this.injectedWorker = worker ?? null;
  }

  async initialize(_ctx: PluginContext): Promise<void> {
    // Create the Web Worker (use injected worker if provided for tests)
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

    // Create offscreen processing canvas
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.processWidth;
    this.canvas.height = this.processHeight;
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
  }

  /**
   * Load a video file for processing.
   * @param source - File object, Blob URL, or URL string
   */
  async loadVideo(source: string | File): Promise<void> {
    this.isImage = false;
    this.imageLoaded = false;

    // Clean up existing video
    if (this.video) {
      this.video.pause();
      if (this.video.src.startsWith('blob:')) {
        URL.revokeObjectURL(this.video.src);
      }
      this.video.removeAttribute('src');
      this.video.load();
    }

    this.video = document.createElement('video');
    this.video.crossOrigin = 'anonymous';
    this.video.muted = true;
    this.video.loop = true;
    this.video.playsInline = true;

    const url = source instanceof File ? URL.createObjectURL(source) : source;

    return new Promise((resolve, reject) => {
      if (!this.video) return reject(new Error('No video element'));

      this.video.onloadeddata = () => {
        this.video!.play().catch(() => {
          // Autoplay blocked — user must interact
          videoStore.getState().setNeedsInteraction(true);
        });
        videoStore.getState().setIsLoaded(true);
        videoStore.getState().setIsPlaying(true);
        resolve();
      };

      this.video.onerror = () => {
        reject(new Error('Failed to load video'));
      };

      this.video.src = url;
    });
  }

  /**
   * Load an image for processing.
   * @param source - File object, Blob URL, or URL string
   */
  async loadImage(source: string | File): Promise<void> {
    this.isImage = true;
    this.imageLoaded = false;

    // Clean up existing video
    if (this.video) {
      this.video.pause();
      this.video = null;
    }

    const url = source instanceof File ? URL.createObjectURL(source) : source;

    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        // Draw image to canvas once
        if (this.ctx && this.canvas) {
          this.ctx.drawImage(img, 0, 0, this.canvas.width, this.canvas.height);
        }
        this.imageLoaded = true;
        videoStore.getState().setIsLoaded(true);
        resolve();
      };
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = url;
    });
  }

  /**
   * Play/pause the video.
   */
  togglePlayback(): void {
    if (!this.video) return;
    if (this.video.paused) {
      this.video.play().catch(console.error);
      videoStore.getState().setIsPlaying(true);
    } else {
      this.video.pause();
      videoStore.getState().setIsPlaying(false);
    }
  }

  /**
   * Set the mapping strategy (edge-sampling or face-extraction).
   * Takes effect on the next frame. VID-04.
   */
  setStrategy(strategy: MappingStrategyType): void {
    this.strategy = strategy;
    videoStore.getState().setStrategy(strategy);
  }

  getStrategy(): MappingStrategyType {
    return this.strategy;
  }

  /**
   * Called every pipeline tick. Captures a frame from the video/image
   * and sends it to the worker for processing.
   *
   * Returns the most recently processed LED data. Processing is
   * asynchronous — the returned data may be 1-2 frames behind.
   */
  tick(_deltaMs: number): FrameData | null {
    if (!this.worker) return null;

    // For images, send frame once when loaded and not yet processed
    if (this.isImage) {
      if (!this.imageLoaded || !this.canvas || !this.ctx) return null;

      if (!this.pendingFrame) {
        this.sendFrameToWorker();
      }
      return { type: 'direct', leds: this.latestLeds };
    }

    // For video, send current frame if not already processing
    if (!this.video || this.video.paused || this.video.ended) {
      return this.hasData() ? { type: 'direct', leds: this.latestLeds } : null;
    }

    if (!this.pendingFrame) {
      this.sendFrameToWorker();
    }

    return { type: 'direct', leds: this.latestLeds };
  }

  private sendFrameToWorker(): void {
    if (!this.ctx || !this.canvas || !this.worker) return;

    // Draw current video frame to the processing canvas
    if (!this.isImage && this.video) {
      this.ctx.drawImage(this.video, 0, 0, this.canvas.width, this.canvas.height);
    }

    // Create an ImageBitmap and transfer to worker
    createImageBitmap(this.canvas).then((bitmap) => {
      if (!this.worker) return;

      const msg: WorkerRequest = {
        type: 'processFrame',
        bitmap,
        strategy: this.strategy,
        width: this.processWidth,
        height: this.processHeight,
      };

      this.pendingFrame = true;
      this.worker.postMessage(msg, [bitmap]);
    }).catch(() => {
      // createImageBitmap can fail if canvas is empty
      this.pendingFrame = false;
    });
  }

  private handleWorkerResponse(response: WorkerResponse): void {
    this.pendingFrame = false;

    if (response.type === 'frameResult') {
      this.latestLeds = response.leds;
    } else if (response.type === 'error') {
      console.error('VideoProcessorWorker:', response.message);
    }
  }

  private hasData(): boolean {
    for (let i = 0; i < this.latestLeds.length; i++) {
      if (this.latestLeds[i] > 0) return true;
    }
    return false;
  }

  destroy(): void {
    if (this.video) {
      this.video.pause();
      if (this.video.src.startsWith('blob:')) {
        URL.revokeObjectURL(this.video.src);
      }
      this.video = null;
    }
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    this.canvas = null;
    this.ctx = null;
    videoStore.getState().reset();
  }
}
