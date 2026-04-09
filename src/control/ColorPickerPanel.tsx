import { useState, useCallback } from 'react';
import { HexColorPicker } from 'react-colorful';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cubeStateStore } from '@/core/store/cubeStateStore';
import { connectionStore } from '@/core/store/connectionStore';
import { WLEDControlService } from '@/core/wled/WLEDControlService';
import type { WLEDColor } from '@/core/store/types';

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

/**
 * ColorPickerPanel — 3 color slots using react-colorful inside shadcn Popover.
 * Each slot: 44x44px swatch button → click opens popover with HexColorPicker + hex input.
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
      // Debounce would be nice but color picker already throttles internally
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
    <div className="space-y-3">
      <Label className="text-sm font-medium">Colors</Label>
      <div className="flex gap-3">
        {safeColors.map((color, index) => {
          const hex = rgbToHex(color);
          return (
            <Popover
              key={index}
              open={activeSlot === index}
              onOpenChange={(open) => setActiveSlot(open ? index : null)}
            >
              <PopoverTrigger
                aria-label={`${SLOT_LABELS[index]} color`}
                className="min-h-11 min-w-11 h-11 w-11 rounded-md border border-border
                  cursor-pointer transition-transform hover:scale-105
                  focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                style={{ backgroundColor: hex }}
              />
              <PopoverContent className="w-auto p-3" align="start">
                <div className="space-y-3">
                  <p className="text-xs font-medium text-muted-foreground">
                    {SLOT_LABELS[index]}
                  </p>
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
    </div>
  );
}
