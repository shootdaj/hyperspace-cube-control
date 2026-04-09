import { useCallback } from 'react';
import { HexColorPicker } from 'react-colorful';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { paintStore, type BrushSize } from '@/stores/paintStore';
import { paintPlugin } from '@/plugins/inputs/paintSingleton';
import { ledStateProxy } from '@/core/store/ledStateProxy';

/**
 * Convert hex color string "#rrggbb" to [R, G, B] tuple.
 */
function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  return [
    parseInt(clean.slice(0, 2), 16),
    parseInt(clean.slice(2, 4), 16),
    parseInt(clean.slice(4, 6), 16),
  ];
}

/**
 * Convert [R, G, B] tuple to hex string "#rrggbb".
 */
function rgbToHex(r: number, g: number, b: number): string {
  return (
    '#' +
    [r, g, b]
      .map((c) => Math.max(0, Math.min(255, c)).toString(16).padStart(2, '0'))
      .join('')
  );
}

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

  const hexColor = rgbToHex(color[0], color[1], color[2]);

  const handleTogglePaintMode = useCallback(() => {
    paintStore.getState().setIsPaintMode(!paintStore.getState().isPaintMode);
  }, []);

  const handleColorChange = useCallback((hex: string) => {
    paintStore.getState().setColor(hexToRgb(hex));
  }, []);

  const handleBrushSize = useCallback((size: BrushSize) => {
    paintStore.getState().setBrushSize(size);
  }, []);

  const handleClear = useCallback(() => {
    paintPlugin.fill(0, 0, 0);
    ledStateProxy.colors.set(paintPlugin.getBuffer());
    ledStateProxy.lastUpdated = performance.now();
  }, []);

  const handleFill = useCallback(() => {
    const [r, g, b] = paintStore.getState().color;
    paintPlugin.fill(r, g, b);
    ledStateProxy.colors.set(paintPlugin.getBuffer());
    ledStateProxy.lastUpdated = performance.now();
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
              : 'border-zinc-700 text-zinc-400 hover:text-zinc-200'
          }`}
          onClick={handleTogglePaintMode}
        >
          {isPaintMode ? 'Paint Mode: ON' : 'Paint Mode: OFF'}
        </Button>
      </div>

      <Separator className="bg-zinc-800" />

      {/* Color Picker */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Paint Color</Label>
        <div className="flex items-center gap-3">
          <div
            className="h-11 w-11 rounded-md border border-zinc-700 shrink-0"
            style={{ backgroundColor: hexColor }}
          />
          <span className="font-mono text-xs text-zinc-400 uppercase">{hexColor}</span>
        </div>
        <HexColorPicker
          color={hexColor}
          onChange={handleColorChange}
          style={{ width: '100%' }}
        />
      </div>

      <Separator className="bg-zinc-800" />

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
                  ? 'bg-zinc-700 text-white ring-1 ring-zinc-500'
                  : 'border-zinc-700 text-zinc-400 hover:text-zinc-200'
              }`}
              onClick={() => handleBrushSize(opt.value)}
            >
              <span className="font-medium">{opt.label}</span>
              <span className="text-[10px] opacity-60">{opt.description}</span>
            </Button>
          ))}
        </div>
      </div>

      <Separator className="bg-zinc-800" />

      {/* Actions */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Actions</Label>
        <div className="grid grid-cols-2 gap-2">
          <Button
            aria-label="Clear"
            variant="outline"
            className="min-h-11 border-zinc-700 text-zinc-400 hover:text-zinc-200"
            onClick={handleClear}
          >
            Clear
          </Button>
          <Button
            aria-label="Fill"
            variant="outline"
            className="min-h-11 border-zinc-700 text-zinc-400 hover:text-zinc-200"
            onClick={handleFill}
          >
            Fill
          </Button>
        </div>
      </div>
    </div>
  );
}
