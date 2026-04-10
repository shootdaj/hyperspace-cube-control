---
status: awaiting_human_verify
trigger: "Clicking/dragging on LED spheres in the 3D Three.js visualization does nothing on the physical cube"
created: 2026-04-10T00:00:00Z
updated: 2026-04-10T00:02:00Z
---

## Current Focus

hypothesis: CONFIRMED - Dual output conflict fixed. Primary sACN path enhanced with immediate paint dirty flag. REST fallback uses full buffer with WLED object format (seg:{i:[...]}).
test: Build succeeds, all 54+ tests pass
expecting: User verifies paint clicks change physical cube LEDs
next_action: User verification on physical hardware

## Symptoms

expected: Clicking LED spheres in the 3D cube view should paint them and send per-LED color data to the physical cube
actual: Nothing happens on the physical cube. The 3D visualization LEDs may change color locally but no data reaches the hardware.
errors: None visible
reproduction: Open http://localhost:5173, connect to 192.168.1.160, enable Paint Mode, click on LED dots in the 3D view
started: Has never worked on the physical cube - only the XY grid (REST) and sACN keep-alive work

## Eliminated

- hypothesis: Valtio proxy doesn't work with Uint8Array.set()
  evidence: Tested directly - proxy correctly passes through typed array mutations. CubeMesh useFrame reads same buffer. Node test confirmed end-to-end data flow.
  timestamp: 2026-04-10T00:00:30Z

- hypothesis: Pointer events not firing on InstancedMesh
  evidence: User reports 3D visualization LEDs change color locally, confirming handlePointerDown/applyPaint execute correctly
  timestamp: 2026-04-10T00:00:30Z

- hypothesis: Paint buffer data format wrong (WLEDPaintOutput hex encoding)
  evidence: Tests pass, rgbToHex produces correct output, seg.i format matches WLED docs
  timestamp: 2026-04-10T00:00:30Z

- hypothesis: OrbitControls intercepts pointer events in paint mode  
  evidence: PaintAwareControls disables rotation in paint mode, and user confirms local 3D viz changes
  timestamp: 2026-04-10T00:00:30Z

## Evidence

- timestamp: 2026-04-10T00:00:10Z
  checked: CubeMesh.tsx applyPaint() function
  found: Two output paths - WLEDPaintOutput.sendPaint() (REST seg.i) AND sACN bridge in useFrame (reads ledStateProxy.colors). Both fire on every paint click.
  implication: Dual output creates conflict - REST seg.i is ignored in sACN realtime mode

- timestamp: 2026-04-10T00:00:15Z
  checked: SACNController.startControl() and SACNBridgeOutput.sendRaw()
  found: sacn.isActive() returns true even when bridge WebSocket not connected. sendRaw() silently returns false when bridge disconnected. No error propagation.
  implication: When sACN bridge process not running, ALL sACN frame sends fail silently. No fallback.

- timestamp: 2026-04-10T00:00:20Z
  checked: WLED seg.i behavior when sACN is active
  found: WLED enters "realtime mode" when receiving sACN data. REST/WS state changes (including seg.i) may be ignored/overwritten by sACN frames within milliseconds.
  implication: WLEDPaintOutput REST seg.i is ineffective when sACN is active

- timestamp: 2026-04-10T00:00:25Z
  checked: CubeMesh useFrame sACN bridge 
  found: Reads ledStateProxy.colors (which has paint data) and sends via SACNController.sendFrame(). This path should work IF bridge is connected.
  implication: sACN bridge is the correct primary path for paint data delivery

- timestamp: 2026-04-10T00:00:30Z
  checked: Valtio proxy Uint8Array behavior  
  found: Node.js test confirmed proxy({ colors: new Uint8Array(672) }) correctly handles .set() and index access. Data flows from paint write to sACN frame read.
  implication: Data flow through ledStateProxy is NOT the issue

- timestamp: 2026-04-10T00:00:35Z
  checked: XY Color Grid vs 3D paint comparison
  found: XY grid uses { seg: [{ fx: 0, col: [[r,g,b]] }] } which sets firmware effect color (works with or without sACN). Paint uses seg.i which only works without sACN realtime mode.
  implication: Different REST payload formats have different reliability characteristics

- timestamp: 2026-04-10T00:00:40Z
  checked: WLED seg.i JSON format (array vs object)
  found: Old code used seg:[{id:0,i:[...]}] (array format). WLED docs show seg:{i:[...]} (object format). Array format may not be handled correctly by all firmware versions.
  implication: Switched REST fallback to object format matching WLED documentation

## Resolution

root_cause: Three compounding issues. (1) WLEDPaintOutput.sendPaint() sent diff-based REST seg.i commands which WLED ignores in sACN realtime mode - so when sACN bridge is running, REST paint is overwritten instantly. (2) When sACN bridge is NOT running, sacn.isActive() still returns true (startControl() always sets active=true regardless of bridge connection), so the REST fallback in the old code never triggered. (3) The old WLEDPaintOutput used seg as an array format [{"id":0,"i":[...]}] instead of the standard object format {"i":[...]} documented by WLED. Additionally, it sent only changed LEDs (diff-based) which could be overwritten by the firmware effect loop between sends.

fix: |
  1. CubeMesh.tsx applyPaint(): Removed WLEDPaintOutput.sendPaint() entirely. Added _paintDirty flag that makes useFrame sACN bridge send immediately (bypasses 33ms throttle). Added REST fallback sendPaintViaRest() that sends FULL 224-LED buffer using WLED object format (seg:{i:[...]}) when sACN is not active.
  2. CubeMesh.tsx useFrame: Added _paintDirty check to sACN send condition - when paint happens, the next useFrame frame sends via sACN immediately instead of waiting for the 33ms throttle window.
  3. ControlPanel.tsx: Paint mode auto-enables when paint tab selected, auto-disables when leaving. Kills firmware effect on entering paint tab (when sACN not active).
  4. PaintControls.tsx: Removed "Paint Mode: ON/OFF" toggle button and "Rainbow: ON/OFF" toggle button. Paint mode is always on when on paint tab. Kept XY Color Grid, Brush Size, Clear/Fill. Clear/Fill now use direct REST with full buffer (not WLEDPaintOutput).
  5. PaintControls test: Updated to match new UI (no toggle/rainbow buttons).

verification: Build succeeds, 54+ unit tests pass. Awaiting user verification on physical hardware.
files_changed:
  - src/visualization/CubeMesh.tsx
  - src/control/PaintControls.tsx
  - src/control/ControlPanel.tsx
  - src/control/__tests__/PaintControls.test.tsx
