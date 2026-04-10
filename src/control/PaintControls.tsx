import { useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { paintStore, type BrushSize } from '@/stores/paintStore';
import { paintPlugin } from '@/plugins/inputs/paintSingleton';
import { ledStateProxy } from '@/core/store/ledStateProxy';
import { connectionStore } from '@/core/store/connectionStore';
import { SACNController } from '@/core/wled/SACNController';
import { XYColorGrid } from './XYColorGrid';
import { DEFAULT_LED_COUNT, BYTES_PER_LED } from '@/core/constants';

const BRUSH_OPTIONS: { value: BrushSize; label: string; description: string }[] = [
  { value: 'single', label: 'Single', description: 'One LED' },
  { value: 'edge', label: 'Edge', description: '40 LEDs' },
  { value: 'face', label: 'Face', description: '160 LEDs' },
];

/**
 * Send the full LED buffer to the cube via REST API (non-sACN fallback).
 * Uses WLED seg.i format with all 224 LEDs.
 */
function sendFullBufferViaRest(buffer: Uint8Array): void {
  const ip = connectionStore.getState().ip;
  if (!ip) return;

  const payload: (number | string)[] = [0];
  for (let i = 0; i < DEFAULT_LED_COUNT; i++) {
    const off = i * BYTES_PER_LED;
    const r = buffer[off];
    const g = buffer[off + 1];
    const b = buffer[off + 2];
    payload.push(
      (r < 16 ? '0' : '') + r.toString(16) +
      (g < 16 ? '0' : '') + g.toString(16) +
      (b < 16 ? '0' : '') + b.toString(16),
    );
  }

  fetch(`http://${ip}/json/state`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ seg: { i: payload } }),
  }).catch(() => {});
}

/**
 * PaintControls — color picker, brush size selector, and clear/fill actions
 * for manual LED painting.
 *
 * Paint mode is auto-enabled by ControlPanel when the paint tab is active.
 * No toggle needed — opening the paint tab = paint mode on, leaving = off.
 *
 * All touch targets are min-h-11 (44px) for mobile accessibility.
 */
export function PaintControls() {
  const brushSize = paintStore((s) => s.brushSize);
  const color = paintStore((s) => s.color);

  const handleColorSelect = useCallback((rgb: [number, number, number]) => {
    paintStore.getState().setColor(rgb);
  }, []);

  const handleBrushSize = useCallback((size: BrushSize) => {
    paintStore.getState().setBrushSize(size);
  }, []);

  const handleClear = useCallback(() => {
    paintPlugin.fill(0, 0, 0);
    const buf = paintPlugin.getBuffer();
    ledStateProxy.colors.set(buf);
    ledStateProxy.lastUpdated = performance.now();

    // Send to cube: sACN path handles it via useFrame reading ledStateProxy,
    // REST fallback for when sACN is not active
    let sacnActive = false;
    try { sacnActive = SACNController.getInstance().isActive(); } catch { /* not init */ }
    if (!sacnActive) {
      sendFullBufferViaRest(buf);
    }
  }, []);

  const handleFill = useCallback(() => {
    const [r, g, b] = paintStore.getState().color;
    paintPlugin.fill(r, g, b);
    const buf = paintPlugin.getBuffer();
    ledStateProxy.colors.set(buf);
    ledStateProxy.lastUpdated = performance.now();

    // Send to cube
    let sacnActive = false;
    try { sacnActive = SACNController.getInstance().isActive(); } catch { /* not init */ }
    if (!sacnActive) {
      sendFullBufferViaRest(buf);
    }
  }, []);

  return (
    <div className="space-y-4">
      {/* XY Color Grid — live cube controller */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Color</Label>
        <XYColorGrid
          onColorSelect={handleColorSelect}
          selectedColor={color}
          liveControl
        />
      </div>

      <Separator className="bg-border" />

      {/* Brush Size */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Brush Size</Label>
        <div className="grid grid-cols-3 gap-2">
          {BRUSH_OPTIONS.map((opt) => (
            <Button
              key={opt.value}
              aria-label={opt.label}
              variant={brushSize === opt.value ? 'default' : 'outline'}
              className={`min-h-11 flex flex-col gap-0.5 text-xs ${
                brushSize === opt.value
                  ? 'bg-secondary text-foreground ring-1 ring-ring'
                  : 'border-border text-muted-foreground hover:text-foreground'
              }`}
              onClick={() => handleBrushSize(opt.value)}
            >
              <span className="font-medium">{opt.label}</span>
              <span className="text-[10px] opacity-60">{opt.description}</span>
            </Button>
          ))}
        </div>
      </div>

      <Separator className="bg-border" />

      {/* Actions */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Actions</Label>
        <div className="grid grid-cols-2 gap-2">
          <Button
            aria-label="Clear"
            variant="outline"
            className="min-h-11 border-border text-muted-foreground hover:text-foreground"
            onClick={handleClear}
          >
            Clear
          </Button>
          <Button
            aria-label="Fill"
            variant="outline"
            className="min-h-11 border-border text-muted-foreground hover:text-foreground"
            onClick={handleFill}
          >
            Fill
          </Button>
        </div>
      </div>
    </div>
  );
}
