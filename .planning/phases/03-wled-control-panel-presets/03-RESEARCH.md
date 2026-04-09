# Phase 3 Research: WLED Control Panel & Presets

**Researched:** 2026-04-09
**Confidence:** HIGH

---

## WLED JSON API Reference

### /json/eff — Effect List

Returns a JSON array of effect name strings, zero-indexed:
```json
["Solid", "Blink", "Breathe", "Wipe", "Wipe Random", "Random Colors", ...]
```
- Effect ID = array index (0 to `info.fxcount - 1`)
- Reserved effects appear as `"RSVD"` or `"-"` and fallback to Solid
- HyperCube hs-1.6 firmware reports `fxcount: 118`

### /json/pal — Palette List

Returns a JSON array of palette name strings, zero-indexed:
```json
["Default", "Random Cycle", "Primary Color", "Based on Primary", ...]
```
- Palette ID = array index (0 to `info.palcount - 1`)
- HyperCube hs-1.6 firmware reports `palcount: 71`

### /json/state — Full State Structure

```typescript
interface WLEDState {
  on: boolean;           // true = on, false = off, "t" = toggle
  bri: number;           // 0-255 master brightness
  transition: number;    // 0-65535, crossfade in 100ms units
  ps: number;            // -1 to 250, current preset ID
  pl: number;            // -1 to 250, current playlist (read-only)
  seg: WLEDSegment[];    // array of segments
  mainseg: number;       // main segment ID
  nl: { on: boolean; dur: number; fade: boolean; tbri: number };
  udpn: { send: boolean; recv: boolean };
  live: boolean;         // realtime mode active
}

interface WLEDSegment {
  id: number;            // 0 to maxseg-1
  start: number;         // LED start position
  stop: number;          // LED stop position (exclusive)
  len: number;           // segment length
  fx: number;            // effect ID (0 to fxcount-1)
  sx: number;            // effect speed (0-255)
  ix: number;            // effect intensity (0-255)
  pal: number;           // palette ID (0 to palcount-1)
  col: number[][];       // up to 3 color slots: [[R,G,B], [R,G,B], [R,G,B]]
  on: boolean;           // segment on/off
  bri: number;           // segment brightness (0-255)
  sel: boolean;          // selected state
  rev: boolean;          // reverse direction
  grp: number;           // grouping (0-255)
  spc: number;           // spacing (0-255)
}
```

### POST to /json/state — Setting Values

POST partial objects to merge with current state:

```json
// Toggle power
{"on": true}
{"on": "t"}

// Set brightness
{"bri": 200}

// Set effect on first segment
{"seg": [{"fx": 42}]}

// Set palette
{"seg": [{"pal": 5}]}

// Set colors (primary, secondary, tertiary)
{"seg": [{"col": [[255, 0, 0], [0, 255, 0], [0, 0, 255]]}]}

// Set speed and intensity
{"seg": [{"sx": 200, "ix": 150}]}

// Combined update
{"on": true, "bri": 200, "seg": [{"fx": 10, "pal": 3, "sx": 128, "ix": 128, "col": [[255, 160, 0]]}]}
```

Special values for `fx`, `pal`, `sx`, `ix`:
- `"~"` = increment by 1
- `"~-"` = decrement by 1
- `"r"` = random

### Preset API

```json
// Load preset
{"ps": 5}

// Save current state as preset
{"psave": 5}
{"psave": 5, "ib": true}   // include brightness
{"psave": 5, "sb": true}   // include segment bounds

// Delete preset
{"pdel": 5}
```

---

## Component Strategy

### shadcn/ui Components to Use

| Component | Use Case | Already Installed |
|-----------|----------|-------------------|
| Button | Power toggle, preset buttons, effect/palette selection | YES |
| Card | Panel containers for control groups | YES |
| Dialog | Preset save dialog (name input) | YES |
| Input | Preset name, search filter | YES |
| Label | Slider labels | YES |
| Badge | Active effect/palette indicator | YES |
| Slider | Brightness, speed, intensity | NEEDS INSTALL |
| Tabs | Panel switching on mobile | NEEDS INSTALL |
| ScrollArea | Effect/palette list scrolling | NEEDS INSTALL |
| Popover | Color picker popover | NEEDS INSTALL |
| Tooltip | Control descriptions | NEEDS INSTALL |
| Switch | Power on/off toggle | NEEDS INSTALL |
| Separator | Visual dividers | NEEDS INSTALL |

### react-colorful Integration

Use `HexColorPicker` from react-colorful inside a shadcn Popover:
- Button shows current color swatch
- Click opens Popover with HexColorPicker
- On change, convert hex to RGB array for WLED API
- 3 color slots: primary, secondary, tertiary

Pattern:
```tsx
import { HexColorPicker } from 'react-colorful';
// Wrap in shadcn Popover for consistent UI
<Popover>
  <PopoverTrigger asChild>
    <Button style={{ backgroundColor: color }} />
  </PopoverTrigger>
  <PopoverContent>
    <HexColorPicker color={color} onChange={setColor} />
  </PopoverContent>
</Popover>
```

---

## Responsive Layout Strategy

### Mobile (375px) — Stacked Panels
- Single column, full-width
- Tabs at top for panel switching: Control | Effects | Palettes | Presets
- 3D cube takes top 40% of viewport
- Control panel fills bottom 60%, scrollable
- All touch targets >= 44px height
- Sliders: full-width with large thumb (20px radius)

### Desktop (1440px) — Multi-Panel
- 3D cube takes left 60%
- Right sidebar (40%) with stacked control sections
- No tab switching needed — all sections visible
- Scrollable sidebar for overflow

### Breakpoint
- `md` (768px) = switch from stacked to side-by-side
- Use Tailwind responsive classes: `flex-col md:flex-row`

### Touch Target Requirements (WCAG 2.5.8)
- Minimum 44x44px for all interactive elements
- Slider thumb: 20px radius minimum (40px diameter)
- Buttons: min-h-11 (44px) with adequate padding
- List items: py-3 minimum for comfortable tapping

---

## Architecture: State Round-Trip (CTRL-07)

```
User Action (slider/toggle/pick)
  → Zustand cubeStateStore action (optimistic update)
  → WLEDRestClient.setState() (serialized POST)
  → WLED firmware processes
  → WebSocket pushes updated state back
  → cubeStateStore.syncFromWLED() (confirm/correct)
  → ledStateProxy updated by WLEDLiveSync
  → CubeMesh.useFrame reads ledStateProxy (3D reflects change)
```

Key principles:
- Components NEVER call WLED API directly
- All mutations go through cubeStateStore actions → WLEDRestClient
- WebSocket provides ground truth (reconciles optimistic updates)
- Debounce slider changes (100ms) to avoid flooding ESP32

---

## Preset System Design (PRES-01 through PRES-05)

### Data Model
```typescript
interface Preset {
  id: string;           // UUID
  name: string;         // User-provided name
  createdAt: number;    // Date.now()
  state: {
    on: boolean;
    bri: number;
    fx: number;
    pal: number;
    sx: number;
    ix: number;
    col: [number, number, number][];  // up to 3 colors
  };
}
```

### Storage
- localStorage key: `hypercube-presets`
- JSON array of Preset objects
- Max 50 presets (PRES-05)
- Save: serialize current cubeStateStore to Preset
- Load: POST preset.state to WLED via WLEDRestClient
- Delete: remove from array, update localStorage

---

## Sources

- [WLED JSON API Documentation](https://kno.wled.ge/interfaces/json-api/)
- [WLED JSON API Wiki](https://github.com/wled/WLED/wiki/JSON-API)
- [react-colorful + shadcn/ui integration](https://github.com/nightspite/shadcn-color-picker)
- [shadcn/ui Slider Component](https://www.shadcn.io/ui/slider)
- [shadcn/ui Components](https://ui.shadcn.com/docs/components)
