import { audioStore } from '@/stores/audioStore';

/**
 * AudioContextManager — manages the Web Audio API lifecycle for audio analysis.
 *
 * Key design decisions:
 * - AudioContext is created lazily on start() (never on construction)
 * - Audio graph: MediaStreamSource → GainNode → AnalyserNode (no destination)
 * - Not connecting to destination means we analyze audio without playing it back
 * - All state changes are reflected in the Zustand audioStore
 */
export class AudioContextManager {
  private audioContext: AudioContext | null = null;
  private gainNode: GainNode | null = null;
  private analyserNode: AnalyserNode | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private mediaStream: MediaStream | null = null;

  /**
   * Factory for AudioContext creation — overridable for testing.
   */
  createAudioContext: () => AudioContext = () => new AudioContext();

  /**
   * Factory for getUserMedia — overridable for testing.
   */
  getUserMedia: (constraints: MediaStreamConstraints) => Promise<MediaStream> =
    (constraints) => navigator.mediaDevices.getUserMedia(constraints);

  /**
   * Start audio capture and analysis for the given device.
   * Creates AudioContext lazily and resumes if suspended.
   * Builds audio graph: source → gain → analyser.
   *
   * MUST be called from a user gesture handler (click/touch/keydown).
   */
  async start(deviceId?: string): Promise<void> {
    // Create AudioContext lazily
    if (!this.audioContext) {
      this.audioContext = this.createAudioContext();
      this.audioContext.onstatechange = () => {
        audioStore.getState().setAudioContextState(
          (this.audioContext?.state as 'suspended' | 'running' | 'closed') ?? null,
        );
      };
    }

    // Resume if suspended (required by autoplay policy)
    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }

    // Stop existing stream if switching devices
    this.stopStream();

    // Acquire audio stream
    const constraints: MediaStreamConstraints = {
      audio: deviceId ? { deviceId: { exact: deviceId } } : true,
    };
    this.mediaStream = await this.getUserMedia(constraints);

    // Build audio graph: source → gain → analyser
    this.sourceNode = this.audioContext.createMediaStreamSource(this.mediaStream);

    this.gainNode = this.audioContext.createGain();
    this.gainNode.gain.setValueAtTime(
      audioStore.getState().gain,
      this.audioContext.currentTime,
    );

    this.analyserNode = this.audioContext.createAnalyser();
    this.analyserNode.fftSize = 2048;
    this.analyserNode.smoothingTimeConstant = 0.8;

    this.sourceNode.connect(this.gainNode);
    this.gainNode.connect(this.analyserNode);
    // Do NOT connect to destination — analysis only, no playback

    audioStore.getState().setIsAudioActive(true);
    audioStore.getState().setAudioContextState(
      this.audioContext.state as 'suspended' | 'running' | 'closed',
    );
  }

  /**
   * Stop audio capture but keep AudioContext alive for quick restart.
   */
  stop(): void {
    this.stopStream();
    audioStore.getState().setIsAudioActive(false);
  }

  /**
   * Fully destroy the manager — close AudioContext and release all resources.
   */
  destroy(): void {
    this.stopStream();
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close();
    }
    this.audioContext = null;
    audioStore.getState().setIsAudioActive(false);
    audioStore.getState().setAudioContextState(null);
  }

  /**
   * Adjust gain (sensitivity multiplier) in real time.
   */
  setGain(value: number): void {
    if (this.gainNode && this.audioContext) {
      this.gainNode.gain.setValueAtTime(value, this.audioContext.currentTime);
    }
  }

  /**
   * Get the AnalyserNode for reading FFT data. Returns null if not started.
   */
  getAnalyser(): AnalyserNode | null {
    return this.analyserNode;
  }

  /**
   * Get the current AudioContext state.
   */
  getState(): AudioContextState | null {
    return this.audioContext?.state ?? null;
  }

  /**
   * Stop the media stream and disconnect audio nodes without closing the context.
   */
  private stopStream(): void {
    if (this.sourceNode) {
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }
    if (this.gainNode) {
      this.gainNode.disconnect();
      this.gainNode = null;
    }
    this.analyserNode = null;

    if (this.mediaStream) {
      for (const track of this.mediaStream.getTracks()) {
        track.stop();
      }
      this.mediaStream = null;
    }
  }
}
