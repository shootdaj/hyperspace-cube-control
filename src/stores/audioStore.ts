import { create } from 'zustand';

export type VisualizationMode = 'spectrum' | 'energy' | 'waveform';

interface AudioState {
  /** Available audio input devices */
  devices: MediaDeviceInfo[];
  /** Selected device ID (null = default) */
  selectedDeviceId: string | null;
  /** Whether audio capture is actively running */
  isAudioActive: boolean;
  /** Current AudioContext state */
  audioContextState: 'suspended' | 'running' | 'closed' | null;
  /** Gain multiplier (0.0 to 5.0) */
  gain: number;
  /** Sensitivity threshold (0-255). Bins below this are zeroed. */
  sensitivity: number;
  /** LED visualization mode */
  visualizationMode: VisualizationMode;

  setDevices: (devices: MediaDeviceInfo[]) => void;
  setSelectedDeviceId: (id: string | null) => void;
  setIsAudioActive: (active: boolean) => void;
  setAudioContextState: (state: 'suspended' | 'running' | 'closed' | null) => void;
  setGain: (gain: number) => void;
  setSensitivity: (sensitivity: number) => void;
  setVisualizationMode: (mode: VisualizationMode) => void;
}

export const audioStore = create<AudioState>((set) => ({
  devices: [],
  selectedDeviceId: null,
  isAudioActive: false,
  audioContextState: null,
  gain: 1.0,
  sensitivity: 128,
  visualizationMode: 'spectrum',

  setDevices: (devices) => set({ devices }),
  setSelectedDeviceId: (id) => set({ selectedDeviceId: id }),
  setIsAudioActive: (active) => set({ isAudioActive: active }),
  setAudioContextState: (state) => set({ audioContextState: state }),
  setGain: (gain) => set({ gain: Math.max(0, Math.min(5, gain)) }),
  setSensitivity: (sensitivity) =>
    set({ sensitivity: Math.max(0, Math.min(255, Math.round(sensitivity))) }),
  setVisualizationMode: (mode) => set({ visualizationMode: mode }),
}));
