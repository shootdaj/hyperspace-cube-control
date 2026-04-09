import { create } from 'zustand';

type PermissionState = 'prompt' | 'granted' | 'denied' | null;

interface CameraState {
  /** Whether camera is actively capturing */
  isActive: boolean;
  /** Available camera devices */
  devices: MediaDeviceInfo[];
  /** Selected device ID (null = default) */
  selectedDeviceId: string | null;
  /** Camera permission state */
  permissionState: PermissionState;
  /** Error message for display */
  error: string | null;
  /** Motion sensitivity (0-255, higher = more sensitive) */
  sensitivity: number;
  /** Current motion level (0-1, 0 = no motion, 1 = all pixels moving) */
  motionLevel: number;

  setIsActive: (active: boolean) => void;
  setDevices: (devices: MediaDeviceInfo[]) => void;
  setSelectedDeviceId: (id: string | null) => void;
  setPermissionState: (state: PermissionState) => void;
  setError: (error: string | null) => void;
  setSensitivity: (sensitivity: number) => void;
  setMotionLevel: (level: number) => void;
  reset: () => void;
}

const initialState = {
  isActive: false,
  devices: [] as MediaDeviceInfo[],
  selectedDeviceId: null as string | null,
  permissionState: null as PermissionState,
  error: null as string | null,
  sensitivity: 128,
  motionLevel: 0,
};

export const cameraStore = create<CameraState>((set) => ({
  ...initialState,

  setIsActive: (active) => set({ isActive: active }),
  setDevices: (devices) => set({ devices }),
  setSelectedDeviceId: (id) => set({ selectedDeviceId: id }),
  setPermissionState: (state) => set({ permissionState: state }),
  setError: (error) => set({ error }),
  setSensitivity: (sensitivity) =>
    set({ sensitivity: Math.max(0, Math.min(255, Math.round(sensitivity))) }),
  setMotionLevel: (level) => set({ motionLevel: Math.max(0, Math.min(1, level)) }),
  reset: () => set(initialState),
}));
