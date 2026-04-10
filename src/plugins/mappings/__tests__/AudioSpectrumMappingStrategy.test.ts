import { describe, it, expect, beforeEach } from 'vitest';
import {
  AudioSpectrumMappingStrategy,
  hslToRgb,
  freqToMel,
  melToFreq,
  buildMelBands,
} from '../AudioSpectrumMappingStrategy';
import type { FrameData } from '@/core/pipeline/types';
import { audioStore } from '@/stores/audioStore';
import { DEFAULT_LED_COUNT, EDGE_LED_COUNTS, getEdgeStartIndex } from '@/core/constants';

const LED = DEFAULT_LED_COUNT;

describe('hslToRgb', () => {
  it('TestHslToRgb_Red', () => {
    const [r, g, b] = hslToRgb(0, 1, 0.5);
    expect(r).toBe(255);
    expect(g).toBe(0);
    expect(b).toBe(0);
  });

  it('TestHslToRgb_Green', () => {
    const [r, g, b] = hslToRgb(120, 1, 0.5);
    expect(r).toBe(0);
    expect(g).toBe(255);
    expect(b).toBe(0);
  });

  it('TestHslToRgb_Blue', () => {
    const [r, g, b] = hslToRgb(240, 1, 0.5);
    expect(r).toBe(0);
    expect(g).toBe(0);
    expect(b).toBe(255);
  });

  it('TestHslToRgb_White', () => {
    const [r, g, b] = hslToRgb(0, 0, 1);
    expect(r).toBe(255);
    expect(g).toBe(255);
    expect(b).toBe(255);
  });

  it('TestHslToRgb_Black', () => {
    const [r, g, b] = hslToRgb(0, 0, 0);
    expect(r).toBe(0);
    expect(g).toBe(0);
    expect(b).toBe(0);
  });
});

describe('freqToMel / melToFreq', () => {
  it('TestFreqToMel_1000Hz', () => {
    const mel = freqToMel(1000);
    // 1000 Hz ≈ 1000 mel (by design of mel scale)
    expect(mel).toBeCloseTo(1000, -1);
  });

  it('TestMelToFreq_RoundTrip', () => {
    const freq = 440;
    const mel = freqToMel(freq);
    const backToFreq = melToFreq(mel);
    expect(backToFreq).toBeCloseTo(freq, 1);
  });

  it('TestFreqToMel_ZeroHz', () => {
    expect(freqToMel(0)).toBe(0);
  });
});

describe('buildMelBands', () => {
  it('TestBuildMelBands_Returns12Bands', () => {
    const bands = buildMelBands(1024, 44100, 12);
    expect(bands).toHaveLength(12);
  });

  it('TestBuildMelBands_BandsAreAscending', () => {
    const bands = buildMelBands(1024, 44100, 12);
    for (let i = 0; i < bands.length - 1; i++) {
      expect(bands[i][0]).toBeLessThanOrEqual(bands[i + 1][0]);
    }
  });

  it('TestBuildMelBands_FirstBandStartsNearZero', () => {
    const bands = buildMelBands(1024, 44100, 12);
    // First band starts from 20 Hz equivalent bin
    expect(bands[0][0]).toBeLessThanOrEqual(2);
  });

  it('TestBuildMelBands_LastBandReachesEnd', () => {
    const bands = buildMelBands(1024, 44100, 12);
    expect(bands[11][1]).toBeGreaterThanOrEqual(1000);
  });

  it('TestBuildMelBands_LowBandsNarrowerThanHighBands', () => {
    const bands = buildMelBands(1024, 44100, 12);
    const lowBandWidth = bands[0][1] - bands[0][0];
    const highBandWidth = bands[11][1] - bands[11][0];
    // Mel scale: low bands cover fewer bins, high bands cover more
    expect(highBandWidth).toBeGreaterThan(lowBandWidth);
  });
});

describe('AudioSpectrumMappingStrategy', () => {
  let strategy: AudioSpectrumMappingStrategy;

  beforeEach(() => {
    strategy = new AudioSpectrumMappingStrategy();
    audioStore.setState({
      devices: [],
      selectedDeviceId: null,
      isAudioActive: false,
      audioContextState: null,
      gain: 1.0,
      sensitivity: 0, // No threshold for most tests
      visualizationMode: 'spectrum',
    });
  });

  it('TestAudioMapping_Id', () => {
    expect(strategy.id).toBe('audio-spectrum');
  });

  it('TestAudioMapping_NoSpectrum_ReturnsAllBlack', () => {
    const frame: FrameData = { type: 'audio' }; // No spectrum
    const result = strategy.map(frame, LED);
    expect(result.length).toBe(LED * 3);
    for (let i = 0; i < result.length; i++) {
      expect(result[i]).toBe(0);
    }
  });

  it('TestAudioMapping_SpectrumMode_OutputCorrectLength', () => {
    const spectrum = new Float32Array(1024).fill(0.5);
    const frame: FrameData = { type: 'audio', spectrum };

    const result = strategy.map(frame, LED);
    expect(result.length).toBe(LED * 3);
  });

  it('TestAudioMapping_SpectrumMode_EdgesHaveDifferentColors', () => {
    // Create spectrum where different frequency ranges have different amplitudes
    const spectrum = new Float32Array(1024);
    // Bass: strong
    for (let i = 0; i < 100; i++) spectrum[i] = 0.9;
    // Mids: medium
    for (let i = 100; i < 500; i++) spectrum[i] = 0.5;
    // Highs: weak
    for (let i = 500; i < 1024; i++) spectrum[i] = 0.1;

    const frame: FrameData = { type: 'audio', spectrum };
    const result = strategy.map(frame, LED);

    // Edge 0 (bass) should be different from edge 11 (highs)
    const edge0R = result[0];
    const edge0G = result[1];
    const edge0B = result[2];
    const edge11Start = getEdgeStartIndex(11) * 3;
    const edge11R = result[edge11Start];
    const edge11G = result[edge11Start + 1];
    const edge11B = result[edge11Start + 2];

    // They should not be identical
    const sameColor = edge0R === edge11R && edge0G === edge11G && edge0B === edge11B;
    expect(sameColor).toBe(false);
  });

  it('TestAudioMapping_SpectrumMode_AllLedsOnEdgeSameColor', () => {
    const spectrum = new Float32Array(1024).fill(0.5);
    const frame: FrameData = { type: 'audio', spectrum };
    const result = strategy.map(frame, LED);

    // All LEDs on edge 0 should have the same color
    const ledsOnEdge0 = EDGE_LED_COUNTS[0];
    const r0 = result[0];
    const g0 = result[1];
    const b0 = result[2];
    for (let led = 1; led < ledsOnEdge0; led++) {
      const offset = led * 3;
      expect(result[offset]).toBe(r0);
      expect(result[offset + 1]).toBe(g0);
      expect(result[offset + 2]).toBe(b0);
    }
  });

  it('TestAudioMapping_EnergyMode_AllLedsSameColor', () => {
    audioStore.getState().setVisualizationMode('energy');
    const spectrum = new Float32Array(1024).fill(0.7);
    const frame: FrameData = { type: 'audio', spectrum };
    const result = strategy.map(frame, LED);

    // All LEDs should have the same color
    const r = result[0];
    const g = result[1];
    const b = result[2];
    for (let i = 3; i < result.length; i += 3) {
      expect(result[i]).toBe(r);
      expect(result[i + 1]).toBe(g);
      expect(result[i + 2]).toBe(b);
    }
  });

  it('TestAudioMapping_EnergyMode_LouderIsBrighter', () => {
    audioStore.getState().setVisualizationMode('energy');

    // Quiet signal
    const quietSpectrum = new Float32Array(1024).fill(0.1);
    const quietResult = strategy.map({ type: 'audio', spectrum: quietSpectrum }, LED);
    const quietBrightness = quietResult[0] + quietResult[1] + quietResult[2];

    // Reset smoothing by creating new strategy
    const strategy2 = new AudioSpectrumMappingStrategy();

    // Loud signal
    const loudSpectrum = new Float32Array(1024).fill(0.9);
    const loudResult = strategy2.map({ type: 'audio', spectrum: loudSpectrum }, LED);
    const loudBrightness = loudResult[0] + loudResult[1] + loudResult[2];

    expect(loudBrightness).toBeGreaterThan(quietBrightness);
  });

  it('TestAudioMapping_WaveformMode_LedsVaryAcrossStrip', () => {
    audioStore.getState().setVisualizationMode('waveform');

    // Create varying spectrum
    const spectrum = new Float32Array(1024);
    for (let i = 0; i < 1024; i++) {
      spectrum[i] = Math.sin((i / 1024) * Math.PI); // Peak in middle
    }

    const frame: FrameData = { type: 'audio', spectrum };
    const result = strategy.map(frame, LED);

    // LEDs at start, middle, and end should differ
    const startRgb = [result[0], result[1], result[2]];
    const midLed = Math.floor(LED / 2);
    const midIdx = midLed * 3;
    const midRgb = [result[midIdx], result[midIdx + 1], result[midIdx + 2]];
    const endIdx = (LED - 1) * 3;
    const endRgb = [result[endIdx], result[endIdx + 1], result[endIdx + 2]];

    // Middle should be brightest (peak of sine)
    const midBrightness = midRgb[0] + midRgb[1] + midRgb[2];
    const startBrightness = startRgb[0] + startRgb[1] + startRgb[2];
    const endBrightness = endRgb[0] + endRgb[1] + endRgb[2];

    expect(midBrightness).toBeGreaterThan(startBrightness);
    expect(midBrightness).toBeGreaterThan(endBrightness);
  });

  it('TestAudioMapping_SensitivityThreshold_ZerosLowBins', () => {
    audioStore.getState().setSensitivity(200); // High threshold

    // All values at 0.5 (below threshold 200/255 ≈ 0.784)
    const spectrum = new Float32Array(1024).fill(0.5);
    const frame: FrameData = { type: 'audio', spectrum };
    const result = strategy.map(frame, LED);

    // All should be black since all values are below threshold
    for (let i = 0; i < result.length; i++) {
      expect(result[i]).toBe(0);
    }
  });

  it('TestAudioMapping_SensitivityThreshold_PassesHighBins', () => {
    audioStore.getState().setSensitivity(50); // Low threshold

    // All values at 0.9 (above threshold 50/255 ≈ 0.196)
    const spectrum = new Float32Array(1024).fill(0.9);
    const frame: FrameData = { type: 'audio', spectrum };
    const result = strategy.map(frame, LED);

    // Should have non-zero values
    let hasNonZero = false;
    for (let i = 0; i < result.length; i++) {
      if (result[i] > 0) { hasNonZero = true; break; }
    }
    expect(hasNonZero).toBe(true);
  });

  it('TestAudioMapping_ReusesOutputBuffer', () => {
    const spectrum = new Float32Array(1024).fill(0.5);
    const frame: FrameData = { type: 'audio', spectrum };

    const result1 = strategy.map(frame, LED);
    const result2 = strategy.map(frame, LED);

    // Same buffer reference (no allocation per map call)
    expect(result1).toBe(result2);
  });
});
