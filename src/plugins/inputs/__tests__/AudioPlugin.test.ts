import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AudioPlugin } from '../AudioPlugin';
import { AudioContextManager } from '../AudioContextManager';
import { audioStore } from '@/stores/audioStore';

// Mock audioDeviceService
vi.mock('../audioDeviceService', () => ({
  requestPermissionAndEnumerate: vi.fn().mockResolvedValue([
    { deviceId: 'mic-1', kind: 'audioinput', label: 'Mic', groupId: 'g1', toJSON: () => ({}) },
  ]),
}));

function createMockManager() {
  const mockAnalyser = {
    getByteFrequencyData: vi.fn((arr: Uint8Array) => {
      // Simulate some frequency data
      for (let i = 0; i < arr.length; i++) {
        arr[i] = i < 128 ? 200 : 50; // Bass-heavy signal
      }
    }),
    frequencyBinCount: 1024,
    fftSize: 2048,
    smoothingTimeConstant: 0.8,
  };

  const manager = new AudioContextManager();
  const mockStart = vi.fn();
  const mockStop = vi.fn();
  const mockDestroy = vi.fn();
  const mockSetGain = vi.fn();
  let hasAnalyser = false;

  manager.start = mockStart.mockImplementation(async () => {
    hasAnalyser = true;
  });
  manager.stop = mockStop.mockImplementation(() => {
    hasAnalyser = false;
  });
  manager.destroy = mockDestroy.mockImplementation(() => {
    hasAnalyser = false;
  });
  manager.setGain = mockSetGain;
  manager.getAnalyser = () =>
    hasAnalyser ? (mockAnalyser as unknown as AnalyserNode) : null;

  return { manager, mockStart, mockStop, mockDestroy, mockSetGain, mockAnalyser };
}

describe('AudioPlugin', () => {
  let plugin: AudioPlugin;
  let mocks: ReturnType<typeof createMockManager>;

  beforeEach(() => {
    mocks = createMockManager();
    plugin = new AudioPlugin(mocks.manager);
    audioStore.setState({
      devices: [],
      selectedDeviceId: null,
      isAudioActive: false,
      audioContextState: null,
      gain: 1.0,
      sensitivity: 128,
      visualizationMode: 'spectrum',
    });
  });

  it('TestAudioPlugin_IdAndName', () => {
    expect(plugin.id).toBe('audio-reactive');
    expect(plugin.name).toBe('Audio Reactive');
  });

  it('TestAudioPlugin_TickReturnsNullWhenNotStarted', () => {
    const result = plugin.tick(16);
    expect(result).toBeNull();
  });

  it('TestAudioPlugin_TickReturnsFrameDataWhenStarted', async () => {
    await plugin.startAudio();

    const result = plugin.tick(16);
    expect(result).not.toBeNull();
    expect(result!.type).toBe('audio');
    expect(result!.spectrum).toBeInstanceOf(Float32Array);
    expect(result!.spectrum!.length).toBe(1024);
  });

  it('TestAudioPlugin_SpectrumIsNormalized', async () => {
    await plugin.startAudio();

    const result = plugin.tick(16);
    // Mock fills first 128 bins with 200 (200/255 ≈ 0.784)
    expect(result!.spectrum![0]).toBeCloseTo(200 / 255, 3);
    // Bins 128+ filled with 50 (50/255 ≈ 0.196)
    expect(result!.spectrum![128]).toBeCloseTo(50 / 255, 3);
  });

  it('TestAudioPlugin_TickReusesBuffers', async () => {
    await plugin.startAudio();

    const result1 = plugin.tick(16);
    const result2 = plugin.tick(16);

    // Same Float32Array reference (no allocation per tick)
    expect(result1!.spectrum).toBe(result2!.spectrum);
  });

  it('TestAudioPlugin_StartAudioDelegates', async () => {
    await plugin.startAudio('device-42');
    expect(mocks.mockStart).toHaveBeenCalledWith('device-42');
  });

  it('TestAudioPlugin_StopAudioDelegates', async () => {
    await plugin.startAudio();
    plugin.stopAudio();
    expect(mocks.mockStop).toHaveBeenCalled();
  });

  it('TestAudioPlugin_TickReturnsNullAfterStop', async () => {
    await plugin.startAudio();
    expect(plugin.tick(16)).not.toBeNull();

    plugin.stopAudio();
    expect(plugin.tick(16)).toBeNull();
  });

  it('TestAudioPlugin_SetGainDelegatesAndUpdatesStore', () => {
    plugin.setGain(3.0);
    expect(mocks.mockSetGain).toHaveBeenCalledWith(3.0);
    expect(audioStore.getState().gain).toBe(3.0);
  });

  it('TestAudioPlugin_GetDevicesUpdatesStore', async () => {
    const devices = await plugin.getDevices();
    expect(devices).toHaveLength(1);
    expect(devices[0].label).toBe('Mic');
    expect(audioStore.getState().devices).toHaveLength(1);
  });

  it('TestAudioPlugin_DestroyDelegates', () => {
    plugin.destroy();
    expect(mocks.mockDestroy).toHaveBeenCalled();
  });

  it('TestAudioPlugin_ImplementsInputPluginInterface', async () => {
    // Verify all InputPlugin methods exist
    expect(typeof plugin.initialize).toBe('function');
    expect(typeof plugin.tick).toBe('function');
    expect(typeof plugin.destroy).toBe('function');
    expect(typeof plugin.id).toBe('string');
    expect(typeof plugin.name).toBe('string');

    // initialize should not throw
    await plugin.initialize({ ledCount: 480, frameRate: 30 });
  });
});
