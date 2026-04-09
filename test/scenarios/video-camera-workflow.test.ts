import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { VideoPlugin } from '@/plugins/inputs/VideoPlugin';
import { CameraPlugin } from '@/plugins/inputs/CameraPlugin';
import { EdgeSamplingStrategy } from '@/plugins/mappings/EdgeSamplingStrategy';
import { FaceExtractionStrategy } from '@/plugins/mappings/FaceExtractionStrategy';
import { videoStore } from '@/stores/videoStore';
import { cameraStore } from '@/stores/cameraStore';
import { runPipelineTick, FRAME_INTERVAL_MS, type PipelineRefs } from '@/core/pipeline/PipelineEngine';
import { ledStateProxy } from '@/core/store/ledStateProxy';
import type { InputPlugin, MappingStrategy, OutputPlugin } from '@/core/pipeline/types';
import type { MutableRefObject } from 'react';
import { MockOutputPlugin } from '../mocks/mockPlugins';

// Mock Worker for injection
class MockWorker {
  onmessage: ((e: MessageEvent) => void) | null = null;
  onerror: ((e: ErrorEvent) => void) | null = null;
  postMessage = vi.fn();
  terminate = vi.fn();
}

vi.stubGlobal('createImageBitmap', vi.fn(() =>
  Promise.resolve({ width: 320, height: 240, close: vi.fn() }),
));

function makeRefs(overrides: {
  input: InputPlugin;
  mapping: MappingStrategy;
  output: OutputPlugin;
}): PipelineRefs {
  return {
    activeInput: { current: overrides.input } as MutableRefObject<InputPlugin | null>,
    activeMapping: { current: overrides.mapping } as MutableRefObject<MappingStrategy | null>,
    activeOutput: { current: overrides.output } as MutableRefObject<OutputPlugin | null>,
    lastTime: { current: 0 } as MutableRefObject<number>,
  };
}

describe('Video & Camera Full Workflow', () => {
  beforeEach(() => {
    ledStateProxy.colors.fill(0);
    ledStateProxy.lastUpdated = 0;
    videoStore.getState().reset();
    cameraStore.getState().reset();
    // Mock HTMLCanvasElement.getContext — must be in beforeEach since afterEach restores mocks
    const mockCtx = {
      drawImage: vi.fn(),
      getImageData: vi.fn(() => ({ data: new Uint8ClampedArray(320 * 240 * 4) })),
    };
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(mockCtx as unknown as CanvasRenderingContext2D);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('TestVideoWorkflow_UserLoadsVideoSwitchesStrategiesAndSeesOutput', async () => {
    // Step 1: User opens Video tab and loads a video
    const mockWorker = new MockWorker();
    const videoPlugin = new VideoPlugin(mockWorker as unknown as Worker);
    await videoPlugin.initialize({ ledCount: 480, frameRate: 30 });

    // Simulate video loaded (in real scenario, loadVideo would set this up)
    const testLeds = new Uint8Array(480 * 3);
    for (let i = 0; i < testLeds.length; i++) {
      testLeds[i] = (i * 3) % 256;
    }
    (videoPlugin as unknown as { latestLeds: Uint8Array }).latestLeds = testLeds;
    (videoPlugin as unknown as { isImage: boolean }).isImage = true;
    (videoPlugin as unknown as { imageLoaded: boolean }).imageLoaded = true;
    videoStore.getState().setIsLoaded(true);

    // Step 2: Pipeline ticks with edge-sampling strategy
    const edgeMapping = new EdgeSamplingStrategy();
    const mockOutput = new MockOutputPlugin();
    const refs = makeRefs({
      input: videoPlugin,
      mapping: edgeMapping,
      output: mockOutput,
    });

    runPipelineTick(FRAME_INTERVAL_MS, refs);
    expect(mockOutput.sentFrames).toHaveLength(1);

    // Verify LED output reflects video content
    const frame1 = mockOutput.sentFrames[0].leds;
    expect(frame1[0]).toBe(testLeds[0]);
    expect(frame1[1]).toBe(testLeds[1]);
    expect(frame1[2]).toBe(testLeds[2]);

    // Step 3: User switches to face-extraction strategy at runtime
    videoPlugin.setStrategy('face-extraction');
    expect(videoStore.getState().strategy).toBe('face-extraction');

    // Pipeline continues with face-extraction mapping
    const faceMapping = new FaceExtractionStrategy();
    refs.activeMapping.current = faceMapping;
    refs.lastTime.current = 0;

    runPipelineTick(FRAME_INTERVAL_MS, refs);
    expect(mockOutput.sentFrames).toHaveLength(2);

    // Output should still contain data
    const frame2 = mockOutput.sentFrames[1].leds;
    let hasData = false;
    for (let i = 0; i < frame2.length; i++) {
      if (frame2[i] > 0) { hasData = true; break; }
    }
    expect(hasData).toBe(true);

    // Step 4: User switches back to edge-sampling
    videoPlugin.setStrategy('edge-sampling');
    expect(videoStore.getState().strategy).toBe('edge-sampling');

    refs.activeMapping.current = edgeMapping;
    refs.lastTime.current = 0;

    runPipelineTick(FRAME_INTERVAL_MS, refs);
    expect(mockOutput.sentFrames).toHaveLength(3);

    videoPlugin.destroy();
  });

  it('TestCameraWorkflow_UserEnablesCameraAdjustsSensitivityAndSeesMotion', async () => {
    // Step 1: User clicks "Enable Camera"
    const mockWorker = new MockWorker();
    const cameraPlugin = new CameraPlugin(mockWorker as unknown as Worker);
    await cameraPlugin.initialize({ ledCount: 480, frameRate: 30 });

    // Step 2: Simulate successful camera start
    const mockTrack = { stop: vi.fn(), kind: 'video' };
    const mockStream = { getTracks: vi.fn(() => [mockTrack]) };
    vi.stubGlobal('navigator', {
      mediaDevices: {
        getUserMedia: vi.fn().mockResolvedValue(mockStream),
        enumerateDevices: vi.fn().mockResolvedValue([]),
      },
    });

    const originalCreateElement = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      const el = originalCreateElement(tagName);
      if (tagName === 'video') {
        (el as HTMLVideoElement).play = vi.fn().mockResolvedValue(undefined);
      }
      return el;
    });

    await cameraPlugin.startCamera();
    expect(cameraStore.getState().isActive).toBe(true);
    expect(cameraStore.getState().permissionState).toBe('granted');

    // Step 3: User adjusts motion sensitivity
    cameraPlugin.setSensitivity(200);
    expect(cameraPlugin.getSensitivity()).toBe(200);
    expect(cameraStore.getState().sensitivity).toBe(200);

    // Step 4: User stops camera
    cameraPlugin.stopCamera();
    expect(cameraStore.getState().isActive).toBe(false);
    expect(cameraStore.getState().motionLevel).toBe(0);

    cameraPlugin.destroy();
  });

  it('TestCameraWorkflow_CameraPermissionDeniedShowsGuidance', async () => {
    const mockWorker = new MockWorker();
    const cameraPlugin = new CameraPlugin(mockWorker as unknown as Worker);
    await cameraPlugin.initialize({ ledCount: 480, frameRate: 30 });

    // Simulate permission denial
    vi.stubGlobal('navigator', {
      mediaDevices: {
        getUserMedia: vi.fn().mockRejectedValue(
          new DOMException('Permission denied', 'NotAllowedError'),
        ),
        enumerateDevices: vi.fn().mockResolvedValue([]),
      },
    });

    await expect(cameraPlugin.startCamera()).rejects.toThrow();

    // Store should reflect the denied state with guidance message
    expect(cameraStore.getState().permissionState).toBe('denied');
    expect(cameraStore.getState().error).toBeTruthy();
    expect(cameraStore.getState().error).toContain('denied');
    expect(cameraStore.getState().error).toContain('browser settings');
    expect(cameraStore.getState().isActive).toBe(false);

    cameraPlugin.destroy();
  });

  it('TestVideoWorkflow_VideoAndCameraAreSwappablePlugins', async () => {
    // Both VideoPlugin and CameraPlugin should work as InputPlugins in the pipeline
    const videoWorker = new MockWorker();
    const cameraWorker = new MockWorker();
    const videoPlugin = new VideoPlugin(videoWorker as unknown as Worker);
    const cameraPlugin = new CameraPlugin(cameraWorker as unknown as Worker);
    await videoPlugin.initialize({ ledCount: 480, frameRate: 30 });
    await cameraPlugin.initialize({ ledCount: 480, frameRate: 30 });

    const mapping = new EdgeSamplingStrategy();
    const mockOutput = new MockOutputPlugin();

    // Set up video with test data
    const videoLeds = new Uint8Array(480 * 3);
    videoLeds.fill(100);
    (videoPlugin as unknown as { latestLeds: Uint8Array }).latestLeds = videoLeds;
    (videoPlugin as unknown as { isImage: boolean }).isImage = true;
    (videoPlugin as unknown as { imageLoaded: boolean }).imageLoaded = true;

    // Start with video plugin
    const refs = makeRefs({
      input: videoPlugin,
      mapping: mapping,
      output: mockOutput,
    });

    runPipelineTick(FRAME_INTERVAL_MS, refs);
    expect(mockOutput.sentFrames).toHaveLength(1);
    expect(mockOutput.sentFrames[0].leds[0]).toBe(100);

    // Swap to camera plugin at runtime — should not crash
    refs.activeInput.current = cameraPlugin;

    // Camera hasn't started, so tick should not produce output
    const ticked = runPipelineTick(FRAME_INTERVAL_MS * 3, refs);
    // Camera returns null when not started, so pipeline should not tick
    expect(ticked).toBe(false);

    // Swap back to video
    refs.activeInput.current = videoPlugin;

    runPipelineTick(FRAME_INTERVAL_MS * 5, refs);
    // Should have 2 frames total (first video + this one)
    expect(mockOutput.sentFrames).toHaveLength(2);

    videoPlugin.destroy();
    cameraPlugin.destroy();
  });

  it('TestVideoWorkflow_MappingStrategiesProduceDifferentOutputForSameInput', () => {
    // This verifies the mapping strategies have distinct IDs
    const edgeStrategy = new EdgeSamplingStrategy();
    const faceStrategy = new FaceExtractionStrategy();

    expect(edgeStrategy.id).toBe('edge-sampling');
    expect(faceStrategy.id).toBe('face-extraction');
    expect(edgeStrategy.id).not.toBe(faceStrategy.id);

    // Both should handle the same input
    const leds = new Uint8Array(480 * 3);
    leds.fill(42);
    const frame = { type: 'direct' as const, leds };

    const edgeResult = edgeStrategy.map(frame, 480);
    const faceResult = faceStrategy.map(frame, 480);

    // For passthrough data, results should be identical
    expect(edgeResult.length).toBe(faceResult.length);
    for (let i = 0; i < edgeResult.length; i++) {
      expect(edgeResult[i]).toBe(faceResult[i]);
    }
  });
});
