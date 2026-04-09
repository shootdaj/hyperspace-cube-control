import { describe, it, expect } from 'vitest';
import { MIDICCMappingStrategy } from '../MIDICCMappingStrategy';
import type { FrameData } from '@/core/pipeline/types';

describe('MIDICCMappingStrategy', () => {
  const strategy = new MIDICCMappingStrategy();

  it('TestMIDICCMapping_HasCorrectId', () => {
    expect(strategy.id).toBe('midi-cc');
  });

  it('TestMIDICCMapping_ReturnsZeroArrayForNonMidiFrame', () => {
    const frame: FrameData = { type: 'direct', leds: new Uint8Array(480 * 3) };
    const result = strategy.map(frame, 480);
    expect(result.length).toBe(480 * 3);
    const allZero = result.every((v) => v === 0);
    expect(allZero).toBe(true);
  });

  it('TestMIDICCMapping_ReturnsZeroArrayForEmptyMidiCC', () => {
    const frame: FrameData = { type: 'midi', midiCC: new Map() };
    const result = strategy.map(frame, 480);
    expect(result.length).toBe(480 * 3);
    const allZero = result.every((v) => v === 0);
    expect(allZero).toBe(true);
  });

  it('TestMIDICCMapping_ProducesNonZeroOutputForActiveCCs', () => {
    const midiCC = new Map<number, number>();
    midiCC.set(7, 100); // brightness CC at ~78%
    const frame: FrameData = { type: 'midi', midiCC };
    const result = strategy.map(frame, 480);
    expect(result.length).toBe(480 * 3);

    // Should have non-zero values
    let hasNonZero = false;
    for (let i = 0; i < result.length; i++) {
      if (result[i] > 0) { hasNonZero = true; break; }
    }
    expect(hasNonZero).toBe(true);
  });

  it('TestMIDICCMapping_MaxCCProducesFullBrightness', () => {
    const midiCC = new Map<number, number>();
    midiCC.set(7, 127); // Max value
    const frame: FrameData = { type: 'midi', midiCC };
    const result = strategy.map(frame, 480);

    // At least some LEDs should have high brightness
    let maxVal = 0;
    for (let i = 0; i < result.length; i++) {
      if (result[i] > maxVal) maxVal = result[i];
    }
    expect(maxVal).toBeGreaterThan(200);
  });

  it('TestMIDICCMapping_MultipleCCsProduceDifferentEdgeColors', () => {
    const midiCC = new Map<number, number>();
    midiCC.set(7, 127);
    midiCC.set(10, 64);
    midiCC.set(11, 32);
    const frame: FrameData = { type: 'midi', midiCC };
    const result = strategy.map(frame, 480);

    // Edges with different CC assignments should have different brightness levels
    // Edge 0 (LEDs 0-39) and Edge 1 (LEDs 40-79)
    const edge0Brightness = result[0] + result[1] + result[2];
    const edge1Brightness = result[40 * 3] + result[40 * 3 + 1] + result[40 * 3 + 2];

    // They should be different because they map to different CC values
    expect(edge0Brightness).not.toBe(edge1Brightness);
  });

  it('TestMIDICCMapping_CorrectOutputLength', () => {
    const midiCC = new Map<number, number>();
    midiCC.set(7, 64);
    const frame: FrameData = { type: 'midi', midiCC };
    const result = strategy.map(frame, 480);
    expect(result.length).toBe(480 * 3);
    expect(result).toBeInstanceOf(Uint8Array);
  });
});
