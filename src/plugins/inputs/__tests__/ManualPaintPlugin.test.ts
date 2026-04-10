import { describe, it, expect, beforeEach } from 'vitest';
import { ManualPaintPlugin } from '../ManualPaintPlugin';
import { DEFAULT_LED_COUNT, DEFAULT_FRAME_SIZE, EDGE_LED_COUNTS, getEdgeStartIndex } from '@/core/constants';

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
      await expect(plugin.initialize({ ledCount: DEFAULT_LED_COUNT, frameRate: 30 })).resolves.toBeUndefined();
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
      expect(frame!.leds!.length).toBe(DEFAULT_FRAME_SIZE);
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
      plugin.setPixel(DEFAULT_LED_COUNT - 1, 0, 255, 0);
      const frame = plugin.tick(33);
      const off = (DEFAULT_LED_COUNT - 1) * 3;
      expect(frame!.leds![off]).toBe(0);
      expect(frame!.leds![off + 1]).toBe(255);
      expect(frame!.leds![off + 2]).toBe(0);
    });

    it('TestManualPaintPlugin_SetPixel_MiddleLed', () => {
      plugin.setPixel(100, 128, 64, 32);
      const frame = plugin.tick(33);
      const off = 100 * 3;
      expect(frame!.leds![off]).toBe(128);
      expect(frame!.leds![off + 1]).toBe(64);
      expect(frame!.leds![off + 2]).toBe(32);
    });

    it('TestManualPaintPlugin_SetPixel_NegativeIndex_NoOp', () => {
      expect(() => plugin.setPixel(-1, 255, 0, 0)).not.toThrow();
      const frame = plugin.tick(33);
      for (let i = 0; i < frame!.leds!.length; i++) {
        expect(frame!.leds![i]).toBe(0);
      }
    });

    it('TestManualPaintPlugin_SetPixel_OutOfRange_NoOp', () => {
      expect(() => plugin.setPixel(DEFAULT_LED_COUNT, 255, 0, 0)).not.toThrow();
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
    it('TestManualPaintPlugin_SetEdge_Edge0_SetsCorrectLeds', () => {
      plugin.setEdge(0, 255, 128, 64);
      const frame = plugin.tick(33);
      const ledsOnEdge = EDGE_LED_COUNTS[0]; // 19
      for (let i = 0; i < ledsOnEdge; i++) {
        const off = i * 3;
        expect(frame!.leds![off]).toBe(255);
        expect(frame!.leds![off + 1]).toBe(128);
        expect(frame!.leds![off + 2]).toBe(64);
      }
      // Next LED should be untouched
      expect(frame!.leds![ledsOnEdge * 3]).toBe(0);
    });

    it('TestManualPaintPlugin_SetEdge_Edge11_SetsLastEdge', () => {
      plugin.setEdge(11, 0, 255, 0);
      const frame = plugin.tick(33);
      const start = getEdgeStartIndex(11);
      const ledsOnEdge = EDGE_LED_COUNTS[11]; // 18
      for (let i = start; i < start + ledsOnEdge; i++) {
        const off = i * 3;
        expect(frame!.leds![off]).toBe(0);
        expect(frame!.leds![off + 1]).toBe(255);
        expect(frame!.leds![off + 2]).toBe(0);
      }
      // LED before edge 11 start should be untouched
      expect(frame!.leds![(start - 1) * 3]).toBe(0);
    });
  });

  describe('setFaceEdges', () => {
    it('TestManualPaintPlugin_SetFaceEdges_BottomFace', () => {
      plugin.setFaceEdges(0, 0, 0, 255);
      const frame = plugin.tick(33);
      // Bottom face = edges 0,1,2,3 (19 LEDs each = 76 total)
      const totalLeds = EDGE_LED_COUNTS[0] + EDGE_LED_COUNTS[1] + EDGE_LED_COUNTS[2] + EDGE_LED_COUNTS[3];
      for (let i = 0; i < totalLeds; i++) {
        const off = i * 3;
        expect(frame!.leds![off]).toBe(0);
        expect(frame!.leds![off + 1]).toBe(0);
        expect(frame!.leds![off + 2]).toBe(255);
      }
      // Next LED should be untouched
      expect(frame!.leds![totalLeds * 3]).toBe(0);
    });

    it('TestManualPaintPlugin_SetFaceEdges_FrontFace_SetsCorrectEdges', () => {
      // Front face = edges 0,4,8,9
      plugin.setFaceEdges(2, 255, 255, 0);
      const frame = plugin.tick(33);

      // Edge 0 should be colored
      expect(frame!.leds![0]).toBe(255);
      expect(frame!.leds![1]).toBe(255);
      expect(frame!.leds![2]).toBe(0);

      // Edge 4 should be colored
      const edge4Start = getEdgeStartIndex(4);
      expect(frame!.leds![edge4Start * 3]).toBe(255);

      // Edge 8 should be colored
      const edge8Start = getEdgeStartIndex(8);
      expect(frame!.leds![edge8Start * 3]).toBe(255);

      // Edge 9 should be colored
      const edge9Start = getEdgeStartIndex(9);
      expect(frame!.leds![edge9Start * 3]).toBe(255);

      // Edge 1 should NOT be colored
      const edge1Start = getEdgeStartIndex(1);
      expect(frame!.leds![edge1Start * 3]).toBe(0);
    });
  });

  describe('fill', () => {
    it('TestManualPaintPlugin_Fill_SetsAllLeds', () => {
      plugin.fill(128, 128, 128);
      const frame = plugin.tick(33);
      for (let i = 0; i < DEFAULT_LED_COUNT; i++) {
        const off = i * 3;
        expect(frame!.leds![off]).toBe(128);
        expect(frame!.leds![off + 1]).toBe(128);
        expect(frame!.leds![off + 2]).toBe(128);
      }
    });

    it('TestManualPaintPlugin_Fill_Black_ClearsBuffer', () => {
      plugin.fill(255, 255, 255);
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
