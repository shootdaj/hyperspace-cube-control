import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CameraPlugin } from '../CameraPlugin';
import { cameraStore } from '@/stores/cameraStore';

// Mock Worker
class MockWorker {
  onmessage: ((e: MessageEvent) => void) | null = null;
  onerror: ((e: ErrorEvent) => void) | null = null;
  postMessage = vi.fn();
  terminate = vi.fn();
}

vi.stubGlobal('Worker', vi.fn(() => new MockWorker()));

// Mock createImageBitmap
vi.stubGlobal('createImageBitmap', vi.fn(() =>
  Promise.resolve({
    width: 160,
    height: 120,
    close: vi.fn(),
  }),
));

describe('CameraPlugin', () => {
  let plugin: CameraPlugin;

  beforeEach(() => {
    plugin = new CameraPlugin();
    cameraStore.setState({
      isActive: false,
      devices: [],
      selectedDeviceId: null,
      permissionState: null,
      error: null,
      sensitivity: 128,
      motionLevel: 0,
    });
  });

  afterEach(() => {
    plugin.destroy();
    vi.restoreAllMocks();
  });

  it('TestCameraPlugin_ImplementsInputPluginInterface', () => {
    expect(plugin.id).toBe('camera-input');
    expect(plugin.name).toBe('Camera Input');
    expect(typeof plugin.initialize).toBe('function');
    expect(typeof plugin.tick).toBe('function');
    expect(typeof plugin.destroy).toBe('function');
  });

  it('TestCameraPlugin_InitializeCreatesWorker', async () => {
    await plugin.initialize({ ledCount: 480, frameRate: 30 });
    expect(Worker).toHaveBeenCalled();
  });

  it('TestCameraPlugin_TickReturnsNullBeforeStart', async () => {
    await plugin.initialize({ ledCount: 480, frameRate: 30 });
    const frame = plugin.tick(16);
    expect(frame).toBeNull();
  });

  it('TestCameraPlugin_SetSensitivity', () => {
    plugin.setSensitivity(200);
    expect(plugin.getSensitivity()).toBe(200);
    expect(cameraStore.getState().sensitivity).toBe(200);
  });

  it('TestCameraPlugin_SensitivityClamps', () => {
    plugin.setSensitivity(-10);
    expect(plugin.getSensitivity()).toBe(0);

    plugin.setSensitivity(300);
    expect(plugin.getSensitivity()).toBe(255);
  });

  it('TestCameraPlugin_DefaultSensitivity', () => {
    expect(plugin.getSensitivity()).toBe(128);
  });

  it('TestCameraPlugin_MotionLevelStartsAtZero', () => {
    expect(plugin.getMotionLevel()).toBe(0);
  });

  it('TestCameraPlugin_StartCameraHandlesDeniedPermission', async () => {
    // Mock getUserMedia to deny permission
    const mockGetUserMedia = vi.fn().mockRejectedValue(
      new DOMException('Permission denied', 'NotAllowedError'),
    );
    vi.stubGlobal('navigator', {
      mediaDevices: {
        getUserMedia: mockGetUserMedia,
        enumerateDevices: vi.fn().mockResolvedValue([]),
      },
    });

    await plugin.initialize({ ledCount: 480, frameRate: 30 });

    await expect(plugin.startCamera()).rejects.toThrow();
    expect(cameraStore.getState().permissionState).toBe('denied');
    expect(cameraStore.getState().error).toContain('denied');
    expect(cameraStore.getState().isActive).toBe(false);
  });

  it('TestCameraPlugin_StartCameraHandlesNotFoundError', async () => {
    const mockGetUserMedia = vi.fn().mockRejectedValue(
      new DOMException('No camera', 'NotFoundError'),
    );
    vi.stubGlobal('navigator', {
      mediaDevices: {
        getUserMedia: mockGetUserMedia,
        enumerateDevices: vi.fn().mockResolvedValue([]),
      },
    });

    await plugin.initialize({ ledCount: 480, frameRate: 30 });

    await expect(plugin.startCamera()).rejects.toThrow();
    expect(cameraStore.getState().error).toContain('No camera');
  });

  it('TestCameraPlugin_StartCameraSucceeds', async () => {
    const mockTrack = { stop: vi.fn(), kind: 'video' };
    const mockStream = {
      getTracks: vi.fn(() => [mockTrack]),
    };
    const mockGetUserMedia = vi.fn().mockResolvedValue(mockStream);
    vi.stubGlobal('navigator', {
      mediaDevices: {
        getUserMedia: mockGetUserMedia,
        enumerateDevices: vi.fn().mockResolvedValue([]),
      },
    });

    // Mock HTMLVideoElement.play()
    const originalCreateElement = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      const el = originalCreateElement(tagName);
      if (tagName === 'video') {
        (el as HTMLVideoElement).play = vi.fn().mockResolvedValue(undefined);
      }
      return el;
    });

    await plugin.initialize({ ledCount: 480, frameRate: 30 });
    await plugin.startCamera();

    expect(cameraStore.getState().isActive).toBe(true);
    expect(cameraStore.getState().permissionState).toBe('granted');
    expect(cameraStore.getState().error).toBeNull();
  });

  it('TestCameraPlugin_StopCameraReleasesStream', async () => {
    const mockTrack = { stop: vi.fn(), kind: 'video' };
    const mockStream = {
      getTracks: vi.fn(() => [mockTrack]),
    };
    const mockGetUserMedia = vi.fn().mockResolvedValue(mockStream);
    vi.stubGlobal('navigator', {
      mediaDevices: {
        getUserMedia: mockGetUserMedia,
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

    await plugin.initialize({ ledCount: 480, frameRate: 30 });
    await plugin.startCamera();
    plugin.stopCamera();

    expect(mockTrack.stop).toHaveBeenCalled();
    expect(cameraStore.getState().isActive).toBe(false);
  });

  it('TestCameraPlugin_DestroyResetsStore', async () => {
    await plugin.initialize({ ledCount: 480, frameRate: 30 });
    cameraStore.getState().setIsActive(true);
    cameraStore.getState().setSensitivity(200);
    plugin.destroy();
    expect(cameraStore.getState().isActive).toBe(false);
    expect(cameraStore.getState().sensitivity).toBe(128);
  });

  it('TestCameraPlugin_GetDevicesEnumeratesCameras', async () => {
    const mockDevices = [
      { kind: 'videoinput', deviceId: 'cam1', label: 'Camera 1' },
      { kind: 'audioinput', deviceId: 'mic1', label: 'Mic 1' },
      { kind: 'videoinput', deviceId: 'cam2', label: 'Camera 2' },
    ];
    vi.stubGlobal('navigator', {
      mediaDevices: {
        enumerateDevices: vi.fn().mockResolvedValue(mockDevices),
        getUserMedia: vi.fn(),
      },
    });

    const cameras = await plugin.getDevices();
    // Should only return video input devices
    expect(cameras).toHaveLength(2);
    expect(cameraStore.getState().devices).toHaveLength(2);
  });
});
