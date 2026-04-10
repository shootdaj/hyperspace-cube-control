import { useRef, useEffect, useCallback } from 'react';
import { hslToRgb } from '@/plugins/mappings/AudioSpectrumMappingStrategy';

const CANVAS_WIDTH = 280;
const CANVAS_HEIGHT = 120;

interface XYColorGridProps {
  onColorSelect: (rgb: [number, number, number]) => void;
  selectedColor?: [number, number, number];
}

/**
 * Convert RGB to approximate HSL for crosshair positioning.
 * Returns [h (0-360), s (0-1), l (0-1)].
 */
function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const r1 = r / 255;
  const g1 = g / 255;
  const b1 = b / 255;
  const max = Math.max(r1, g1, b1);
  const min = Math.min(r1, g1, b1);
  const l = (max + min) / 2;

  if (max === min) return [0, 0, l];

  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

  let h = 0;
  if (max === r1) h = ((g1 - b1) / d + (g1 < b1 ? 6 : 0)) / 6;
  else if (max === g1) h = ((b1 - r1) / d + 2) / 6;
  else h = ((r1 - g1) / d + 4) / 6;

  return [h * 360, s, l];
}

/**
 * XYColorGrid -- Canvas-based hue x brightness color picker.
 *
 * Horizontal axis: hue (0-360, red through violet)
 * Vertical axis: brightness (top = full brightness, bottom = black)
 * Saturation is always 1.0.
 *
 * Uses ImageData for fast pixel-level gradient rendering.
 * Crosshair indicator tracks the currently selected color.
 */
export function XYColorGrid({ onColorSelect, selectedColor }: XYColorGridProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gradientDataRef = useRef<ImageData | null>(null);
  const pressedRef = useRef(false);

  // Draw the gradient once and cache it
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const imageData = ctx.createImageData(CANVAS_WIDTH, CANVAS_HEIGHT);
    const data = imageData.data;

    for (let y = 0; y < CANVAS_HEIGHT; y++) {
      const brightness = 1.0 - y / CANVAS_HEIGHT;
      const lightness = brightness * 0.5;
      for (let x = 0; x < CANVAS_WIDTH; x++) {
        const hue = (x / CANVAS_WIDTH) * 360;
        const [r, g, b] = hslToRgb(hue, 1.0, lightness);
        const offset = (y * CANVAS_WIDTH + x) * 4;
        data[offset] = r;
        data[offset + 1] = g;
        data[offset + 2] = b;
        data[offset + 3] = 255;
      }
    }

    gradientDataRef.current = imageData;
    ctx.putImageData(imageData, 0, 0);
  }, []);

  // Redraw gradient + crosshair when selectedColor changes
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !gradientDataRef.current) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Restore the cached gradient
    ctx.putImageData(gradientDataRef.current, 0, 0);

    // Draw crosshair at selected color position
    if (selectedColor) {
      const [h, , l] = rgbToHsl(selectedColor[0], selectedColor[1], selectedColor[2]);
      const brightness = Math.min(1, l * 2); // l=0.5 -> brightness=1, l=0 -> brightness=0
      const cx = (h / 360) * CANVAS_WIDTH;
      const cy = (1 - brightness) * CANVAS_HEIGHT;

      // White circle with black outline
      ctx.beginPath();
      ctx.arc(cx, cy, 6, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(cx, cy, 5, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Crosshair lines
      ctx.beginPath();
      ctx.moveTo(cx - 9, cy);
      ctx.lineTo(cx - 3, cy);
      ctx.moveTo(cx + 3, cy);
      ctx.lineTo(cx + 9, cy);
      ctx.moveTo(cx, cy - 9);
      ctx.lineTo(cx, cy - 3);
      ctx.moveTo(cx, cy + 3);
      ctx.lineTo(cx, cy + 9);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }, [selectedColor]);

  const getColorAtPosition = useCallback(
    (clientX: number, clientY: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const scaleX = CANVAS_WIDTH / rect.width;
      const scaleY = CANVAS_HEIGHT / rect.height;
      const x = Math.max(0, Math.min(CANVAS_WIDTH - 1, (clientX - rect.left) * scaleX));
      const y = Math.max(0, Math.min(CANVAS_HEIGHT - 1, (clientY - rect.top) * scaleY));

      const hue = (x / CANVAS_WIDTH) * 360;
      const brightness = 1.0 - y / CANVAS_HEIGHT;
      const lightness = brightness * 0.5;
      const rgb = hslToRgb(hue, 1.0, lightness);
      onColorSelect(rgb);
    },
    [onColorSelect],
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      pressedRef.current = true;
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      getColorAtPosition(e.clientX, e.clientY);
    },
    [getColorAtPosition],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (!pressedRef.current) return;
      getColorAtPosition(e.clientX, e.clientY);
    },
    [getColorAtPosition],
  );

  const handlePointerUp = useCallback(() => {
    pressedRef.current = false;
  }, []);

  return (
    <canvas
      ref={canvasRef}
      width={CANVAS_WIDTH}
      height={CANVAS_HEIGHT}
      className="w-full max-w-full rounded-lg border border-border cursor-crosshair"
      style={{ imageRendering: 'pixelated' }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
    />
  );
}
