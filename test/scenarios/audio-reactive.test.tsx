import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AudioControls } from '@/control/AudioControls';
import { audioStore } from '@/stores/audioStore';

// Mock audio plugin singleton
const mockDevices = [
  { deviceId: 'mic-1', kind: 'audioinput' as MediaDeviceKind, label: 'Built-in Mic', groupId: 'g1', toJSON: () => ({}) },
  { deviceId: 'bh-2', kind: 'audioinput' as MediaDeviceKind, label: 'BlackHole 2ch', groupId: 'g2', toJSON: () => ({}) },
  { deviceId: 'bh-16', kind: 'audioinput' as MediaDeviceKind, label: 'BlackHole 16ch', groupId: 'g3', toJSON: () => ({}) },
];

const mockGetDevices = vi.fn(async () => {
  audioStore.getState().setDevices(mockDevices as unknown as MediaDeviceInfo[]);
  return mockDevices;
});
const mockStartAudio = vi.fn(async () => {
  audioStore.getState().setIsAudioActive(true);
  audioStore.getState().setAudioContextState('running');
});
const mockStopAudio = vi.fn(() => {
  audioStore.getState().setIsAudioActive(false);
  audioStore.getState().setAudioContextState(null);
});
const mockSetGain = vi.fn((value: number) => {
  audioStore.getState().setGain(value);
});

vi.mock('@/plugins/inputs/audioSingleton', () => ({
  audioPlugin: {
    getDevices: (...args: unknown[]) => mockGetDevices(...args),
    startAudio: (...args: unknown[]) => mockStartAudio(...args),
    stopAudio: (...args: unknown[]) => mockStopAudio(...args),
    setGain: (...args: unknown[]) => mockSetGain(...args),
  },
}));

describe('Audio-Reactive User Scenarios', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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

  it('TestScenario_EnableAudio_EnumeratesDevicesAndStarts', async () => {
    render(<AudioControls />);

    // Initially shows enable button and no devices
    expect(screen.getByRole('button', { name: 'Enable Audio' })).toBeInTheDocument();
    expect(screen.getByText('Audio not initialized')).toBeInTheDocument();

    // Click enable
    await userEvent.click(screen.getByRole('button', { name: 'Enable Audio' }));

    // Should enumerate devices then start audio
    await waitFor(() => {
      expect(mockGetDevices).toHaveBeenCalled();
      expect(mockStartAudio).toHaveBeenCalled();
    });

    // UI should update to show active state
    await waitFor(() => {
      expect(screen.getByText('Audio active')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Stop Audio' })).toBeInTheDocument();
    });

    // Device dropdown should now show devices
    const options = screen.getAllByRole('option');
    expect(options.length).toBe(4); // Default + 3 devices
    expect(options[1].textContent).toBe('Built-in Mic');
    expect(options[2].textContent).toBe('BlackHole 2ch');
    expect(options[3].textContent).toBe('BlackHole 16ch');
  });

  it('TestScenario_SwitchAudioDevice', async () => {
    // Start with audio already active and devices listed
    audioStore.setState({
      devices: mockDevices as unknown as MediaDeviceInfo[],
      isAudioActive: true,
      audioContextState: 'running',
    });

    render(<AudioControls />);

    // Change device to BlackHole
    const select = screen.getByLabelText('Audio Source') as HTMLSelectElement;
    await userEvent.selectOptions(select, 'bh-2');

    // Should restart audio with new device
    await waitFor(() => {
      expect(audioStore.getState().selectedDeviceId).toBe('bh-2');
      expect(mockStartAudio).toHaveBeenCalledWith('bh-2');
    });
  });

  it('TestScenario_StopAudio', async () => {
    audioStore.setState({
      isAudioActive: true,
      audioContextState: 'running',
    });

    render(<AudioControls />);

    // Click stop
    await userEvent.click(screen.getByRole('button', { name: 'Stop Audio' }));

    expect(mockStopAudio).toHaveBeenCalled();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Enable Audio' })).toBeInTheDocument();
      expect(screen.getByText('Audio not initialized')).toBeInTheDocument();
    });
  });

  it('TestScenario_SwitchVisualizationMode', async () => {
    render(<AudioControls />);

    // Default is spectrum
    expect(audioStore.getState().visualizationMode).toBe('spectrum');

    // Switch to energy
    await userEvent.click(screen.getByRole('button', { name: 'Energy' }));
    expect(audioStore.getState().visualizationMode).toBe('energy');

    // Switch to waveform
    await userEvent.click(screen.getByRole('button', { name: 'Waveform' }));
    expect(audioStore.getState().visualizationMode).toBe('waveform');

    // Back to spectrum
    await userEvent.click(screen.getByRole('button', { name: 'Spectrum' }));
    expect(audioStore.getState().visualizationMode).toBe('spectrum');
  });

  it('TestScenario_FullWorkflow_EnableAdjustStop', async () => {
    render(<AudioControls />);

    // Step 1: Enable audio
    await userEvent.click(screen.getByRole('button', { name: 'Enable Audio' }));

    await waitFor(() => {
      expect(screen.getByText('Audio active')).toBeInTheDocument();
    });

    // Step 2: Switch to energy mode
    await userEvent.click(screen.getByRole('button', { name: 'Energy' }));
    expect(audioStore.getState().visualizationMode).toBe('energy');

    // Step 3: Select BlackHole device
    const select = screen.getByLabelText('Audio Source') as HTMLSelectElement;
    await userEvent.selectOptions(select, 'bh-16');
    expect(audioStore.getState().selectedDeviceId).toBe('bh-16');

    // Step 4: Stop audio
    await userEvent.click(screen.getByRole('button', { name: 'Stop Audio' }));
    expect(mockStopAudio).toHaveBeenCalled();
  });
});
