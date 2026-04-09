import { describe, it, expect } from 'vitest';
import type {
  FrameData,
  InputPlugin,
  MappingStrategy,
  OutputPlugin,
  PluginContext,
} from '../types';

describe('FrameData', () => {
  it('TestFrameData_AcceptsDirectType_WithLedsBuffer', () => {
    const frame: FrameData = {
      type: 'direct',
      leds: new Uint8Array(480 * 3),
    };
    expect(frame.type).toBe('direct');
    expect(frame.leds).toBeInstanceOf(Uint8Array);
    expect(frame.leds!.length).toBe(1440);
  });

  it('TestFrameData_AcceptsAudioType_WithSpectrum', () => {
    const frame: FrameData = {
      type: 'audio',
      spectrum: new Float32Array(256),
    };
    expect(frame.type).toBe('audio');
    expect(frame.spectrum).toBeInstanceOf(Float32Array);
  });

  it('TestFrameData_AcceptsMidiType_WithCCMap', () => {
    const ccMap = new Map<number, number>([[1, 64], [7, 100]]);
    const frame: FrameData = {
      type: 'midi',
      midiCC: ccMap,
    };
    expect(frame.type).toBe('midi');
    expect(frame.midiCC!.get(1)).toBe(64);
    expect(frame.midiCC!.get(7)).toBe(100);
  });
});

describe('PluginContext', () => {
  it('TestPluginContext_HasLedCount480ForHyperCube', () => {
    const ctx: PluginContext = {
      ledCount: 480,
      frameRate: 30,
    };
    expect(ctx.ledCount).toBe(480);
    expect(ctx.frameRate).toBe(30);
  });
});

describe('InputPlugin interface shape', () => {
  it('TestInputPlugin_ShapeIsCorrect_WithAllRequiredMembers', () => {
    const ctx: PluginContext = { ledCount: 480, frameRate: 30 };
    const plugin: InputPlugin = {
      id: 'test-input',
      name: 'Test Input',
      initialize: async (_ctx) => {},
      tick: (_deltaMs) => null,
      destroy: () => {},
    };
    expect(plugin.id).toBe('test-input');
    expect(plugin.name).toBe('Test Input');
    expect(typeof plugin.initialize).toBe('function');
    expect(typeof plugin.tick).toBe('function');
    expect(typeof plugin.destroy).toBe('function');
    // initialize returns a Promise
    const result = plugin.initialize(ctx);
    expect(result).toBeInstanceOf(Promise);
  });

  it('TestInputPlugin_TickReturnsNullWhenNoData', () => {
    const plugin: InputPlugin = {
      id: 'idle',
      name: 'Idle',
      initialize: async () => {},
      tick: () => null,
      destroy: () => {},
    };
    expect(plugin.tick(16.7)).toBeNull();
  });

  it('TestInputPlugin_TickReturnsFrameData_WhenDataAvailable', () => {
    const plugin: InputPlugin = {
      id: 'data-source',
      name: 'Data Source',
      initialize: async () => {},
      tick: () => ({
        type: 'direct',
        leds: new Uint8Array(1440),
      }),
      destroy: () => {},
    };
    const frame = plugin.tick(16.7);
    expect(frame).not.toBeNull();
    expect(frame!.type).toBe('direct');
  });
});

describe('MappingStrategy interface shape', () => {
  it('TestMappingStrategy_MapReturns480x3ByteArray', () => {
    const strategy: MappingStrategy = {
      id: 'identity',
      map: (_frame, ledCount) => new Uint8Array(ledCount * 3),
    };
    const result = strategy.map({ type: 'direct', leds: new Uint8Array(1440) }, 480);
    expect(result).toBeInstanceOf(Uint8Array);
    expect(result.length).toBe(1440);
  });
});

describe('OutputPlugin interface shape', () => {
  it('TestOutputPlugin_SendAcceptsLedsAndBrightness', () => {
    const sent: Array<{ leds: Uint8Array; brightness: number }> = [];
    const output: OutputPlugin = {
      id: 'mock-output',
      send: (leds, brightness) => { sent.push({ leds, brightness }); },
      destroy: () => {},
    };
    const leds = new Uint8Array(1440);
    output.send(leds, 128);
    expect(sent).toHaveLength(1);
    expect(sent[0].brightness).toBe(128);
  });
});
