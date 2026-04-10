import { useState, useCallback } from 'react';
import { HexColorPicker } from 'react-colorful';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { cubeStateStore } from '@/core/store/cubeStateStore';
import { connectionStore } from '@/core/store/connectionStore';
import { WLEDControlService } from '@/core/wled/WLEDControlService';
import { SACNController } from '@/core/wled/SACNController';
import { ledStateProxy } from '@/core/store/ledStateProxy';
import { Palette } from 'lucide-react';
import type { WLEDColor } from '@/core/store/types';
import { XYColorGrid } from './XYColorGrid';
import { paintStore } from '@/stores/paintStore';
import { Separator } from '@/components/ui/separator';

/**
 * Convert hex color string to RGB tuple.
 * Accepts "#rrggbb" or "rrggbb".
 */
export function hexToRgb(hex: string): WLEDColor {
  const clean = hex.replace('#', '');
  return [
    parseInt(clean.slice(0, 2), 16),
    parseInt(clean.slice(2, 4), 16),
    parseInt(clean.slice(4, 6), 16),
  ];
}

/**
 * Convert RGB tuple to hex color string "#rrggbb".
 */
export function rgbToHex(rgb: WLEDColor): string {
  return (
    '#' +
    rgb
      .map((c) => Math.max(0, Math.min(255, c)).toString(16).padStart(2, '0'))
      .join('')
  );
}

const SLOT_LABELS = ['Primary', 'Secondary', 'Tertiary'];
const SLOT_SHORTCUTS = ['1', '2', '3'];

/**
 * ColorPickerPanel — 3 color slots using react-colorful inside shadcn Popover.
 * Redesigned: 48px swatches with labels, accent-bordered section header.
 */
export function ColorPickerPanel() {
  const colors = cubeStateStore((s) => s.colors);
  const ip = connectionStore((s) => s.ip);
  const [activeSlot, setActiveSlot] = useState<number | null>(null);

  // Ensure we always have 3 color slots
  const safeColors: WLEDColor[] = [
    colors[0] || [255, 160, 0],
    colors[1] || [0, 0, 0],
    colors[2] || [0, 0, 0],
  ];

  const handleColorChange = useCallback(
    (slot: number, hex: string) => {
      if (!ip) return;
      const newColors: WLEDColor[] = [...safeColors];
      newColors[slot] = hexToRgb(hex);
      cubeStateStore.getState().setColors(newColors);

      // Send via sACN for instant visual feedback: fill all 224 LEDs with primary color
      try {
        const sacn = SACNController.getInstance();
        if (sacn.isActive()) {
          const [r, g, b] = newColors[0]; // Primary color fills the cube
          const brightness = cubeStateStore.getState().brightness;
          const factor = brightness / 255;
          const frame = new Uint8Array(SACNController.FRAME_SIZE);
          for (let i = 0; i < 224; i++) {
            frame[i * 3] = Math.round(r * factor);
            frame[i * 3 + 1] = Math.round(g * factor);
            frame[i * 3 + 2] = Math.round(b * factor);
          }
          sacn.sendFrame(frame);

          // Also update ledStateProxy so the 3D visualization matches
          for (let i = 0; i < 224; i++) {
            ledStateProxy.colors[i * 3] = r;
            ledStateProxy.colors[i * 3 + 1] = g;
            ledStateProxy.colors[i * 3 + 2] = b;
          }
          ledStateProxy.lastUpdated = performance.now();
        }
      } catch {
        // SACNController not initialized — ignore
      }

      // Also send via REST (for firmware state sync)
      WLEDControlService.getInstance(ip).setColors(newColors);
    },
    [ip, safeColors],
  );

  const handleHexInput = useCallback(
    (slot: number, value: string) => {
      // Only dispatch if it's a valid 6-char hex
      const clean = value.replace('#', '');
      if (/^[0-9a-fA-F]{6}$/.test(clean)) {
        handleColorChange(slot, '#' + clean);
      }
    },
    [handleColorChange],
  );

  return (
    <div className="space-y-4">
      <div className="section-header">
        <Palette className="w-3.5 h-3.5 text-primary" />
        <span>Colors</span>
      </div>

      <div className="flex gap-3">
        {safeColors.map((color, index) => {
          const hex = rgbToHex(color);
          return (
            <Popover
              key={index}
              open={activeSlot === index}
              onOpenChange={(open) => setActiveSlot(open ? index : null)}
            >
              <div className="flex flex-col items-center gap-1.5">
                <PopoverTrigger
                  aria-label={`${SLOT_LABELS[index]} color`}
                  className="
                    min-h-12 min-w-12 h-12 w-12 rounded-lg border-2 border-border
                    cursor-pointer transition-all duration-200
                    hover:scale-110 hover:border-primary/50
                    focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none
                    shadow-[inset_0_0_12px_rgba(0,0,0,0.3)]
                  "
                  style={{
                    backgroundColor: hex,
                    boxShadow: activeSlot === index
                      ? `0 0 16px ${hex}40, inset 0 0 12px rgba(0,0,0,0.3)`
                      : 'inset 0 0 12px rgba(0,0,0,0.3)',
                  }}
                />
                <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">
                  {SLOT_SHORTCUTS[index]}:{SLOT_LABELS[index].slice(0, 3)}
                </span>
              </div>

              <PopoverContent className="w-auto p-4" align="start">
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-4 h-4 rounded-sm border border-border/50"
                      style={{ backgroundColor: hex }}
                    />
                    <p className="text-xs font-semibold text-foreground uppercase tracking-wider">
                      {SLOT_LABELS[index]}
                    </p>
                  </div>
                  <HexColorPicker
                    color={hex}
                    onChange={(newHex) => handleColorChange(index, newHex)}
                  />
                  <Input
                    value={hex}
                    onChange={(e) => handleHexInput(index, e.target.value)}
                    className="font-mono text-sm h-9"
                    maxLength={7}
                  />
                </div>
              </PopoverContent>
            </Popover>
          );
        })}
      </div>

      <Separator className="bg-border" />

      <XYColorGrid
        onColorSelect={(rgb) => {
          const hex = rgbToHex(rgb as WLEDColor);
          handleColorChange(activeSlot ?? 0, hex);
          paintStore.getState().setColor(rgb);
        }}
        selectedColor={safeColors[activeSlot ?? 0] as [number, number, number]}
      />
    </div>
  );
}
