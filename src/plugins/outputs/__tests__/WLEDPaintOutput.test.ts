import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { WLEDPaintOutput } from '../WLEDPaintOutput';
import { WLEDWebSocketService } from '@/core/wled/WLEDWebSocketService';

// Stable mock send function shared across all getInstance() calls
const mockSend = vi.fn();

vi.mock('@/core/wled/WLEDWebSocketService', () => ({
  WLEDWebSocketService: {
    getInstance: vi.fn(() => ({
      send: mockSend,
    })),
  },
}));

function getMockSend() {
  return mockSend;
}

describe('WLEDPaintOutput', () => {
  let output: WLEDPaintOutput;

  beforeEach(() => {
    vi.useFakeTimers();
    output = new WLEDPaintOutput();
    vi.clearAllMocks();
  });

  afterEach(() => {
    output.destroy();
    vi.useRealTimers();
  });

  describe('sendPaint — diff-based sending', () => {
    it('TestWLEDPaintOutput_NoChanges_NoSend', () => {
      const buffer = new Uint8Array(480 * 3); // all zeros = same as initial lastSent
      output.sendPaint(buffer);
      const send = getMockSend();
      expect(send).not.toHaveBeenCalled();
    });

    it('TestWLEDPaintOutput_SingleLedChange_SendsMinimalPayload', () => {
      const buffer = new Uint8Array(480 * 3);
      buffer[0] = 255; // LED 0, R
      buffer[1] = 128; // LED 0, G
      buffer[2] = 64;  // LED 0, B

      output.sendPaint(buffer);
      const send = getMockSend();
      expect(send).toHaveBeenCalledTimes(1);

      const payload = send.mock.calls[0][0];
      expect(payload.seg).toBeDefined();
      expect(payload.seg[0].i[0]).toBe(0); // start index
      expect(payload.seg[0].i[1]).toBe(255); // R
      expect(payload.seg[0].i[2]).toBe(128); // G
      expect(payload.seg[0].i[3]).toBe(64);  // B
    });

    it('TestWLEDPaintOutput_ContiguousRange_SingleSend', () => {
      const buffer = new Uint8Array(480 * 3);
      // Set LEDs 10-14 (contiguous range of 5)
      for (let i = 10; i < 15; i++) {
        buffer[i * 3] = 100;
        buffer[i * 3 + 1] = 200;
        buffer[i * 3 + 2] = 50;
      }

      output.sendPaint(buffer);
      const send = getMockSend();
      expect(send).toHaveBeenCalledTimes(1);

      const payload = send.mock.calls[0][0];
      expect(payload.seg[0].i[0]).toBe(10); // start index
      // 5 LEDs * 3 channels + 1 start index = 16 entries
      expect(payload.seg[0].i.length).toBe(1 + 5 * 3);
    });

    it('TestWLEDPaintOutput_NonContiguousChanges_MultipleSends', () => {
      const buffer = new Uint8Array(480 * 3);
      // LED 0
      buffer[0] = 255;
      // LED 100 (far from LED 0)
      buffer[100 * 3] = 255;

      output.sendPaint(buffer);
      const send = getMockSend();
      // Two separate ranges should produce two sends
      expect(send).toHaveBeenCalledTimes(2);
    });

    it('TestWLEDPaintOutput_SecondSend_OnlyDiff', () => {
      // First send: LED 0 = red
      const buffer1 = new Uint8Array(480 * 3);
      buffer1[0] = 255;
      output.sendPaint(buffer1);

      vi.clearAllMocks();
      // Advance past throttle
      vi.advanceTimersByTime(50);

      // Second send: LED 0 still red, LED 1 = green
      const buffer2 = new Uint8Array(480 * 3);
      buffer2[0] = 255; // unchanged
      buffer2[3] = 255; // LED 1, G
      output.sendPaint(buffer2);

      const send = getMockSend();
      expect(send).toHaveBeenCalledTimes(1);
      // Should only send LED 1, not LED 0
      const payload = send.mock.calls[0][0];
      expect(payload.seg[0].i[0]).toBe(1); // LED 1
    });
  });

  describe('throttling', () => {
    it('TestWLEDPaintOutput_RapidCalls_ThrottledTo30fps', () => {
      const buffer1 = new Uint8Array(480 * 3);
      buffer1[0] = 100;

      const buffer2 = new Uint8Array(480 * 3);
      buffer2[0] = 200;

      const buffer3 = new Uint8Array(480 * 3);
      buffer3[0] = 255;

      // First call goes through immediately
      output.sendPaint(buffer1);
      const send = getMockSend();
      expect(send).toHaveBeenCalledTimes(1);

      // Rapid subsequent calls within throttle window
      output.sendPaint(buffer2);
      output.sendPaint(buffer3);
      expect(send).toHaveBeenCalledTimes(1); // Still 1, throttled

      // Advance past throttle interval
      vi.advanceTimersByTime(40);
      expect(send).toHaveBeenCalledTimes(2); // Now the last pending was flushed
      // Should have sent buffer3 (latest), not buffer2
      const lastPayload = send.mock.calls[1][0];
      expect(lastPayload.seg[0].i[1]).toBe(255); // buffer3's value
    });
  });

  describe('reset', () => {
    it('TestWLEDPaintOutput_Reset_ForcesFullSendOnNext', () => {
      // Send initial state
      const buffer = new Uint8Array(480 * 3);
      buffer[0] = 255;
      output.sendPaint(buffer);

      vi.clearAllMocks();
      vi.advanceTimersByTime(50);

      // Reset clears lastSent
      output.reset();

      // Same buffer again — should now send because lastSent is cleared
      output.sendPaint(buffer);
      const send = getMockSend();
      expect(send).toHaveBeenCalled();
    });
  });

  describe('sendAll', () => {
    it('TestWLEDPaintOutput_SendAll_SendsFullFrame', () => {
      const buffer = new Uint8Array(480 * 3);
      // Set every LED to some color
      for (let i = 0; i < 480; i++) {
        buffer[i * 3] = 100;
        buffer[i * 3 + 1] = 150;
        buffer[i * 3 + 2] = 200;
      }

      output.sendAll(buffer);
      const send = getMockSend();
      // 480 LEDs in 2 chunks: 256 + 224
      expect(send).toHaveBeenCalledTimes(2);
    });

    it('TestWLEDPaintOutput_SendAll_FirstChunk256Leds', () => {
      const buffer = new Uint8Array(480 * 3);
      buffer[0] = 42;
      output.sendAll(buffer);
      const send = getMockSend();

      const chunk1 = send.mock.calls[0][0];
      expect(chunk1.seg[0].i[0]).toBe(0); // start index
      // 256 LEDs * 3 channels + 1 start index
      expect(chunk1.seg[0].i.length).toBe(1 + 256 * 3);
    });

    it('TestWLEDPaintOutput_SendAll_SecondChunkStartsAt256', () => {
      const buffer = new Uint8Array(480 * 3);
      output.sendAll(buffer);
      const send = getMockSend();

      const chunk2 = send.mock.calls[1][0];
      expect(chunk2.seg[0].i[0]).toBe(256); // start index for second chunk
      // 224 LEDs * 3 channels + 1 start index
      expect(chunk2.seg[0].i.length).toBe(1 + 224 * 3);
    });

    it('TestWLEDPaintOutput_SendAll_UpdatesLastSent', () => {
      const buffer = new Uint8Array(480 * 3);
      buffer[0] = 255;
      output.sendAll(buffer);

      vi.clearAllMocks();
      vi.advanceTimersByTime(50);

      // Sending the same buffer via sendPaint should produce no diff
      output.sendPaint(buffer);
      const send = getMockSend();
      expect(send).not.toHaveBeenCalled();
    });
  });

  describe('destroy', () => {
    it('TestWLEDPaintOutput_Destroy_ClearsThrottle', () => {
      const buffer = new Uint8Array(480 * 3);
      buffer[0] = 255;
      output.sendPaint(buffer);

      // Schedule a pending send
      const buffer2 = new Uint8Array(480 * 3);
      buffer2[0] = 128;
      output.sendPaint(buffer2);

      output.destroy();

      vi.clearAllMocks();
      vi.advanceTimersByTime(50);

      const send = getMockSend();
      expect(send).not.toHaveBeenCalled(); // Timer was cleared
    });
  });
});
