import { describe, it, expect, beforeEach, beforeAll, afterAll, afterEach } from 'vitest';
import { runPipelineTick, FRAME_INTERVAL_MS, type PipelineRefs } from '@/core/pipeline/PipelineEngine';
import { ledStateProxy } from '@/core/store/ledStateProxy';
import { MockInputPlugin, MockMappingStrategy, MockOutputPlugin } from '../mocks/mockPlugins';
import { server } from '../mocks/virtualCube';
import { WLEDWebSocketService } from '@/core/wled/WLEDWebSocketService';
import { connectionStore } from '@/core/store/connectionStore';
import { startLiveSync } from '@/core/pipeline/WLEDLiveSync';
import type { InputPlugin, MappingStrategy, OutputPlugin } from '@/core/pipeline/types';
import type { MutableRefObject } from 'react';

function makeRefs(overrides?: Partial<{
  input: InputPlugin | null;
  mapping: MappingStrategy | null;
  output: OutputPlugin | null;
  lastTime: number;
}>): PipelineRefs {
  return {
    activeInput: { current: overrides?.input ?? null } as MutableRefObject<InputPlugin | null>,
    activeMapping: { current: overrides?.mapping ?? null } as MutableRefObject<MappingStrategy | null>,
    activeOutput: { current: overrides?.output ?? null } as MutableRefObject<OutputPlugin | null>,
    lastTime: { current: overrides?.lastTime ?? 0 } as MutableRefObject<number>,
  };
}

function waitForStatus(status: string, timeout = 3000): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timeout waiting for status: ${status}`)), timeout);
    const unsub = connectionStore.subscribe((state) => {
      if (state.status === status) {
        clearTimeout(timer);
        unsub();
        resolve();
      }
    });
    if (connectionStore.getState().status === status) {
      clearTimeout(timer);
      unsub();
      resolve();
    }
  });
}

describe('Pipeline Integration', () => {
  beforeEach(() => {
    ledStateProxy.colors.fill(0);
    ledStateProxy.lastUpdated = 0;
  });

  describe('PipelineEngine tick integration', () => {
    it('TestPipelineEngine_TicksInput_WritesLedProxy_CallsOutput', () => {
      const input = new MockInputPlugin();
      const mapping = new MockMappingStrategy();
      const output = new MockOutputPlugin();

      // Set up input with non-zero data
      const leds = new Uint8Array(480 * 3);
      leds[0] = 200;
      leds[1] = 100;
      leds[2] = 50;
      input.setNextFrame({ type: 'direct', leds });

      // Use passthrough mapping
      const passthroughMapping: MappingStrategy = {
        id: 'passthrough',
        map(frame, ledCount) {
          return frame.leds ?? new Uint8Array(ledCount * 3);
        },
      };

      const refs = makeRefs({
        input,
        mapping: passthroughMapping,
        output,
      });

      runPipelineTick(FRAME_INTERVAL_MS, refs);

      // Output received the frame
      expect(output.sentFrames).toHaveLength(1);
      expect(output.sentFrames[0].brightness).toBe(255);

      // ledStateProxy was updated
      expect(ledStateProxy.colors[0]).toBe(200);
      expect(ledStateProxy.colors[1]).toBe(100);
      expect(ledStateProxy.colors[2]).toBe(50);
      expect(ledStateProxy.lastUpdated).toBeGreaterThan(0);
    });

    it('TestPipelineEngine_NullInput_IsNoop', () => {
      const mapping = new MockMappingStrategy();
      const output = new MockOutputPlugin();

      const refs = makeRefs({
        input: null,
        mapping,
        output,
      });

      runPipelineTick(FRAME_INTERVAL_MS, refs);

      expect(output.sentFrames).toHaveLength(0);
      expect(ledStateProxy.lastUpdated).toBe(0);
    });

    it('TestPipelineEngine_NullMapping_IsNoop', () => {
      const input = new MockInputPlugin();
      const output = new MockOutputPlugin();

      const refs = makeRefs({
        input,
        mapping: null,
        output,
      });

      runPipelineTick(FRAME_INTERVAL_MS, refs);

      expect(output.sentFrames).toHaveLength(0);
    });
  });

  describe('WLEDLiveSync integration', () => {
    beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }));
    afterEach(() => {
      WLEDWebSocketService._resetForTest();
      connectionStore.setState({ ip: '', status: 'disconnected' });
      server.resetHandlers();
    });
    afterAll(() => server.close());

    it('TestWLEDLiveSync_UpdatesLedProxy_OnLiveStreamMessage', async () => {
      const ws = WLEDWebSocketService.getInstance();
      ws.connect('192.168.1.100');

      await waitForStatus('connected');

      const cleanup = startLiveSync();

      // Wait for the live stream response from virtual cube
      // The virtual cube sends FF8800 for all 480 LEDs when {lv:true} is received
      await new Promise((r) => setTimeout(r, 200));

      // Verify ledStateProxy was updated with FF8800 = R:255, G:136, B:0
      expect(ledStateProxy.colors[0]).toBe(0xFF);
      expect(ledStateProxy.colors[1]).toBe(0x88);
      expect(ledStateProxy.colors[2]).toBe(0x00);

      cleanup();
    });

    it('TestWLEDLiveSync_Cleanup_RemovesSubscriber', async () => {
      const ws = WLEDWebSocketService.getInstance();
      ws.connect('192.168.1.100');

      await waitForStatus('connected');

      const cleanup = startLiveSync();

      // Wait for initial live stream
      await new Promise((r) => setTimeout(r, 200));

      // Should have data
      expect(ledStateProxy.colors[0]).toBe(0xFF);

      cleanup();

      // Reset colors
      ledStateProxy.colors.fill(0);

      // Request another live stream (this should not update proxy since we unsubscribed)
      ws.requestLiveStream();
      await new Promise((r) => setTimeout(r, 200));

      // Colors should still be zero since cleanup was called
      // Note: requestLiveStream is guarded by liveStreamActive flag in the service,
      // so this test verifies the subscriber was removed
      expect(ledStateProxy.colors[0]).toBe(0);
    });
  });
});
