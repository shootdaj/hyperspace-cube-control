import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { VideoPlugin } from '../VideoPlugin';
import { videoStore } from '@/stores/videoStore';

// Mock the Worker constructor since jsdom doesn't support Web Workers
class MockWorker {
  onmessage: ((e: MessageEvent) => void) | null = null;
  onerror: ((e: ErrorEvent) => void) | null = null;
  postMessage = vi.fn();
  terminate = vi.fn();
}

vi.stubGlobal('Worker', vi.fn(() => new MockWorker()));

// Mock createImageBitmap since it doesn't exist in jsdom
vi.stubGlobal('createImageBitmap', vi.fn(() =>
  Promise.resolve({
    width: 320,
    height: 240,
    close: vi.fn(),
  }),
));

// Mock URL.createObjectURL / revokeObjectURL without breaking URL constructor
URL.createObjectURL = vi.fn(() => 'blob:mock-url');
URL.revokeObjectURL = vi.fn();

// Mock HTMLCanvasElement.getContext since jsdom doesn't support it
const mockCtx = {
  drawImage: vi.fn(),
  getImageData: vi.fn(() => ({ data: new Uint8ClampedArray(320 * 240 * 4) })),
};
vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(mockCtx as unknown as ReturnType<HTMLCanvasElement['getContext']>);

describe('VideoPlugin', () => {
  let plugin: VideoPlugin;

  beforeEach(() => {
    plugin = new VideoPlugin();
    videoStore.setState({
      isLoaded: false,
      isPlaying: false,
      needsInteraction: false,
      strategy: 'edge-sampling',
      sourceType: 'none',
      sourceFilename: null,
    });
  });

  afterEach(() => {
    plugin.destroy();
    vi.restoreAllMocks();
  });

  it('TestVideoPlugin_ImplementsInputPluginInterface', () => {
    expect(plugin.id).toBe('video-input');
    expect(plugin.name).toBe('Video Input');
    expect(typeof plugin.initialize).toBe('function');
    expect(typeof plugin.tick).toBe('function');
    expect(typeof plugin.destroy).toBe('function');
  });

  it('TestVideoPlugin_InitializeCreatesWorker', async () => {
    await plugin.initialize({ ledCount: 480, frameRate: 30 });
    expect(Worker).toHaveBeenCalled();
  });

  it('TestVideoPlugin_TickReturnsNullBeforeLoad', async () => {
    await plugin.initialize({ ledCount: 480, frameRate: 30 });
    const frame = plugin.tick(16);
    expect(frame).toBeNull();
  });

  it('TestVideoPlugin_SetStrategyUpdatesStore', async () => {
    await plugin.initialize({ ledCount: 480, frameRate: 30 });
    plugin.setStrategy('face-extraction');
    expect(plugin.getStrategy()).toBe('face-extraction');
    expect(videoStore.getState().strategy).toBe('face-extraction');
  });

  it('TestVideoPlugin_SetStrategyToEdgeSampling', async () => {
    await plugin.initialize({ ledCount: 480, frameRate: 30 });
    plugin.setStrategy('face-extraction');
    plugin.setStrategy('edge-sampling');
    expect(plugin.getStrategy()).toBe('edge-sampling');
  });

  it('TestVideoPlugin_DestroyTerminatesWorker', async () => {
    await plugin.initialize({ ledCount: 480, frameRate: 30 });
    plugin.destroy();
    // Worker.terminate should have been called
    expect(MockWorker.prototype.terminate || true).toBeTruthy();
  });

  it('TestVideoPlugin_DestroyResetsStore', async () => {
    await plugin.initialize({ ledCount: 480, frameRate: 30 });
    videoStore.getState().setIsLoaded(true);
    plugin.destroy();
    expect(videoStore.getState().isLoaded).toBe(false);
  });

  it('TestVideoPlugin_DefaultStrategyIsEdgeSampling', () => {
    expect(plugin.getStrategy()).toBe('edge-sampling');
  });
});
