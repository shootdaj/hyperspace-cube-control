import { useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { paintStore, type BrushSize } from '@/stores/paintStore';
import { paintPlugin, paintOutput } from '@/plugins/inputs/paintSingleton';
import { ledStateProxy } from '@/core/store/ledStateProxy';
import { connectionStore } from '@/core/store/connectionStore';
import { SACNController } from '@/core/wled/SACNController';
import { XYColorGrid } from './XYColorGrid';

const BRUSH_OPTIONS: { value: BrushSize; label: string; description: string }[] = [
  { value: 'single', label: 'Single', description: 'One LED' },
  { value: 'edge', label: 'Edge', description: '40 LEDs' },
  { value: 'face', label: 'Face', description: '160 LEDs' },
];

/**
 * PaintControls — color picker, brush size selector, paint mode toggle,
 * and clear/fill actions for manual LED painting.
 *
 * All touch targets are min-h-11 (44px) for mobile accessibility.
 */
export function PaintControls() {
  const isPaintMode = paintStore((s) => s.isPaintMode);
  const brushSize = paintStore((s) => s.brushSize);
  const color = paintStore((s) => s.color);
  const rainbowMode = paintStore((s) => s.rainbowMode);

  const handleTogglePaintMode = useCallback(() => {
    const entering = !paintStore.getState().isPaintMode;
    paintStore.getState().setIsPaintMode(entering);

    // Kill firmware effect when entering paint mode without sACN
    if (entering) {
      let sacnActive = false;
      try { sacnActive = SACNController.getInstance().isActive(); } catch { /* not initialized */ }
      if (!sacnActive) {
        const ip = connectionStore.getState().ip;
        if (ip) {
          fetch(`http://${ip}/json/state`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ on: true, bri: 255, seg: [{ fx: 0, sx: 0, ix: 0 }] }),
          }).catch(() => {});
        }
      }
    }
  }, []);

  const handleColorSelect = useCallback((rgb: [number, number, number]) => {
    paintStore.getState().setColor(rgb);
  }, []);

  const handleBrushSize = useCallback((size: BrushSize) => {
    paintStore.getState().setBrushSize(size);
  }, []);

  const handleClear = useCallback(() => {
    paintPlugin.fill(0, 0, 0);
    ledStateProxy.colors.set(paintPlugin.getBuffer());
    ledStateProxy.lastUpdated = performance.now();
    paintOutput.sendAll(paintPlugin.getBuffer());
  }, []);

  const handleFill = useCallback(() => {
    const [r, g, b] = paintStore.getState().color;
    paintPlugin.fill(r, g, b);
    ledStateProxy.colors.set(paintPlugin.getBuffer());
    ledStateProxy.lastUpdated = performance.now();
    paintOutput.sendAll(paintPlugin.getBuffer());
  }, []);

  return (
    <div className="space-y-4">
      {/* Paint Mode Toggle */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Paint Mode</Label>
        <Button
          aria-label="Paint Mode"
          variant={isPaintMode ? 'default' : 'outline'}
          className={`w-full min-h-11 text-sm font-medium ${
            isPaintMode
              ? 'bg-green-600 hover:bg-green-700 text-white'
              : 'border-border text-muted-foreground hover:text-foreground'
          }`}
          onClick={handleTogglePaintMode}
        >
          {isPaintMode ? 'Paint Mode: ON' : 'Paint Mode: OFF'}
        </Button>
        {isPaintMode && (
          <Button
            aria-label="Rainbow Mode"
            variant={rainbowMode ? 'default' : 'outline'}
            className={`w-full min-h-11 text-sm font-medium ${
              rainbowMode
                ? 'text-white border-0'
                : 'border-border text-muted-foreground hover:text-foreground'
            }`}
            style={
              rainbowMode
                ? { background: 'linear-gradient(90deg, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)' }
                : undefined
            }
            onClick={() => paintStore.getState().setRainbowMode(!paintStore.getState().rainbowMode)}
          >
            {rainbowMode ? 'Rainbow: ON' : 'Rainbow: OFF'}
          </Button>
        )}
      </div>

      <Separator className="bg-border" />

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
