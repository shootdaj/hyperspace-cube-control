import { create } from 'zustand';

export type BrushSize = 'single' | 'edge' | 'face';

interface PaintState {
  /** Whether paint mode is active (pointer events paint instead of orbit) */
  isPaintMode: boolean;
  /** Current brush size */
  brushSize: BrushSize;
  /** Current paint color as [R, G, B] 0-255 */
  color: [number, number, number];
  /** Whether rainbow mode auto-cycles hue during drag painting */
  rainbowMode: boolean;
  /** Cumulative hue offset during a drag stroke (0-360, wraps) */
  rainbowHueCounter: number;

  setIsPaintMode: (v: boolean) => void;
  setBrushSize: (v: BrushSize) => void;
  setColor: (rgb: [number, number, number]) => void;
  setRainbowMode: (v: boolean) => void;
  resetRainbowHueCounter: () => void;
  /** Increment hue counter by 15 degrees (wraps at 360), returns new value */
  incrementRainbowHueCounter: () => number;
}

export const paintStore = create<PaintState>((set, get) => ({
  isPaintMode: false,
  brushSize: 'single',
  color: [255, 255, 255],
  rainbowMode: false,
  rainbowHueCounter: 0,

  setIsPaintMode: (v) => set({ isPaintMode: v }),
  setBrushSize: (v) => set({ brushSize: v }),
  setColor: (rgb) => set({ color: rgb }),
  setRainbowMode: (v) => set({ rainbowMode: v }),
  resetRainbowHueCounter: () => set({ rainbowHueCounter: 0 }),
  incrementRainbowHueCounter: () => {
    const next = (get().rainbowHueCounter + 15) % 360;
    set({ rainbowHueCounter: next });
    return next;
  },
}));
