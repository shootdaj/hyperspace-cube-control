import { describe, it, expect, beforeEach } from 'vitest';
import { ManualPaintPlugin } from '../ManualPaintPlugin';

describe('ManualPaintPlugin', () => {
  let plugin: ManualPaintPlugin;

  beforeEach(() => {
    plugin = new ManualPaintPlugin();
  });

  describe('InputPlugin contract', () => {
    it('TestManualPaintPlugin_Id_IsManualPaint', () => {
      expect(plugin.id).toBe('manual-paint');
    });

    it('TestManualPaintPlugin_Name_IsManualPaint', () => {
      expect(plugin.name).toBe('Manual Paint');
    });

    it('TestManualPaintPlugin_Initialize_Resolves', async () => {
      await expect(plugin.initialize({ ledCount: 480, frameRate: 30 })).resolves.toBeUndefined();
    });

    it('TestManualPaintPlugin_Destroy_NoThrow', () => {
      expect(() => plugin.destroy()).not.toThrow();
    });
  });

  describe('tick', () => {
    it('TestManualPaintPlugin_Tick_ReturnsDirectFrameData', () => {
      const frame = plugin.tick(33);
      expect(frame).not.toBeNull();
      expect(frame!.type).toBe('direct');
      expect(frame!.leds).toBeInstanceOf(Uint8Array);
      expect(frame!.leds!.length).toBe(480 * 3);
    });

    it('TestManualPaintPlugin_Tick_InitialBufferAllZeros', () => {
      const frame = plugin.tick(33);
      for (let i = 0; i < frame!.leds!.length; i++) {
        expect(frame!.leds![i]).toBe(0);
      }
    });
  });

  describe('setPixel', () => {
    it('TestManualPaintPlugin_SetPixel_FirstLed', () => {
      plugin.setPixel(0, 255, 0, 0);
      const frame = plugin.tick(33);
      expect(frame!.leds![0]).toBe(255);
      expect(frame!.leds![1]).toBe(0);
      expect(frame!.leds![2]).toBe(0);
    });

    it('TestManualPaintPlugin_SetPixel_LastLed', () => {
      plugin.setPixel(479, 0, 255, 0);
      const frame = plugin.tick(33);
      const off = 479 * 3;
      expect(frame!.leds![off]).toBe(0);
      expect(frame!.leds![off + 1]).toBe(255);
      expect(frame!.leds![off + 2]).toBe(0);
    });

    it('TestManualPaintPlugin_SetPixel_MiddleLed', () => {
      plugin.setPixel(240, 128, 64, 32);
      const frame = plugin.tick(33);
      const off = 240 * 3;
      expect(frame!.leds![off]).toBe(128);
      expect(frame!.leds![off + 1]).toBe(64);
      expect(frame!.leds![off + 2]).toBe(32);
    });

    it('TestManualPaintPlugin_SetPixel_NegativeIndex_NoOp', () => {
      expect(() => plugin.setPixel(-1, 255, 0, 0)).not.toThrow();
      const frame = plugin.tick(33);
      // Buffer should be all zeros
      for (let i = 0; i < frame!.leds!.length; i++) {
        expect(frame!.leds![i]).toBe(0);
      }
    });

    it('TestManualPaintPlugin_SetPixel_OutOfRange_NoOp', () => {
      expect(() => plugin.setPixel(480, 255, 0, 0)).not.toThrow();
      const frame = plugin.tick(33);
      for (let i = 0; i < frame!.leds!.length; i++) {
        expect(frame!.leds![i]).toBe(0);
      }
    });

    it('TestManualPaintPlugin_SetPixel_Multiple_Persistent', () => {
      plugin.setPixel(0, 255, 0, 0);
      plugin.setPixel(1, 0, 255, 0);
      plugin.setPixel(2, 0, 0, 255);
      const frame = plugin.tick(33);
      expect(frame!.leds![0]).toBe(255);
      expect(frame!.leds![3]).toBe(0);
      expect(frame!.leds![4]).toBe(255);
      expect(frame!.leds![6]).toBe(0);
      expect(frame!.leds![7]).toBe(0);
      expect(frame!.leds![8]).toBe(255);
    });
  });

  describe('setEdge', () => {
    it('TestManualPaintPlugin_SetEdge_Edge0_Sets40Leds', () => {
      plugin.setEdge(0, 255, 128, 64);
      const frame = plugin.tick(33);
      for (let i = 0; i < 40; i++) {
        const off = i * 3;
        expect(frame!.leds![off]).toBe(255);
        expect(frame!.leds![off + 1]).toBe(128);
        expect(frame!.leds![off + 2]).toBe(64);
      }
      // LED 40 should be untouched
      expect(frame!.leds![40 * 3]).toBe(0);
    });

    it('TestManualPaintPlugin_SetEdge_Edge11_SetsLastEdge', () => {
      plugin.setEdge(11, 0, 255, 0);
      const frame = plugin.tick(33);
      for (let i = 440; i < 480; i++) {
        const off = i * 3;
        expect(frame!.leds![off]).toBe(0);
        expect(frame!.leds![off + 1]).toBe(255);
        expect(frame!.leds![off + 2]).toBe(0);
      }
      // LED 439 should be untouched
      expect(frame!.leds![439 * 3]).toBe(0);
    });
  });

  describe('setFaceEdges', () => {
    it('TestManualPaintPlugin_SetFaceEdges_BottomFace_Sets160Leds', () => {
      plugin.setFaceEdges(0, 0, 0, 255);
      const frame = plugin.tick(33);
      // Bottom face = edges 0,1,2,3 = LEDs 0-159
      for (let i = 0; i < 160; i++) {
        const off = i * 3;
        expect(frame!.leds![off]).toBe(0);
        expect(frame!.leds![off + 1]).toBe(0);
        expect(frame!.leds![off + 2]).toBe(255);
      }
      // LED 160 should be untouched
      expect(frame!.leds![160 * 3]).toBe(0);
    });

    it('TestManualPaintPlugin_SetFaceEdges_FrontFace_SetsCorrectEdges', () => {
      // Front face = edges 0,4,8,9
      plugin.setFaceEdges(2, 255, 255, 0);
      const frame = plugin.tick(33);

      // Edge 0 (LEDs 0-39) should be colored
      expect(frame!.leds![0]).toBe(255);
      expect(frame!.leds![1]).toBe(255);
      expect(frame!.leds![2]).toBe(0);

      // Edge 4 (LEDs 160-199) should be colored
      expect(frame!.leds![160 * 3]).toBe(255);

      // Edge 8 (LEDs 320-359) should be colored
      expect(frame!.leds![320 * 3]).toBe(255);

      // Edge 9 (LEDs 360-399) should be colored
      expect(frame!.leds![360 * 3]).toBe(255);

      // Edge 1 (LEDs 40-79) should NOT be colored
      expect(frame!.leds![40 * 3]).toBe(0);
    });
  });

  describe('fill', () => {
    it('TestManualPaintPlugin_Fill_SetsAll480Leds', () => {
      plugin.fill(128, 128, 128);
      const frame = plugin.tick(33);
      for (let i = 0; i < 480; i++) {
        const off = i * 3;
        expect(frame!.leds![off]).toBe(128);
        expect(frame!.leds![off + 1]).toBe(128);
        expect(frame!.leds![off + 2]).toBe(128);
      }
    });

    it('TestManualPaintPlugin_Fill_Black_ClearsBuffer', () => {
      // First paint something
      plugin.fill(255, 255, 255);
      // Then clear
      plugin.fill(0, 0, 0);
      const frame = plugin.tick(33);
      for (let i = 0; i < frame!.leds!.length; i++) {
        expect(frame!.leds![i]).toBe(0);
      }
    });
  });

  describe('getBuffer', () => {
    it('TestManualPaintPlugin_GetBuffer_ReturnsSameReference', () => {
      const buf1 = plugin.getBuffer();
      const buf2 = plugin.getBuffer();
      expect(buf1).toBe(buf2);
    });

    it('TestManualPaintPlugin_GetBuffer_ReflectsSetPixel', () => {
      plugin.setPixel(100, 42, 43, 44);
      const buf = plugin.getBuffer();
      expect(buf[100 * 3]).toBe(42);
      expect(buf[100 * 3 + 1]).toBe(43);
      expect(buf[100 * 3 + 2]).toBe(44);
    });
  });
});
