import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AudioControls } from '../AudioControls';
import { audioStore } from '@/stores/audioStore';

// Mock the audio plugin singleton
const mockGetDevices = vi.fn().mockResolvedValue([
  { deviceId: 'mic-1', kind: 'audioinput', label: 'Built-in Mic', groupId: 'g1', toJSON: () => ({}) },
  { deviceId: 'bh-2', kind: 'audioinput', label: 'BlackHole 2ch', groupId: 'g2', toJSON: () => ({}) },
]);
const mockStartAudio = vi.fn().mockResolvedValue(undefined);
const mockStopAudio = vi.fn();
const mockSetGain = vi.fn();

vi.mock('@/plugins/inputs/audioSingleton', () => ({
  audioPlugin: {
    getDevices: (...args: unknown[]) => mockGetDevices(...args),
    startAudio: (...args: unknown[]) => mockStartAudio(...args),
    stopAudio: (...args: unknown[]) => mockStopAudio(...args),
    setGain: (...args: unknown[]) => mockSetGain(...args),
  },
}));

describe('AudioControls', () => {
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

  it('TestAudioControls_RendersEnableButton', () => {
    render(<AudioControls />);
    expect(screen.getByRole('button', { name: 'Enable Audio' })).toBeInTheDocument();
  });

  it('TestAudioControls_RendersStopButtonWhenActive', () => {
    audioStore.setState({ isAudioActive: true, audioContextState: 'running' });
    render(<AudioControls />);
    expect(screen.getByRole('button', { name: 'Stop Audio' })).toBeInTheDocument();
  });

  it('TestAudioControls_EnableAudioTriggersStartFlow', async () => {
    render(<AudioControls />);

    const enableBtn = screen.getByRole('button', { name: 'Enable Audio' });
    await userEvent.click(enableBtn);

    await waitFor(() => {
      expect(mockGetDevices).toHaveBeenCalled();
      expect(mockStartAudio).toHaveBeenCalled();
    });
  });

  it('TestAudioControls_StopAudioTriggersStop', async () => {
    audioStore.setState({ isAudioActive: true, audioContextState: 'running' });
    render(<AudioControls />);

    const stopBtn = screen.getByRole('button', { name: 'Stop Audio' });
    await userEvent.click(stopBtn);

    expect(mockStopAudio).toHaveBeenCalled();
  });

  it('TestAudioControls_DeviceDropdown_ShowsDefault', () => {
    render(<AudioControls />);
    const select = screen.getByLabelText('Audio Source') as HTMLSelectElement;
    expect(select).toBeInTheDocument();
    expect(select.value).toBe('');
  });

  it('TestAudioControls_DeviceDropdown_ShowsEnumeratedDevices', () => {
    audioStore.setState({
      devices: [
        { deviceId: 'mic-1', kind: 'audioinput', label: 'Built-in Mic', groupId: 'g1', toJSON: () => ({}) },
        { deviceId: 'bh-2', kind: 'audioinput', label: 'BlackHole 2ch', groupId: 'g2', toJSON: () => ({}) },
      ] as MediaDeviceInfo[],
    });

    render(<AudioControls />);
    const options = screen.getAllByRole('option');
    // Default + 2 devices = 3 options
    expect(options.length).toBe(3);
    expect(options[1].textContent).toBe('Built-in Mic');
    expect(options[2].textContent).toBe('BlackHole 2ch');
  });

  it('TestAudioControls_DeviceChange_UpdatesStore', async () => {
    audioStore.setState({
      devices: [
        { deviceId: 'mic-1', kind: 'audioinput', label: 'Built-in Mic', groupId: 'g1', toJSON: () => ({}) },
      ] as MediaDeviceInfo[],
    });

    render(<AudioControls />);
    const select = screen.getByLabelText('Audio Source') as HTMLSelectElement;

    fireEvent.change(select, { target: { value: 'mic-1' } });
    expect(audioStore.getState().selectedDeviceId).toBe('mic-1');
  });

  it('TestAudioControls_VisualizationModeButtons', async () => {
    render(<AudioControls />);

    // Default should be spectrum
    expect(audioStore.getState().visualizationMode).toBe('spectrum');

    // Click energy
    await userEvent.click(screen.getByRole('button', { name: 'Energy' }));
    expect(audioStore.getState().visualizationMode).toBe('energy');

    // Click waveform
    await userEvent.click(screen.getByRole('button', { name: 'Waveform' }));
    expect(audioStore.getState().visualizationMode).toBe('waveform');

    // Click spectrum
    await userEvent.click(screen.getByRole('button', { name: 'Spectrum' }));
    expect(audioStore.getState().visualizationMode).toBe('spectrum');
  });

  it('TestAudioControls_StatusIndicator_NotInitialized', () => {
    render(<AudioControls />);
    expect(screen.getByText('Audio not initialized')).toBeInTheDocument();
  });

  it('TestAudioControls_StatusIndicator_Running', () => {
    audioStore.setState({ audioContextState: 'running', isAudioActive: true });
    render(<AudioControls />);
    expect(screen.getByText('Audio active')).toBeInTheDocument();
  });

  it('TestAudioControls_StatusIndicator_Suspended', () => {
    audioStore.setState({ audioContextState: 'suspended' });
    render(<AudioControls />);
    expect(screen.getByText(/Audio suspended/)).toBeInTheDocument();
  });

  it('TestAudioControls_GainDisplay', () => {
    audioStore.setState({ gain: 2.5 });
    render(<AudioControls />);
    expect(screen.getByText('2.5x')).toBeInTheDocument();
  });

  it('TestAudioControls_SensitivityDisplay', () => {
    audioStore.setState({ sensitivity: 200 });
    render(<AudioControls />);
    expect(screen.getByText('200')).toBeInTheDocument();
  });

  it('TestAudioControls_AllTouchTargetsMinHeight', () => {
    audioStore.setState({
      devices: [
        { deviceId: 'mic-1', kind: 'audioinput', label: 'Mic', groupId: 'g1', toJSON: () => ({}) },
      ] as MediaDeviceInfo[],
    });

    render(<AudioControls />);

    // Check that buttons have min-h-11 class
    const buttons = screen.getAllByRole('button');
    buttons.forEach((btn) => {
      expect(btn.className).toContain('min-h-11');
    });

    // Check select has min-h-11
    const select = screen.getByLabelText('Audio Source');
    expect(select.className).toContain('min-h-11');
  });
});
