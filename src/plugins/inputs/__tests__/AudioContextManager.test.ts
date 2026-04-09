import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AudioContextManager } from '../AudioContextManager';
import { audioStore } from '@/stores/audioStore';

// --- Mock Web Audio API objects ---

function createMockAnalyser() {
  return {
    fftSize: 0,
    smoothingTimeConstant: 0,
    frequencyBinCount: 1024,
    getByteFrequencyData: vi.fn(),
    getFloatFrequencyData: vi.fn(),
    connect: vi.fn(),
    disconnect: vi.fn(),
  };
}

function createMockGainNode() {
  return {
    gain: {
      value: 1.0,
      setValueAtTime: vi.fn(),
    },
    connect: vi.fn(),
    disconnect: vi.fn(),
  };
}

function createMockSourceNode() {
  return {
    connect: vi.fn(),
    disconnect: vi.fn(),
  };
}

function createMockAudioContext(initialState: AudioContextState = 'running') {
  let state = initialState;
  const ctx = {
    get state() { return state; },
    _setState(s: AudioContextState) { state = s; ctx.onstatechange?.({} as Event); },
    currentTime: 0,
    resume: vi.fn(async () => { state = 'running'; }),
    close: vi.fn(async () => { state = 'closed'; }),
    createMediaStreamSource: vi.fn(() => createMockSourceNode()),
    createGain: vi.fn(() => createMockGainNode()),
    createAnalyser: vi.fn(() => createMockAnalyser()),
    onstatechange: null as ((ev: Event) => void) | null,
  };
  return ctx;
}

function createMockStream() {
  const stopFn = vi.fn();
  return {
    stream: {
      getTracks: () => [{ stop: stopFn }, { stop: stopFn }],
    } as unknown as MediaStream,
    stopFn,
  };
}

describe('AudioContextManager', () => {
  let manager: AudioContextManager;

  beforeEach(() => {
    manager = new AudioContextManager();
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

  it('TestAudioContextManager_ConstructorDoesNotCreateContext', () => {
    expect(manager.getAnalyser()).toBeNull();
    expect(manager.getState()).toBeNull();
  });

  it('TestAudioContextManager_StartCreatesContextAndGraph', async () => {
    const mockCtx = createMockAudioContext();
    const { stream } = createMockStream();

    manager.createAudioContext = () => mockCtx as unknown as AudioContext;
    manager.getUserMedia = vi.fn().mockResolvedValue(stream);

    await manager.start();

    expect(manager.getState()).toBe('running');
    expect(manager.getAnalyser()).not.toBeNull();
    expect(mockCtx.createMediaStreamSource).toHaveBeenCalled();
    expect(mockCtx.createGain).toHaveBeenCalled();
    expect(mockCtx.createAnalyser).toHaveBeenCalled();
    expect(audioStore.getState().isAudioActive).toBe(true);
  });

  it('TestAudioContextManager_StartWithDeviceId', async () => {
    const mockCtx = createMockAudioContext();
    const { stream } = createMockStream();

    manager.createAudioContext = () => mockCtx as unknown as AudioContext;
    const mockGetUserMedia = vi.fn().mockResolvedValue(stream);
    manager.getUserMedia = mockGetUserMedia;

    await manager.start('device-42');

    expect(mockGetUserMedia).toHaveBeenCalledWith({
      audio: { deviceId: { exact: 'device-42' } },
    });
  });

  it('TestAudioContextManager_StartResumesIfSuspended', async () => {
    const mockCtx = createMockAudioContext('suspended');
    const { stream } = createMockStream();

    manager.createAudioContext = () => mockCtx as unknown as AudioContext;
    manager.getUserMedia = vi.fn().mockResolvedValue(stream);

    await manager.start();

    expect(mockCtx.resume).toHaveBeenCalled();
    expect(manager.getState()).toBe('running');
  });

  it('TestAudioContextManager_StartReusesExistingContext', async () => {
    const mockCtx = createMockAudioContext();
    const { stream: stream1 } = createMockStream();
    const { stream: stream2 } = createMockStream();

    let callCount = 0;
    manager.createAudioContext = () => {
      callCount++;
      return mockCtx as unknown as AudioContext;
    };
    manager.getUserMedia = vi.fn()
      .mockResolvedValueOnce(stream1)
      .mockResolvedValueOnce(stream2);

    await manager.start();
    await manager.start('other-device');

    // AudioContext should only be created once
    expect(callCount).toBe(1);
  });

  it('TestAudioContextManager_StartStopsOldStreamOnDeviceSwitch', async () => {
    const mockCtx = createMockAudioContext();
    const { stream: stream1, stopFn: stop1 } = createMockStream();
    const { stream: stream2 } = createMockStream();

    manager.createAudioContext = () => mockCtx as unknown as AudioContext;
    manager.getUserMedia = vi.fn()
      .mockResolvedValueOnce(stream1)
      .mockResolvedValueOnce(stream2);

    await manager.start();
    await manager.start('other-device');

    // First stream's tracks should have been stopped
    expect(stop1).toHaveBeenCalled();
  });

  it('TestAudioContextManager_AnalyserNodeConfiguration', async () => {
    const mockCtx = createMockAudioContext();
    const { stream } = createMockStream();

    manager.createAudioContext = () => mockCtx as unknown as AudioContext;
    manager.getUserMedia = vi.fn().mockResolvedValue(stream);

    await manager.start();

    const analyser = manager.getAnalyser();
    expect(analyser).not.toBeNull();
    // Verify fftSize and smoothingTimeConstant were set
    expect(analyser!.fftSize).toBe(2048);
    expect(analyser!.smoothingTimeConstant).toBe(0.8);
  });

  it('TestAudioContextManager_SetGain', async () => {
    const mockCtx = createMockAudioContext();
    const { stream } = createMockStream();
    const mockGainNode = createMockGainNode();
    mockCtx.createGain = vi.fn(() => mockGainNode);

    manager.createAudioContext = () => mockCtx as unknown as AudioContext;
    manager.getUserMedia = vi.fn().mockResolvedValue(stream);

    await manager.start();
    manager.setGain(2.5);

    expect(mockGainNode.gain.setValueAtTime).toHaveBeenCalledWith(2.5, 0);
  });

  it('TestAudioContextManager_SetGainBeforeStart_NoError', () => {
    // Should not throw when called before start
    expect(() => manager.setGain(2.0)).not.toThrow();
  });

  it('TestAudioContextManager_Stop', async () => {
    const mockCtx = createMockAudioContext();
    const { stream, stopFn } = createMockStream();

    manager.createAudioContext = () => mockCtx as unknown as AudioContext;
    manager.getUserMedia = vi.fn().mockResolvedValue(stream);

    await manager.start();
    expect(audioStore.getState().isAudioActive).toBe(true);

    manager.stop();

    expect(stopFn).toHaveBeenCalled();
    expect(audioStore.getState().isAudioActive).toBe(false);
    // Analyser should be null after stop
    expect(manager.getAnalyser()).toBeNull();
    // But AudioContext state should still be accessible (not closed)
    expect(manager.getState()).toBe('running');
  });

  it('TestAudioContextManager_Destroy', async () => {
    const mockCtx = createMockAudioContext();
    const { stream, stopFn } = createMockStream();

    manager.createAudioContext = () => mockCtx as unknown as AudioContext;
    manager.getUserMedia = vi.fn().mockResolvedValue(stream);

    await manager.start();
    manager.destroy();

    expect(stopFn).toHaveBeenCalled();
    expect(mockCtx.close).toHaveBeenCalled();
    expect(audioStore.getState().isAudioActive).toBe(false);
    expect(audioStore.getState().audioContextState).toBeNull();
    expect(manager.getState()).toBeNull();
  });

  it('TestAudioContextManager_StateChangeUpdatesStore', async () => {
    const mockCtx = createMockAudioContext();
    const { stream } = createMockStream();

    manager.createAudioContext = () => mockCtx as unknown as AudioContext;
    manager.getUserMedia = vi.fn().mockResolvedValue(stream);

    await manager.start();
    expect(audioStore.getState().audioContextState).toBe('running');

    // Simulate context state change
    mockCtx._setState('suspended');
    expect(audioStore.getState().audioContextState).toBe('suspended');
  });

  it('TestAudioContextManager_AudioGraphConnection', async () => {
    const mockCtx = createMockAudioContext();
    const { stream } = createMockStream();
    const mockSource = createMockSourceNode();
    const mockGain = createMockGainNode();
    const mockAnalyser = createMockAnalyser();

    mockCtx.createMediaStreamSource = vi.fn(() => mockSource);
    mockCtx.createGain = vi.fn(() => mockGain);
    mockCtx.createAnalyser = vi.fn(() => mockAnalyser);

    manager.createAudioContext = () => mockCtx as unknown as AudioContext;
    manager.getUserMedia = vi.fn().mockResolvedValue(stream);

    await manager.start();

    // Verify connection chain: source → gain → analyser
    expect(mockSource.connect).toHaveBeenCalledWith(mockGain);
    expect(mockGain.connect).toHaveBeenCalledWith(mockAnalyser);
    // Analyser should NOT be connected to destination (analysis only)
  });
});
