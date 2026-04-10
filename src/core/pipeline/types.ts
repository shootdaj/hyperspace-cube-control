/**
 * Payload produced by an InputPlugin each tick.
 * The 'type' field determines which payload fields are populated.
 */
export interface FrameData {
  type: 'direct' | 'video' | 'audio' | 'midi';
  /** 'direct': ledCount*3 RGB bytes (flat array, index i -> [r, g, b] at i*3, i*3+1, i*3+2) */
  leds?: Uint8Array;
  /** 'video': OffscreenCanvas with current frame drawn -- MappingStrategy samples from this */
  canvas?: OffscreenCanvas;
  /** 'audio': FFT frequency bins as Float32Array from AnalyserNode */
  spectrum?: Float32Array;
  /** 'midi': CC number (0-127) -> value (0-127) map */
  midiCC?: Map<number, number>;
}

/**
 * Context injected into plugins at initialize() time.
 */
export interface PluginContext {
  /** Number of LEDs in the cube -- 224 for HyperCube 15-SE */
  ledCount: number;
  /** Target pipeline frame rate */
  frameRate: number;
}

/**
 * Any input source (manual paint, audio, MIDI, video, camera) implements this.
 * The pipeline calls tick() each frame and routes FrameData through the active MappingStrategy.
 */
export interface InputPlugin {
  readonly id: string;
  readonly name: string;
  initialize(context: PluginContext): Promise<void>;
  /** Called every pipeline tick. Returns null if no new data this frame. */
  tick(deltaMs: number): FrameData | null;
  destroy(): void;
}

/**
 * Converts a FrameData payload into a flat ledCount*3 RGB byte array.
 * Stateless -- must produce the same output for the same input.
 */
export interface MappingStrategy {
  readonly id: string;
  /** @returns Uint8Array of length ledCount*3 (RGB per LED) */
  map(frame: FrameData, ledCount: number): Uint8Array;
}

/**
 * Sends the final LED state to a physical device or other consumer.
 * Called once per pipeline tick after MappingStrategy.map().
 */
export interface OutputPlugin {
  readonly id: string;
  /** @param leds - Uint8Array of length ledCount*3 RGB bytes */
  send(leds: Uint8Array, brightness: number): void;
  destroy(): void;
}

/**
 * Factory function type for creating plugin instances.
 * Used by PluginRegistry to instantiate plugins by ID.
 */
export type PluginFactory<T> = () => T;
