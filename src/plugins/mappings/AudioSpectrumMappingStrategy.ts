import type { MappingStrategy, FrameData } from '@/core/pipeline/types';
import { audioStore } from '@/stores/audioStore';
import { DEFAULT_LED_COUNT, EDGE_COUNT, EDGE_LED_COUNTS, getEdgeStartIndex } from '@/core/constants';

const LED_COUNT = DEFAULT_LED_COUNT;
// 12 edges on the cube, one spectral band per edge
const SAMPLE_RATE = 44100;
const BIN_COUNT = 1024; // fftSize=2048 → 1024 bins
const NUM_BANDS = EDGE_COUNT; // One per edge

/**
 * Convert HSL (h: 0-360, s: 0-1, l: 0-1) to RGB (each 0-255).
 */
export function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;

  let r1: number, g1: number, b1: number;
  if (h < 60) { r1 = c; g1 = x; b1 = 0; }
  else if (h < 120) { r1 = x; g1 = c; b1 = 0; }
  else if (h < 180) { r1 = 0; g1 = c; b1 = x; }
  else if (h < 240) { r1 = 0; g1 = x; b1 = c; }
  else if (h < 300) { r1 = x; g1 = 0; b1 = c; }
  else { r1 = c; g1 = 0; b1 = x; }

  return [
    Math.round((r1 + m) * 255),
    Math.round((g1 + m) * 255),
    Math.round((b1 + m) * 255),
  ];
}

/**
 * Convert frequency in Hz to mel scale.
 */
export function freqToMel(hz: number): number {
  return 2595 * Math.log10(1 + hz / 700);
}

/**
 * Convert mel scale value back to Hz.
 */
export function melToFreq(mel: number): number {
  return 700 * (Math.pow(10, mel / 2595) - 1);
}

/**
 * Build mel-scaled band boundaries.
 * Returns an array of [startBin, endBin] pairs for each band.
 */
export function buildMelBands(
  binCount: number,
  sampleRate: number,
  numBands: number,
): [number, number][] {
  const maxFreq = sampleRate / 2;
  const maxMel = freqToMel(maxFreq);
  const minMel = freqToMel(20); // Start from 20 Hz (audible range)

  const melStep = (maxMel - minMel) / numBands;
  const bands: [number, number][] = [];

  for (let i = 0; i < numBands; i++) {
    const melStart = minMel + i * melStep;
    const melEnd = minMel + (i + 1) * melStep;
    const freqStart = melToFreq(melStart);
    const freqEnd = melToFreq(melEnd);

    const binStart = Math.max(0, Math.round((freqStart / maxFreq) * binCount));
    const binEnd = Math.min(binCount - 1, Math.round((freqEnd / maxFreq) * binCount));

    bands.push([binStart, binEnd]);
  }

  return bands;
}

/**
 * AudioSpectrumMappingStrategy — converts FFT spectrum data to 224 LED RGB values.
 *
 * Supports three visualization modes:
 * - spectrum: 12 mel-scaled frequency bands mapped to 12 edges (19 or 18 LEDs each)
 * - energy: Overall audio energy drives all LEDs with color from dominant frequency
 * - waveform: Spectrum bins mapped linearly across all 224 LEDs
 *
 * No allocations in the map() hot path — all buffers are pre-allocated.
 */
export class AudioSpectrumMappingStrategy implements MappingStrategy {
  readonly id = 'audio-spectrum';

  /** Pre-allocated output buffer: LED_COUNT * 3 RGB bytes */
  private outputBuffer: Uint8Array;
  /** Pre-computed mel band boundaries: [startBin, endBin] per band */
  private melBands: [number, number][];
  /** Smoothed band amplitudes for temporal smoothing */
  private smoothedBands: Float32Array;
  /** Smoothing factor (lower = more responsive, higher = smoother) */
  private readonly smoothAlpha = 0.3;

  constructor() {
    this.outputBuffer = new Uint8Array(LED_COUNT * 3);
    this.melBands = buildMelBands(BIN_COUNT, SAMPLE_RATE, NUM_BANDS);
    this.smoothedBands = new Float32Array(NUM_BANDS);
  }

  map(frame: FrameData, ledCount: number): Uint8Array {
    // Ensure output buffer is correct size
    if (this.outputBuffer.length !== ledCount * 3) {
      this.outputBuffer = new Uint8Array(ledCount * 3);
    }

    // No spectrum data → all black
    if (!frame.spectrum) {
      this.outputBuffer.fill(0);
      return this.outputBuffer;
    }

    const { visualizationMode, sensitivity } = audioStore.getState();
    const spectrum = frame.spectrum;
    const threshold = sensitivity / 255;

    switch (visualizationMode) {
      case 'spectrum':
        this.mapSpectrum(spectrum, threshold);
        break;
      case 'energy':
        this.mapEnergy(spectrum, threshold);
        break;
      case 'waveform':
        this.mapWaveform(spectrum, threshold);
        break;
    }

    return this.outputBuffer;
  }

  /**
   * Spectrum mode: 12 mel-scaled frequency bands -> 12 edges.
   * Each edge gets a unique hue based on band index, brightness from amplitude.
   */
  private mapSpectrum(spectrum: Float32Array, threshold: number): void {
    for (let band = 0; band < NUM_BANDS; band++) {
      const [startBin, endBin] = this.melBands[band];

      // Average amplitude across bins in this band
      let sum = 0;
      let count = 0;
      for (let bin = startBin; bin <= endBin; bin++) {
        const val = spectrum[bin] ?? 0;
        const thresholded = val > threshold ? val : 0;
        sum += thresholded;
        count++;
      }
      const rawAmplitude = count > 0 ? sum / count : 0;

      // Temporal smoothing
      this.smoothedBands[band] =
        this.smoothAlpha * rawAmplitude +
        (1 - this.smoothAlpha) * this.smoothedBands[band];

      const amplitude = this.smoothedBands[band];

      // Gamma correction for perceptual brightness
      const brightness = Math.pow(amplitude, 2.2);

      // Hue: rainbow across bands (0=red, 2=yellow, 4=green, 8=blue, 11=violet)
      const hue = (band / NUM_BANDS) * 300; // 0-300 degrees (skip back to red)
      const [r, g, b] = hslToRgb(hue, 1.0, brightness * 0.5);

      // Write to all LEDs on this edge (variable count per edge)
      const edgeStart = getEdgeStartIndex(band) * 3;
      const ledsOnEdge = EDGE_LED_COUNTS[band];
      for (let led = 0; led < ledsOnEdge; led++) {
        const offset = edgeStart + led * 3;
        this.outputBuffer[offset] = r;
        this.outputBuffer[offset + 1] = g;
        this.outputBuffer[offset + 2] = b;
      }
    }
  }

  /**
   * Energy mode: Overall energy drives brightness, dominant frequency drives hue.
   * All LEDs get the same color.
   */
  private mapEnergy(spectrum: Float32Array, threshold: number): void {
    let totalEnergy = 0;
    let maxBinValue = 0;
    let maxBinIndex = 0;

    for (let i = 0; i < spectrum.length; i++) {
      const val = spectrum[i] > threshold ? spectrum[i] : 0;
      totalEnergy += val;
      if (val > maxBinValue) {
        maxBinValue = val;
        maxBinIndex = i;
      }
    }

    const avgEnergy = totalEnergy / spectrum.length;
    const brightness = Math.pow(Math.min(1, avgEnergy * 2), 2.2);

    // Hue from dominant frequency position
    const hue = (maxBinIndex / spectrum.length) * 300;
    const [r, g, b] = hslToRgb(hue, 1.0, brightness * 0.5);

    for (let i = 0; i < this.outputBuffer.length; i += 3) {
      this.outputBuffer[i] = r;
      this.outputBuffer[i + 1] = g;
      this.outputBuffer[i + 2] = b;
    }
  }

  /**
   * Waveform mode: Spectrum bins mapped linearly across all LEDs.
   * Color from position (hue), brightness from amplitude.
   */
  private mapWaveform(spectrum: Float32Array, threshold: number): void {
    const ledCount = this.outputBuffer.length / 3;

    for (let led = 0; led < ledCount; led++) {
      // Map LED index to spectrum bin (linear interpolation)
      const binFloat = (led / ledCount) * spectrum.length;
      const binLow = Math.floor(binFloat);
      const binHigh = Math.min(binLow + 1, spectrum.length - 1);
      const frac = binFloat - binLow;

      // Interpolate between adjacent bins
      const rawVal =
        spectrum[binLow] * (1 - frac) + spectrum[binHigh] * frac;
      const val = rawVal > threshold ? rawVal : 0;

      const brightness = Math.pow(val, 2.2);
      const hue = (led / ledCount) * 300;
      const [r, g, b] = hslToRgb(hue, 1.0, brightness * 0.5);

      const offset = led * 3;
      this.outputBuffer[offset] = r;
      this.outputBuffer[offset + 1] = g;
      this.outputBuffer[offset + 2] = b;
    }
  }
}
