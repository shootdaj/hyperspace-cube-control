import { describe, it, expect } from 'vitest';
import { EdgeSamplingStrategy } from '../EdgeSamplingStrategy';
import type { FrameData } from '@/core/pipeline/types';

describe('EdgeSamplingStrategy', () => {
  it('TestEdgeSamplingStrategy_ImplementsMappingStrategyInterface', () => {
    const strategy = new EdgeSamplingStrategy();
    expect(strategy.id).toBe('edge-sampling');
    expect(typeof strategy.map).toBe('function');
  });

  it('TestEdgeSamplingStrategy_PassThroughDirectLedData', () => {
    const strategy = new EdgeSamplingStrategy();
    const leds = new Uint8Array(480 * 3);
    leds[0] = 255;
    leds[1] = 128;
    leds[2] = 64;

    const frame: FrameData = { type: 'direct', leds };
    const result = strategy.map(frame, 480);

    expect(result.length).toBe(480 * 3);
    expect(result[0]).toBe(255);
    expect(result[1]).toBe(128);
    expect(result[2]).toBe(64);
  });

  it('TestEdgeSamplingStrategy_NoDataReturnsBlack', () => {
    const strategy = new EdgeSamplingStrategy();
    const frame: FrameData = { type: 'audio', spectrum: new Float32Array(1024) };
    const result = strategy.map(frame, 480);

    expect(result.length).toBe(480 * 3);
    for (let i = 0; i < result.length; i++) {
      expect(result[i]).toBe(0);
    }
  });

  it('TestEdgeSamplingStrategy_HandlesDifferentLedCount', () => {
    const strategy = new EdgeSamplingStrategy();
    const leds = new Uint8Array(240 * 3);
    leds.fill(42);

    const frame: FrameData = { type: 'direct', leds };
    const result = strategy.map(frame, 240);

    expect(result.length).toBe(240 * 3);
  });

  it('TestEdgeSamplingStrategy_FullBufferPassThrough', () => {
    const strategy = new EdgeSamplingStrategy();
    const leds = new Uint8Array(480 * 3);
    // Fill with recognizable pattern
    for (let i = 0; i < leds.length; i++) {
      leds[i] = i % 256;
    }

    const frame: FrameData = { type: 'direct', leds };
    const result = strategy.map(frame, 480);

    for (let i = 0; i < result.length; i++) {
      expect(result[i]).toBe(i % 256);
    }
  });
});
