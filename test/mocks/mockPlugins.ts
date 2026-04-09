import type { FrameData, InputPlugin, MappingStrategy, OutputPlugin, PluginContext } from '@/core/pipeline/types';

export class MockInputPlugin implements InputPlugin {
  readonly id = 'mock-input';
  readonly name = 'Mock Input';
  initialized = false;
  destroyed = false;
  private _nextFrame: FrameData | null = {
    type: 'direct',
    leds: new Uint8Array(480 * 3),
  };

  async initialize(_context: PluginContext): Promise<void> {
    this.initialized = true;
  }

  tick(_deltaMs: number): FrameData | null {
    return this._nextFrame;
  }

  setNextFrame(frame: FrameData | null): void {
    this._nextFrame = frame;
  }

  destroy(): void {
    this.destroyed = true;
  }
}

export class MockMappingStrategy implements MappingStrategy {
  readonly id = 'mock-mapping';
  callCount = 0;

  map(_frame: FrameData, ledCount: number): Uint8Array {
    this.callCount++;
    return new Uint8Array(ledCount * 3);
  }
}

export class MockOutputPlugin implements OutputPlugin {
  readonly id = 'mock-output';
  destroyed = false;
  sentFrames: Array<{ leds: Uint8Array; brightness: number }> = [];

  send(leds: Uint8Array, brightness: number): void {
    this.sentFrames.push({ leds: new Uint8Array(leds), brightness });
  }

  destroy(): void {
    this.destroyed = true;
  }
}
