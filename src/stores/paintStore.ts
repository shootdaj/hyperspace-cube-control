import { create } from 'zustand';

export type BrushSize = 'single' | 'edge' | 'face';

interface PaintState {
  /** Whether paint mode is active (pointer events paint instead of orbit) */
  isPaintMode: boolean;
  /** Current brush size */
  brushSize: BrushSize;
  /** Current paint color as [R, G, B] 0-255 */
  color: [number, number, number];

  setIsPaintMode: (v: boolean) => void;
  setBrushSize: (v: BrushSize) => void;
  setColor: (rgb: [number, number, number]) => void;
}

export const paintStore = create<PaintState>((set) => ({
  isPaintMode: false,
  brushSize: 'single',
  color: [255, 255, 255],

  setIsPaintMode: (v) => set({ isPaintMode: v }),
  setBrushSize: (v) => set({ brushSize: v }),
  setColor: (rgb) => set({ color: rgb }),
}));
