import type { InputPlugin, FrameData, PluginContext } from '@/core/pipeline/types';
import { AudioContextManager } from './AudioContextManager';
import { requestPermissionAndEnumerate } from './audioDeviceService';
import { audioStore } from '@/stores/audioStore';

/**
 * AudioPlugin — InputPlugin for real-time audio-reactive LED control.
 *
 * Wraps AudioContextManager and reads FFT data each tick. Returns FrameData
 * with type='audio' and a normalized spectrum (Float32Array, values 0.0-1.0).
 *
 * The plugin does NOT create an AudioContext on construction — call startAudio()
 * from a user gesture handler to initialize.
 */
export class AudioPlugin implements InputPlugin {
  readonly id = 'audio-reactive';
  readonly name = 'Audio Reactive';

  private manager: AudioContextManager;
  /** Reusable buffer for raw byte frequency data from AnalyserNode */
  private frequencyData: Uint8Array = new Uint8Array(1024);
  /** Reusable buffer for normalized 0.0-1.0 spectrum output */
  private spectrumData: Float32Array = new Float32Array(1024);

  constructor(manager?: AudioContextManager) {
    this.manager = manager ?? new AudioContextManager();
  }

  async initialize(_ctx: PluginContext): Promise<void> {
    // Buffers are pre-allocated in the constructor.
    // AudioContext is NOT created here — must be triggered by user gesture via startAudio().
  }

  /**
   * Called every pipeline tick. Reads FFT data from the AnalyserNode and
   * returns normalized spectrum as FrameData.
   *
   * Returns null if audio is not started (no analyser available).
   * Zero allocations in this method — reuses pre-allocated buffers.
   */
  tick(_deltaMs: number): FrameData | null {
    const analyser = this.manager.getAnalyser();
    if (!analyser) return null;

    // Read raw byte frequency data (0-255)
    analyser.getByteFrequencyData(this.frequencyData);

    // Normalize to 0.0-1.0
    for (let i = 0; i < this.frequencyData.length; i++) {
      this.spectrumData[i] = this.frequencyData[i] / 255;
    }

    return { type: 'audio', spectrum: this.spectrumData };
  }

  /**
   * Start audio capture for the given device.
   * MUST be called from a user gesture handler.
   */
  async startAudio(deviceId?: string): Promise<void> {
    await this.manager.start(deviceId);
  }

  /**
   * Stop audio capture (releases stream but keeps AudioContext alive).
   */
  stopAudio(): void {
    this.manager.stop();
  }

  /**
   * Adjust gain (sensitivity multiplier).
   */
  setGain(value: number): void {
    this.manager.setGain(value);
    audioStore.getState().setGain(value);
  }

  /**
   * Enumerate audio input devices (requests permission if needed).
   * Updates audioStore.devices.
   */
  async getDevices(): Promise<MediaDeviceInfo[]> {
    const devices = await requestPermissionAndEnumerate();
    audioStore.getState().setDevices(devices);
    return devices;
  }

  /**
   * Get the underlying AudioContextManager (for advanced use / testing).
   */
  getManager(): AudioContextManager {
    return this.manager;
  }

  destroy(): void {
    this.manager.destroy();
  }
}
