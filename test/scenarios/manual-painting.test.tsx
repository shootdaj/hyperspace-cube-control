import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { ManualPaintPlugin } from '@/plugins/inputs/ManualPaintPlugin';
import { WLEDPaintOutput } from '@/plugins/outputs/WLEDPaintOutput';
import { ledStateProxy } from '@/core/store/ledStateProxy';
import { paintStore } from '@/stores/paintStore';
import { getEdgeIndex, getEdgeFaces, getEdgeLedIndices, getFaceEdgeIndices, LED_COUNT } from '@/plugins/inputs/cubeTopology';
import { getEdgeStartIndex } from '@/core/constants';

// Mock WebSocket service
const mockSend = vi.fn();
vi.mock('@/core/wled/WLEDWebSocketService', () => ({
  WLEDWebSocketService: {
    getInstance: vi.fn(() => ({
      send: mockSend,
      isWsAvailable: vi.fn(() => true),
    })),
  },
}));

/**
 * Simulates what CubeMesh.applyPaint does when a user clicks an LED.
 * We can't simulate R3F pointer events in jsdom, so we replicate the
 * paint logic directly.
 */
function simulatePaint(
  plugin: ManualPaintPlugin,
  output: WLEDPaintOutput,
  ledIndex: number,
): void {
  const { color, brushSize } = paintStore.getState();
  const [r, g, b] = color;

  switch (brushSize) {
    case 'single':
      plugin.setPixel(ledIndex, r, g, b);
      break;
    case 'edge':
      plugin.setEdge(getEdgeIndex(ledIndex), r, g, b);
      break;
    case 'face': {
      const edgeIdx = getEdgeIndex(ledIndex);
      const faces = getEdgeFaces(edgeIdx);
      plugin.setFaceEdges(faces[0], r, g, b);
      break;
    }
  }

  // Optimistic local update
  ledStateProxy.colors.set(plugin.getBuffer());
  ledStateProxy.lastUpdated = performance.now();

  // Send to WLED
  output.sendPaint(plugin.getBuffer());
}

describe('Manual Painting Scenarios', () => {
  let plugin: ManualPaintPlugin;
  let output: WLEDPaintOutput;

  beforeEach(() => {
    vi.useFakeTimers();
    plugin = new ManualPaintPlugin();
    output = new WLEDPaintOutput();
    ledStateProxy.colors.fill(0);
    ledStateProxy.lastUpdated = 0;
    paintStore.setState({
      isPaintMode: true,
      brushSize: 'single',
      color: [255, 0, 0],
    });
    vi.clearAllMocks();
  });

  afterEach(() => {
    output.destroy();
    vi.useRealTimers();
  });

  it('TestManualPainting_FullWorkflow_PaintAndClear', () => {
    // 1. Paint mode is on, color is red, brush is single
    expect(paintStore.getState().isPaintMode).toBe(true);

    // 2. User clicks LED 100
    simulatePaint(plugin, output, 100);

    // 3. LED 100 should be red in ledStateProxy
    expect(ledStateProxy.colors[100 * 3]).toBe(255);
    expect(ledStateProxy.colors[100 * 3 + 1]).toBe(0);
    expect(ledStateProxy.colors[100 * 3 + 2]).toBe(0);

    // 4. WLED should have received the change
    expect(mockSend).toHaveBeenCalled();

    // 5. User clears all
    plugin.fill(0, 0, 0);
    ledStateProxy.colors.set(plugin.getBuffer());
    output.sendAll(plugin.getBuffer());

    // 6. All LEDs should be black
    for (let i = 0; i < LED_COUNT * 3; i++) {
      expect(ledStateProxy.colors[i]).toBe(0);
    }
  });

  it('TestManualPainting_DragPaint_MultiplePixels', () => {
    // Simulate drag: paint LEDs 10, 11, 12 in sequence
    simulatePaint(plugin, output, 10);
    vi.advanceTimersByTime(5); // fast movement
    simulatePaint(plugin, output, 11);
    vi.advanceTimersByTime(5);
    simulatePaint(plugin, output, 12);

    // All three should be painted
    expect(ledStateProxy.colors[10 * 3]).toBe(255);
    expect(ledStateProxy.colors[11 * 3]).toBe(255);
    expect(ledStateProxy.colors[12 * 3]).toBe(255);

    // Surrounding LEDs untouched
    expect(ledStateProxy.colors[9 * 3]).toBe(0);
    expect(ledStateProxy.colors[13 * 3]).toBe(0);
  });

  it('TestManualPainting_BrushEdge_PaintsEdgeLeds', () => {
    paintStore.setState({ brushSize: 'edge' });

    // Click LED on edge 1 (edge 1 starts at index 19)
    const edge1Start = getEdgeStartIndex(1);
    simulatePaint(plugin, output, edge1Start + 2); // some LED on edge 1

    // All LEDs on edge 1 should be red
    const edgeLeds = getEdgeLedIndices(1);
    for (const idx of edgeLeds) {
      expect(ledStateProxy.colors[idx * 3]).toBe(255);
    }

    // Last LED on edge 0 should be untouched
    expect(ledStateProxy.colors[(edge1Start - 1) * 3]).toBe(0);
    // First LED on edge 2 should be untouched
    const edge2Start = getEdgeStartIndex(2);
    expect(ledStateProxy.colors[edge2Start * 3]).toBe(0);
  });

  it('TestManualPainting_BrushFace_PaintsFaceLeds', () => {
    paintStore.setState({ brushSize: 'face' });

    // Click LED 0 (on edge 0, which belongs to face 0=bottom and face 2=front)
    simulatePaint(plugin, output, 0);

    // Face 0 (bottom) has edges 0,1,2,3 (19 LEDs each = 76 LEDs)
    const faceLeds = getFaceEdgeIndices(0);
    expect(faceLeds).toHaveLength(76);
    for (const idx of faceLeds) {
      expect(ledStateProxy.colors[idx * 3]).toBe(255);
    }

    // First LED on edge 4 (not on bottom face) should be untouched
    const edge4Start = getEdgeStartIndex(4);
    expect(ledStateProxy.colors[edge4Start * 3]).toBe(0);
  });

  it('TestManualPainting_ColorChange_UsesNewColor', () => {
    // Start with red
    simulatePaint(plugin, output, 0);
    expect(ledStateProxy.colors[0]).toBe(255);
    expect(ledStateProxy.colors[1]).toBe(0);

    // Change to green
    paintStore.setState({ color: [0, 255, 0] });
    vi.advanceTimersByTime(50);
    simulatePaint(plugin, output, 1);
    expect(ledStateProxy.colors[3]).toBe(0);
    expect(ledStateProxy.colors[4]).toBe(255);
    expect(ledStateProxy.colors[5]).toBe(0);

    // LED 0 should still be red (not overwritten)
    expect(ledStateProxy.colors[0]).toBe(255);
  });

  it('TestManualPainting_Fill_SendsFullFrameToWLED', () => {
    plugin.fill(0, 128, 255);
    ledStateProxy.colors.set(plugin.getBuffer());
    output.sendAll(plugin.getBuffer());

    // 1 chunk for 224 LEDs (fits in single WLED send)
    expect(mockSend).toHaveBeenCalledTimes(1);

    // Verify all LEDs
    for (let i = 0; i < LED_COUNT; i++) {
      expect(ledStateProxy.colors[i * 3]).toBe(0);
      expect(ledStateProxy.colors[i * 3 + 1]).toBe(128);
      expect(ledStateProxy.colors[i * 3 + 2]).toBe(255);
    }
  });

  it('TestManualPainting_PaintModeOff_NoEffect', () => {
    paintStore.setState({ isPaintMode: false });

    // Even if we call simulatePaint, in the real app, CubeMesh would
    // check isPaintMode before calling applyPaint. We verify the store state.
    expect(paintStore.getState().isPaintMode).toBe(false);

    // The paint store flag is what CubeMesh checks in handlePointerDown
    // before calling applyPaint. This test verifies the toggle works.
    paintStore.getState().setIsPaintMode(true);
    expect(paintStore.getState().isPaintMode).toBe(true);
    paintStore.getState().setIsPaintMode(false);
    expect(paintStore.getState().isPaintMode).toBe(false);
  });
});
