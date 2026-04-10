---
phase: quick-4
plan: 1
type: execute
wave: 1
depends_on: []
files_modified:
  - src/stores/midiStore.ts
  - src/plugins/inputs/MIDIMappingEngine.ts
  - src/control/MIDIControls.tsx
  - src/stores/paintStore.ts
  - src/visualization/CubeMesh.tsx
  - src/control/PaintControls.tsx
  - src/control/ColorPickerPanel.tsx
  - src/control/XYColorGrid.tsx
autonomous: true
requirements: []

must_haves:
  truths:
    - "MIDI drum pad note-on fills all 224 LEDs with a rainbow-mapped color"
    - "8 pad color squares appear in MIDI Controls when MIDI is enabled"
    - "Rainbow paint mode auto-cycles hue as user drags across LEDs"
    - "XY color grid canvas renders hue x brightness gradient below color swatches"
    - "Clicking/dragging XY grid updates the active paint color swatch"
  artifacts:
    - path: "src/stores/midiStore.ts"
      provides: "Drum pad color state and pad-specific learn mode"
    - path: "src/plugins/inputs/MIDIMappingEngine.ts"
      provides: "handleNoteOnMessage routes pad notes to LED flash"
    - path: "src/control/MIDIControls.tsx"
      provides: "Pad Colors section with 8 colored squares"
    - path: "src/stores/paintStore.ts"
      provides: "rainbowMode flag and hueCounter state"
    - path: "src/visualization/CubeMesh.tsx"
      provides: "applyPaint uses hue cycling when rainbow mode on"
    - path: "src/control/PaintControls.tsx"
      provides: "Rainbow Mode toggle button"
    - path: "src/control/XYColorGrid.tsx"
      provides: "Canvas-based hue x brightness color picker"
    - path: "src/control/ColorPickerPanel.tsx"
      provides: "Renders XYColorGrid below swatches"
  key_links:
    - from: "src/plugins/inputs/MIDIMappingEngine.ts"
      to: "ledStateProxy"
      via: "handleNoteOnMessage fills all 224 LEDs on pad note"
      pattern: "ledStateProxy\\.colors"
    - from: "src/visualization/CubeMesh.tsx"
      to: "src/stores/paintStore.ts"
      via: "applyPaint reads rainbowMode and increments hueCounter"
      pattern: "paintStore\\.getState\\(\\)\\.rainbowMode"
    - from: "src/control/XYColorGrid.tsx"
      to: "src/stores/paintStore.ts"
      via: "onColorSelect callback updates paint color"
      pattern: "paintStore\\.getState\\(\\)\\.setColor"
---

<objective>
Add three creative UX features: (1) MIDI drum pad triggers that flash rainbow colors on all 224 LEDs, (2) rainbow drag painting that auto-cycles hue, and (3) an XY hue/brightness color grid canvas.

Purpose: Expand the creative control toolkit with expressive MIDI performance triggers, more playful paint modes, and a faster spatial color picker.
Output: Updated MIDI controls with pad section, rainbow paint toggle, and new XY color grid component.
</objective>

<execution_context>
@/Users/anshul/.claude/get-shit-done/workflows/execute-plan.md
@/Users/anshul/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@CLAUDE.md
@src/stores/midiStore.ts
@src/plugins/inputs/MIDIMappingEngine.ts
@src/plugins/inputs/MIDIPlugin.ts
@src/control/MIDIControls.tsx
@src/stores/paintStore.ts
@src/visualization/CubeMesh.tsx
@src/control/PaintControls.tsx
@src/control/ColorPickerPanel.tsx
@src/plugins/inputs/paintSingleton.ts
@src/core/store/ledStateProxy.ts
@src/core/pipeline/types.ts

<interfaces>
<!-- Key types and contracts the executor needs -->

From src/core/pipeline/types.ts:
```typescript
export interface FrameData {
  type: 'direct' | 'video' | 'audio' | 'midi';
  leds?: Uint8Array;
  canvas?: OffscreenCanvas;
  spectrum?: Float32Array;
  midiCC?: Map<number, number>;
}
```

From src/stores/midiStore.ts:
```typescript
export interface NoteMapping {
  channel: number;
  note: number;
  action: 'preset' | 'effect';
  actionIndex: number;
}
export type MIDILearnTarget =
  | { type: 'cc'; target: CCMapping['target'] }
  | { type: 'note'; action: NoteMapping['action']; actionIndex: number }
  | null;
```

From src/stores/paintStore.ts:
```typescript
interface PaintState {
  isPaintMode: boolean;
  brushSize: BrushSize;
  color: [number, number, number];
  setIsPaintMode: (v: boolean) => void;
  setBrushSize: (v: BrushSize) => void;
  setColor: (rgb: [number, number, number]) => void;
}
```

From src/plugins/inputs/MIDIMappingEngine.ts:
```typescript
export function hueToRGB(hue: number): [number, number, number];
export function handleNoteOnMessage(channel: number, note: number, _velocity: number): void;
export function executeNoteAction(mapping: NoteMapping): void;
```

From src/plugins/mappings/AudioSpectrumMappingStrategy.ts:
```typescript
export function hslToRgb(h: number, s: number, l: number): [number, number, number];
```

From src/core/store/ledStateProxy.ts:
```typescript
export const ledStateProxy = proxy({
  colors: new Uint8Array(DEFAULT_LED_COUNT * BYTES_PER_LED), // 224 * 3 = 672
  lastUpdated: 0,
});
```

From src/control/ColorPickerPanel.ts:
```typescript
export function hexToRgb(hex: string): WLEDColor;
export function rgbToHex(rgb: WLEDColor): string;
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: MIDI Drum Pad Color Triggers</name>
  <files>src/stores/midiStore.ts, src/plugins/inputs/MIDIMappingEngine.ts, src/control/MIDIControls.tsx</files>
  <action>
**midiStore.ts** -- Add drum pad state:
- Add a `padColors` field: `padColors: [number, number, number][]` -- array of 8 RGB tuples, default to rainbow: `[255,0,0], [255,127,0], [255,255,0], [0,255,0], [0,127,255], [0,0,255], [127,0,255], [255,0,127]`
- Add a `padNoteMap` field: `padNoteMap: number[]` -- array of 8 MIDI note numbers, default to `[36,37,38,39,40,41,42,43]` (standard drum pad notes on AKAI MIDImix)
- Add a `padHoldMode` field: `padHoldMode: boolean` -- default `false` (false = fade back on release, true = hold color)
- Add a `padLearnIndex` field: `padLearnIndex: number | null` -- which pad is in learn mode
- Add actions: `setPadColor(index: number, rgb: [number, number, number])`, `setPadNote(index: number, note: number)`, `setPadHoldMode(v: boolean)`, `setPadLearnIndex(index: number | null)`

**MIDIMappingEngine.ts** -- Add pad flash logic:
- Add a new exported function `handleDrumPadNoteOn(channel: number, note: number, velocity: number): boolean` that:
  - Checks if `note` exists in `midiStore.getState().padNoteMap`
  - If found, gets the pad index and corresponding `padColors[index]`
  - Fills ALL 224 LEDs in `ledStateProxy.colors` with that RGB color (loop i=0..223, set colors[i*3], colors[i*3+1], colors[i*3+2])
  - Sets `ledStateProxy.lastUpdated = performance.now()`
  - Returns `true` (consumed)
  - If not found, returns `false`
- Add a new exported function `handleDrumPadNoteOff(note: number): void` that:
  - If `padHoldMode` is false and note is in padNoteMap, fills all LEDs with black (0,0,0)
  - Updates ledStateProxy.lastUpdated
- Modify `handleNoteOnMessage`: BEFORE existing learn-mode/mapping logic, call `handleDrumPadNoteOn(channel, note, velocity)`. If it returns `true`, return early.
  - Also: if `padLearnIndex !== null`, set `padNoteMap[padLearnIndex] = note` via `setPadNote()`, set `padLearnIndex(null)`, return early.

**MIDIPlugin.ts** -- Add note-off listener:
- In `attachInputListeners()`, add a `noteoff` listener alongside the existing `noteon` listener
- The noteoff handler calls a new exported `handleNoteOffMessage(channel, note)` from MIDIMappingEngine
- Add `handleNoteOffMessage` to MIDIMappingEngine.ts: it just calls `handleDrumPadNoteOff(note)`

**MIDIControls.tsx** -- Add "Pad Colors" section:
- After the CC Mappings section (before Note-to-Preset), add a new section with `<Label>Drum Pad Colors</Label>`
- Render 8 colored squares in a `grid grid-cols-4 gap-2` layout
- Each square: `min-h-11 min-w-11 rounded-md border-2 border-border cursor-pointer` with `backgroundColor` from `midiStore.padColors[i]`
- Below each square: small text showing the assigned note number (e.g., "N36")
- Click a square to open a color popover (use react-colorful HexColorPicker in a shadcn Popover) that updates `setPadColor(index, rgb)`
- Add a "Learn" button per pad: when clicked, sets `padLearnIndex` to that pad index; next MIDI note received assigns to that pad
- Show visual indicator (amber border + pulse) when a pad is in learn mode
- Add a "Hold Mode" toggle below the grid: checkbox or small toggle button that sets `padHoldMode`
- Wrap the whole section in the `isEnabled && (...)` conditional so it only shows when MIDI is active
  </action>
  <verify>
    <automated>npm run build 2>&1 | tail -5</automated>
  </verify>
  <done>
- 8 drum pad color squares visible in MIDI Controls panel when MIDI enabled
- Each pad square is clickable to change its color via color picker popover
- "Learn" button per pad enters learn mode (amber highlight), next MIDI note assigns to that pad
- Hold Mode toggle present below the pad grid
- MIDIMappingEngine routes pad note-on to fill all 224 LEDs via ledStateProxy
- Note-off clears LEDs when hold mode is off
  </done>
</task>

<task type="auto">
  <name>Task 2: Paint Rainbow Drag Mode</name>
  <files>src/stores/paintStore.ts, src/visualization/CubeMesh.tsx, src/control/PaintControls.tsx</files>
  <action>
**paintStore.ts** -- Add rainbow mode state:
- Add `rainbowMode: boolean` field, default `false`
- Add `rainbowHueCounter: number` field, default `0` (tracks cumulative hue offset during a drag)
- Add actions: `setRainbowMode(v: boolean)`, `resetRainbowHueCounter()`, `incrementRainbowHueCounter(): number` (increments by 15 and returns the new value; wraps at 360)

**CubeMesh.tsx** -- Modify applyPaint for rainbow mode:
- Import `hslToRgb` from `@/plugins/mappings/AudioSpectrumMappingStrategy`
- At the TOP of `applyPaint(ledIndex)`, check `paintStore.getState().rainbowMode`
- If rainbow mode is ON:
  - Call `paintStore.getState().incrementRainbowHueCounter()` to get the current hue (0-360)
  - Convert to RGB: `const [r, g, b] = hslToRgb(hue, 1.0, 0.5)` -- this returns 0-255 values
  - Override the color variable: instead of reading `paintStore.getState().color`, use the computed `[r, g, b]`
  - Also update `paintStore.getState().setColor([r, g, b])` so the color picker swatch visually tracks the current rainbow position
- If rainbow mode is OFF: existing behavior unchanged
- In `handlePointerDown`: if rainbow mode is on, call `paintStore.getState().resetRainbowHueCounter()` to restart the hue cycle at the start of each new drag stroke
- In `handlePointerUp`: no changes needed (hue counter persists for next stroke or resets on next pointerDown)

**PaintControls.tsx** -- Add Rainbow Mode toggle:
- Subscribe to `paintStore((s) => s.rainbowMode)`
- After the "Paint Mode" toggle button and before the Separator, add a new row:
  - A `Button` labeled "Rainbow: ON" / "Rainbow: OFF" with a toggle style similar to paint mode
  - When ON: use a gradient background via inline style `background: linear-gradient(90deg, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)` with white text
  - When OFF: standard outline style
  - onClick: `paintStore.getState().setRainbowMode(!paintStore.getState().rainbowMode)`
- Only show this button when isPaintMode is true (it's a paint sub-mode)
  </action>
  <verify>
    <automated>npm run build 2>&1 | tail -5</automated>
  </verify>
  <done>
- Rainbow Mode toggle button appears in PaintControls when paint mode is on
- Toggle shows rainbow gradient background when active
- Dragging across LEDs in rainbow mode cycles hue by ~15 degrees per LED painted
- Each new drag stroke resets the hue counter
- Color picker swatch updates to show current rainbow position during drag
  </done>
</task>

<task type="auto">
  <name>Task 3: XY Hue-Brightness Color Grid</name>
  <files>src/control/XYColorGrid.tsx, src/control/ColorPickerPanel.tsx</files>
  <action>
**XYColorGrid.tsx** -- Create new component:
- Create `src/control/XYColorGrid.tsx` as a new React component
- Props: `onColorSelect: (rgb: [number, number, number]) => void`, `selectedColor?: [number, number, number]`
- Render a `<canvas>` element: width 280px, height 120px, with `rounded-lg border border-border cursor-crosshair` classes
- On mount (useEffect with ref), draw the gradient:
  - Use a 2D canvas context
  - For each pixel column x (0 to width): hue = (x / width) * 360
  - For each pixel row y (0 to height): brightness = 1.0 - (y / height) (top = full brightness, bottom = black)
  - Compute RGB using `hslToRgb(hue, 1.0, brightness * 0.5)` from `@/plugins/mappings/AudioSpectrumMappingStrategy`
  - Use `ctx.fillStyle` and `ctx.fillRect(x, y, 1, 1)` for each pixel, OR better: create an ImageData, fill pixel-by-pixel, then putImageData once (much faster)
- Mouse/touch interaction:
  - On `mousedown` / `touchstart`: start tracking, compute color at position, call `onColorSelect(rgb)`
  - On `mousemove` / `touchmove` (while pressed): same -- compute color at pointer position, call `onColorSelect(rgb)`
  - On `mouseup` / `touchend`: stop tracking
  - Use `useCallback` for handlers, track pressed state with a ref
- Crosshair indicator:
  - Draw a small crosshair (circle outline + crosshair lines) at the position corresponding to `selectedColor`
  - To find position from color: convert selectedColor to HSL, x = (h/360) * width, y = (1 - brightness) * height
  - Use a second useEffect or draw overlay on each color change
  - Approach: draw the gradient once into an offscreen canvas or ImageData cache, then on each render, draw the cached gradient + crosshair on the visible canvas
  - Crosshair: white circle (r=6) with 1px black outline for visibility on all backgrounds
- Keep the canvas responsive: use `w-full` on the container, but fixed 280x120 canvas resolution. Or set canvas width to container width via ResizeObserver. Simpler: just use fixed 280x120 with `max-w-full`.

**ColorPickerPanel.tsx** -- Integrate XY grid:
- Import `XYColorGrid` from `./XYColorGrid`
- Import `paintStore` from `@/stores/paintStore`
- After the existing swatch `<div className="flex gap-3">` block and before the closing `</div>`, add:
  - A `<Separator />` or small gap
  - `<XYColorGrid onColorSelect={(rgb) => { /* update active slot */ }} selectedColor={safeColors[activeSlot ?? 0]} />`
  - The `onColorSelect` callback should: update the active color swatch via `handleColorChange(activeSlot ?? 0, rgbToHex([r,g,b] as WLEDColor))` where rgbToHex is the existing function
  - Also update paintStore color: `paintStore.getState().setColor(rgb)` so paint mode picks up the XY grid selection
  </action>
  <verify>
    <automated>npm run build 2>&1 | tail -5</automated>
  </verify>
  <done>
- XY color grid canvas renders below the 3 color swatches in ColorPickerPanel
- Horizontal axis shows full hue rainbow (red through violet)
- Vertical axis fades from full brightness (top) to black (bottom)
- Click/drag on canvas selects color and updates active swatch
- White crosshair indicator shows current selection position
- Selected color also updates paintStore for paint mode usage
  </done>
</task>

</tasks>

<verification>
- `npm run build` completes without errors
- `npm run lint` passes (or only has pre-existing warnings)
- All three features are visually present in the UI:
  1. MIDI Controls shows 8 colored pad squares when MIDI is enabled
  2. PaintControls shows Rainbow toggle when paint mode is active
  3. ColorPickerPanel shows XY hue/brightness canvas below swatches
</verification>

<success_criteria>
- Build passes with zero TypeScript errors
- MIDI drum pad section renders 8 colored squares with learn/color-change capability
- Drum pad note-on fills all 224 LEDs via ledStateProxy
- Rainbow paint mode cycles hue by ~15 degrees per LED during drag
- XY color grid renders hue x brightness gradient and supports click/drag selection
- All three features work independently without breaking existing functionality
</success_criteria>

<output>
After completion, create `.planning/quick/4-midi-drum-pad-triggers-paint-rainbow-dra/4-SUMMARY.md`
</output>
