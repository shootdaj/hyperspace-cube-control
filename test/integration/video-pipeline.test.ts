import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { VideoPlugin } from '@/plugins/inputs/VideoPlugin';
import { CameraPlugin } from '@/plugins/inputs/CameraPlugin';
import { EdgeSamplingStrategy } from '@/plugins/mappings/EdgeSamplingStrategy';
import { FaceExtractionStrategy } from '@/plugins/mappings/FaceExtractionStrategy';
import { ledStateProxy } from '@/core/store/ledStateProxy';
import { videoStore } from '@/stores/videoStore';
import { cameraStore } from '@/stores/cameraStore';
import { runPipelineTick, FRAME_INTERVAL_MS, type PipelineRefs } from '@/core/pipeline/PipelineEngine';
import { pluginRegistry } from '@/core/pipeline/PluginRegistry';
import { DEFAULT_LED_COUNT, DEFAULT_FRAME_SIZE } from '@/core/constants';
import { registerVideoPlugins } from '@/plugins/inputs/registerVideoPlugins';
import type { InputPlugin, MappingStrategy, OutputPlugin } from '@/core/pipeline/types';
import type { MutableRefObject } from 'react';
import { MockInputPlugin, MockOutputPlugin } from '../mocks/mockPlugins';

// Mock Worker for injection
class MockWorker {
  onmessage: ((e: MessageEvent) => void) | null = null;
  onerror: ((e: ErrorEvent) => void) | null = null;
  postMessage = vi.fn();
  terminate = vi.fn();
}

// Mock createImageBitmap
vi.stubGlobal('createImageBitmap', vi.fn(() =>
  Promise.resolve({
    width: 320,
    height: 240,
    close: vi.fn(),
  }),
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

describe('Video Pipeline Integration', () => {
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

  it('TestVideoPipeline_VideoPluginWithEdgeSamplingProducesOutput', async () => {
    const mockWorker = new MockWorker();
    const videoPlugin = new VideoPlugin(mockWorker as unknown as Worker);
    await videoPlugin.initialize({ ledCount: DEFAULT_LED_COUNT, frameRate: 30 });

    // Simulate loaded video with pre-computed LED data
    const testLeds = new Uint8Array(DEFAULT_FRAME_SIZE);
    testLeds[0] = 255;
    testLeds[1] = 128;
    testLeds[2] = 64;

    // Manually set the latestLeds to simulate worker response
    (videoPlugin as unknown as { latestLeds: Uint8Array }).latestLeds = testLeds;
    (videoPlugin as unknown as { isImage: boolean }).isImage = true;
    (videoPlugin as unknown as { imageLoaded: boolean }).imageLoaded = true;

    const mapping = new EdgeSamplingStrategy();
    const mockOutput = new MockOutputPlugin();

    const refs = makeRefs({
      input: videoPlugin,
      mapping: mapping,
      output: mockOutput,
    });

    const ticked = runPipelineTick(FRAME_INTERVAL_MS, refs);
    expect(ticked).toBe(true);
    expect(mockOutput.sentFrames).toHaveLength(1);
    expect(mockOutput.sentFrames[0].leds[0]).toBe(255);
    expect(mockOutput.sentFrames[0].leds[1]).toBe(128);
    expect(mockOutput.sentFrames[0].leds[2]).toBe(64);

    videoPlugin.destroy();
  });

  it('TestVideoPipeline_StrategySwapAtRuntime', async () => {
    const mockWorker = new MockWorker();
    const videoPlugin = new VideoPlugin(mockWorker as unknown as Worker);
    await videoPlugin.initialize({ ledCount: DEFAULT_LED_COUNT, frameRate: 30 });

    // Start with edge-sampling
    expect(videoPlugin.getStrategy()).toBe('edge-sampling');

    // Swap to face-extraction at runtime
    videoPlugin.setStrategy('face-extraction');
    expect(videoPlugin.getStrategy()).toBe('face-extraction');
    expect(videoStore.getState().strategy).toBe('face-extraction');

    // Swap back
    videoPlugin.setStrategy('edge-sampling');
    expect(videoPlugin.getStrategy()).toBe('edge-sampling');

    videoPlugin.destroy();
  });

  it('TestVideoPipeline_StrategySwapDoesNotRestartPipeline', async () => {
    const mockWorker = new MockWorker();
    const videoPlugin = new VideoPlugin(mockWorker as unknown as Worker);
    await videoPlugin.initialize({ ledCount: DEFAULT_LED_COUNT, frameRate: 30 });

    const testLeds = new Uint8Array(DEFAULT_FRAME_SIZE);
    testLeds.fill(100);
    (videoPlugin as unknown as { latestLeds: Uint8Array }).latestLeds = testLeds;
    (videoPlugin as unknown as { isImage: boolean }).isImage = true;
    (videoPlugin as unknown as { imageLoaded: boolean }).imageLoaded = true;

    const edgeMapping = new EdgeSamplingStrategy();
    const mockOutput = new MockOutputPlugin();

    const refs = makeRefs({
      input: videoPlugin,
      mapping: edgeMapping,
      output: mockOutput,
    });

    // Tick with edge-sampling
    runPipelineTick(FRAME_INTERVAL_MS, refs);
    expect(mockOutput.sentFrames).toHaveLength(1);

    // Swap strategy
    videoPlugin.setStrategy('face-extraction');

    // Swap the mapping in the pipeline
    const faceMapping = new FaceExtractionStrategy();
    refs.activeMapping.current = faceMapping;

    // Tick again with enough time elapsed — pipeline should continue without restart
    runPipelineTick(FRAME_INTERVAL_MS * 2, refs);
    expect(mockOutput.sentFrames).toHaveLength(2);

    videoPlugin.destroy();
  });

  it('TestVideoPipeline_SwapFromManualPaintToVideo', async () => {
    const manualPlugin = new MockInputPlugin();
    const mockWorker = new MockWorker();
    const videoPlugin = new VideoPlugin(mockWorker as unknown as Worker);
    await videoPlugin.initialize({ ledCount: DEFAULT_LED_COUNT, frameRate: 30 });

    const testLeds = new Uint8Array(DEFAULT_FRAME_SIZE);
    testLeds.fill(77);
    (videoPlugin as unknown as { latestLeds: Uint8Array }).latestLeds = testLeds;
    (videoPlugin as unknown as { isImage: boolean }).isImage = true;
    (videoPlugin as unknown as { imageLoaded: boolean }).imageLoaded = true;

    const mapping = new EdgeSamplingStrategy();
    const mockOutput = new MockOutputPlugin();

    const refs = makeRefs({
      input: manualPlugin,
      mapping: mapping,
      output: mockOutput,
    });

    // Start with manual paint
    runPipelineTick(FRAME_INTERVAL_MS, refs);
    expect(mockOutput.sentFrames).toHaveLength(1);

    // Swap to video at runtime
    refs.activeInput.current = videoPlugin;

    runPipelineTick(FRAME_INTERVAL_MS * 2, refs);
    expect(mockOutput.sentFrames).toHaveLength(2);

    // Video data should be present
    expect(mockOutput.sentFrames[1].leds[0]).toBe(77);

    videoPlugin.destroy();
  });

  it('TestVideoPipeline_CameraPluginTickReturnsNullBeforeStart', async () => {
    const mockWorker = new MockWorker();
    const cameraPlugin = new CameraPlugin(mockWorker as unknown as Worker);
    await cameraPlugin.initialize({ ledCount: DEFAULT_LED_COUNT, frameRate: 30 });

    const frame = cameraPlugin.tick(16);
    expect(frame).toBeNull();

    cameraPlugin.destroy();
  });
});

describe('Video Plugin Registration', () => {
  // Registration test uses real constructors via the registry —
  // needs Worker mock since registry creates plugins with default constructor
  beforeEach(() => {
    vi.stubGlobal('Worker', vi.fn(() => new MockWorker()));
  });

  it('TestVideoPluginRegistration_AllPluginsRegistered', () => {
    registerVideoPlugins();

    expect(pluginRegistry.listInputs()).toContain('video-input');
    expect(pluginRegistry.listInputs()).toContain('camera-input');
    expect(pluginRegistry.listMappings()).toContain('edge-sampling');
    expect(pluginRegistry.listMappings()).toContain('face-extraction');
  });
});
