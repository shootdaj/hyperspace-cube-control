---
id: quick-7
type: quick
description: XY grid live paint controller
---

## Task 1: Make XY grid the live cube controller

**Files:** src/control/XYColorGrid.tsx (modify), src/control/PaintControls.tsx (modify)
**Action:**
1. Read current XYColorGrid.tsx and PaintControls.tsx
2. In PaintControls.tsx: remove the HexColorPicker popup, hex input, and color swatch. Keep only: Paint Mode toggle, Brush Size selector, Rainbow Mode toggle, Clear/Fill buttons, and the XYColorGrid
3. In XYColorGrid.tsx: 
   - Add a prop `liveControl?: boolean` (default false for backward compat in ColorPickerPanel)
   - When liveControl=true AND user is dragging (pointerdown+pointermove):
     a. Update paintStore color (already done)
     b. Fill all 224 LEDs in ledStateProxy with the selected color
     c. Send REST POST to http://{ip}/json/state with {seg:[{col:[[r,g,b]]}]} 
     d. Throttle REST sends to 30fps (use a lastSendTime check)
   - Import connectionStore and ledStateProxy
   - Use pointerdown/pointermove/pointerup pattern (works on both mouse and touch)
4. In PaintControls.tsx: render XYColorGrid with liveControl={true}
5. The XY grid should be prominent -- make it full width of the panel

**Verify:** Dragging on XY grid changes cube color live
**Done:** XY grid is the primary paint controller
