import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { enumerateAudioInputs, requestPermissionAndEnumerate } from '../audioDeviceService';

const mockMicDevice = {
  deviceId: 'mic-1',
  kind: 'audioinput' as MediaDeviceKind,
  label: 'Built-in Microphone',
  groupId: 'group-1',
  toJSON: () => ({}),
};

const mockBlackHole = {
  deviceId: 'bh-2ch',
  kind: 'audioinput' as MediaDeviceKind,
  label: 'BlackHole 2ch',
  groupId: 'group-2',
  toJSON: () => ({}),
};

const mockVideoInput = {
  deviceId: 'cam-1',
  kind: 'videoinput' as MediaDeviceKind,
  label: 'FaceTime Camera',
  groupId: 'group-3',
  toJSON: () => ({}),
};

const mockAudioOutput = {
  deviceId: 'out-1',
  kind: 'audiooutput' as MediaDeviceKind,
  label: 'Built-in Speakers',
  groupId: 'group-4',
  toJSON: () => ({}),
};

describe('audioDeviceService', () => {
  const originalMediaDevices = navigator.mediaDevices;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    Object.defineProperty(navigator, 'mediaDevices', {
      value: originalMediaDevices,
      configurable: true,
    });
  });

  describe('enumerateAudioInputs', () => {
    it('TestEnumerateAudioInputs_FiltersOnlyAudioInput', async () => {
      Object.defineProperty(navigator, 'mediaDevices', {
        value: {
          enumerateDevices: vi.fn().mockResolvedValue([
            mockMicDevice,
            mockBlackHole,
            mockVideoInput,
            mockAudioOutput,
          ]),
        },
        configurable: true,
      });

      const devices = await enumerateAudioInputs();
      expect(devices).toHaveLength(2);
      expect(devices[0].label).toBe('Built-in Microphone');
      expect(devices[1].label).toBe('BlackHole 2ch');
    });

    it('TestEnumerateAudioInputs_ReturnsEmptyWhenNoMediaDevices', async () => {
      Object.defineProperty(navigator, 'mediaDevices', {
        value: undefined,
        configurable: true,
      });

      const devices = await enumerateAudioInputs();
      expect(devices).toEqual([]);
    });

    it('TestEnumerateAudioInputs_ReturnsEmptyWhenNoAudioInputs', async () => {
      Object.defineProperty(navigator, 'mediaDevices', {
        value: {
          enumerateDevices: vi.fn().mockResolvedValue([mockVideoInput, mockAudioOutput]),
        },
        configurable: true,
      });

      const devices = await enumerateAudioInputs();
      expect(devices).toEqual([]);
    });
  });

  describe('requestPermissionAndEnumerate', () => {
    it('TestRequestPermission_CallsGetUserMedia_ThenEnumerates', async () => {
      const mockStop = vi.fn();
      const mockStream = {
        getTracks: () => [{ stop: mockStop }, { stop: mockStop }],
      };
      const mockGetUserMedia = vi.fn().mockResolvedValue(mockStream);
      const mockEnumerate = vi.fn().mockResolvedValue([
        mockMicDevice,
        mockBlackHole,
        mockVideoInput,
      ]);

      Object.defineProperty(navigator, 'mediaDevices', {
        value: {
          getUserMedia: mockGetUserMedia,
          enumerateDevices: mockEnumerate,
        },
        configurable: true,
      });

      const devices = await requestPermissionAndEnumerate();

      // Should have requested audio permission
      expect(mockGetUserMedia).toHaveBeenCalledWith({ audio: true });
      // Should have stopped temp stream tracks
      expect(mockStop).toHaveBeenCalledTimes(2);
      // Should return only audio inputs
      expect(devices).toHaveLength(2);
    });

    it('TestRequestPermission_ReturnsEmptyWhenNoGetUserMedia', async () => {
      Object.defineProperty(navigator, 'mediaDevices', {
        value: { enumerateDevices: vi.fn() },
        configurable: true,
      });

      const devices = await requestPermissionAndEnumerate();
      expect(devices).toEqual([]);
    });
  });
});
