import { describe, it, expect } from 'vitest';
import { FaceExtractionStrategy } from '../FaceExtractionStrategy';
import type { FrameData } from '@/core/pipeline/types';

describe('FaceExtractionStrategy', () => {
  it('TestFaceExtractionStrategy_ImplementsMappingStrategyInterface', () => {
    const strategy = new FaceExtractionStrategy();
    expect(strategy.id).toBe('face-extraction');
    expect(typeof strategy.map).toBe('function');
  });

  it('TestFaceExtractionStrategy_PassThroughDirectLedData', () => {
    const strategy = new FaceExtractionStrategy();
    const leds = new Uint8Array(480 * 3);
    leds[0] = 200;
    leds[1] = 100;
    leds[2] = 50;

    const frame: FrameData = { type: 'direct', leds };
    const result = strategy.map(frame, 480);

    expect(result.length).toBe(480 * 3);
    expect(result[0]).toBe(200);
    expect(result[1]).toBe(100);
    expect(result[2]).toBe(50);
  });

  it('TestFaceExtractionStrategy_NoDataReturnsBlack', () => {
    const strategy = new FaceExtractionStrategy();
    const frame: FrameData = { type: 'midi', midiCC: new Map() };
    const result = strategy.map(frame, 480);

    expect(result.length).toBe(480 * 3);
    for (let i = 0; i < result.length; i++) {
      expect(result[i]).toBe(0);
    }
  });

  it('TestFaceExtractionStrategy_FullBufferPassThrough', () => {
    const strategy = new FaceExtractionStrategy();
    const leds = new Uint8Array(480 * 3);
    for (let i = 0; i < leds.length; i++) {
      leds[i] = (i * 7) % 256;
    }

    const frame: FrameData = { type: 'direct', leds };
    const result = strategy.map(frame, 480);

    for (let i = 0; i < result.length; i++) {
      expect(result[i]).toBe((i * 7) % 256);
    }
  });
});
