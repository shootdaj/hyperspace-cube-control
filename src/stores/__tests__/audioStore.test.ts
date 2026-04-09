import { describe, it, expect, beforeEach } from 'vitest';
import { audioStore } from '../audioStore';

describe('audioStore', () => {
  beforeEach(() => {
    // Reset to defaults
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

  it('TestAudioStore_DefaultState', () => {
    const state = audioStore.getState();
    expect(state.devices).toEqual([]);
    expect(state.selectedDeviceId).toBeNull();
    expect(state.isAudioActive).toBe(false);
    expect(state.audioContextState).toBeNull();
    expect(state.gain).toBe(1.0);
    expect(state.sensitivity).toBe(128);
    expect(state.visualizationMode).toBe('spectrum');
  });

  it('TestAudioStore_SetDevices', () => {
    const mockDevices = [
      { deviceId: 'mic-1', kind: 'audioinput', label: 'Microphone', groupId: 'g1' },
      { deviceId: 'bh-2', kind: 'audioinput', label: 'BlackHole 2ch', groupId: 'g2' },
    ] as MediaDeviceInfo[];

    audioStore.getState().setDevices(mockDevices);
    expect(audioStore.getState().devices).toHaveLength(2);
    expect(audioStore.getState().devices[0].label).toBe('Microphone');
  });

  it('TestAudioStore_SetSelectedDeviceId', () => {
    audioStore.getState().setSelectedDeviceId('device-123');
    expect(audioStore.getState().selectedDeviceId).toBe('device-123');
  });

  it('TestAudioStore_SetIsAudioActive', () => {
    audioStore.getState().setIsAudioActive(true);
    expect(audioStore.getState().isAudioActive).toBe(true);
  });

  it('TestAudioStore_SetAudioContextState', () => {
    audioStore.getState().setAudioContextState('running');
    expect(audioStore.getState().audioContextState).toBe('running');
  });

  it('TestAudioStore_SetGain_ClampsToRange', () => {
    audioStore.getState().setGain(3.5);
    expect(audioStore.getState().gain).toBe(3.5);

    audioStore.getState().setGain(-1);
    expect(audioStore.getState().gain).toBe(0);

    audioStore.getState().setGain(10);
    expect(audioStore.getState().gain).toBe(5);
  });

  it('TestAudioStore_SetSensitivity_ClampsToRange', () => {
    audioStore.getState().setSensitivity(200);
    expect(audioStore.getState().sensitivity).toBe(200);

    audioStore.getState().setSensitivity(-10);
    expect(audioStore.getState().sensitivity).toBe(0);

    audioStore.getState().setSensitivity(300);
    expect(audioStore.getState().sensitivity).toBe(255);
  });

  it('TestAudioStore_SetSensitivity_RoundsToInteger', () => {
    audioStore.getState().setSensitivity(128.7);
    expect(audioStore.getState().sensitivity).toBe(129);
  });

  it('TestAudioStore_SetVisualizationMode', () => {
    audioStore.getState().setVisualizationMode('energy');
    expect(audioStore.getState().visualizationMode).toBe('energy');

    audioStore.getState().setVisualizationMode('waveform');
    expect(audioStore.getState().visualizationMode).toBe('waveform');

    audioStore.getState().setVisualizationMode('spectrum');
    expect(audioStore.getState().visualizationMode).toBe('spectrum');
  });
});
