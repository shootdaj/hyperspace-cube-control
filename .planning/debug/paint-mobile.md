---
status: awaiting_human_verify
trigger: "Paint mode works on desktop but NOT on Android Capacitor native app"
created: 2026-04-10T00:00:00Z
updated: 2026-04-10T00:15:00Z
---

## Current Focus

hypothesis: CONFIRMED and FIXED -- WLEDPaintOutput encoded colors as flat integers in seg.i payload, but WLED requires hex strings or [R,G,B] arrays (uses JSON type-checking to distinguish indices from colors). Now encodes as "RRGGBB" hex strings.
test: All 620 tests pass, build succeeds. Need human verification on physical cube.
expecting: Paint should now work on mobile -- touching LEDs should change their colors on the physical cube.
next_action: User tests on Android Capacitor app

## Symptoms

expected: Touching/dragging on 3D cube in paint mode changes LED colors on physical cube
actual: Nothing happens on physical cube. 3D visualization might update but cube doesn't change
errors: None visible
reproduction: Install APK on Android, connect to cube IP, enable paint mode, try to paint
started: Never worked on mobile -- only desktop

## Eliminated

- hypothesis: R3F pointer events don't fire from touch on Android WebView
  evidence: User reports 3D visualization "might update" -- suggesting pointer events fire. Also, modern Android WebView supports PointerEvents with offsetX/offsetY.
  timestamp: 2026-04-10T00:05:00Z

- hypothesis: SACNController keep-alive overwrites paint data on mobile
  evidence: On mobile, sACN bridge WebSocket (ws://localhost:3001) never connects. SACNBridgeClient.sendFrame() returns false silently. Keep-alive frames are silently dropped. No interference.
  timestamp: 2026-04-10T00:06:00Z

- hypothesis: WLEDStatePoller or InputPipelineRunner overwrites ledStateProxy
  evidence: WLEDStatePoller only writes to cubeStateStore (UI state), not ledStateProxy. InputPipelineRunner only runs when audio/camera/video are active (all default false). WLEDLiveSync guards with isPaintMode check and is no-op when WS unavailable.
  timestamp: 2026-04-10T00:07:00Z

- hypothesis: SACNController.startControl() interferes with paint mode setup
  evidence: startControl sends fx:0, bri:255 via REST which correctly prepares the cube for individual LED control. PaintControls checks sacnActive but this is benign since startControl already sent the kill command.
  timestamp: 2026-04-10T00:07:30Z

## Evidence

- timestamp: 2026-04-10T00:01:00Z
  checked: App.tsx connection flow
  found: On connection, App.tsx always calls startSACN() creating SACNBridgeOutput(ws://localhost:3001) and SACNController.startControl(ip). Happens on ALL platforms.
  implication: SACNController will attempt ws://localhost:3001 on mobile where no bridge exists.

- timestamp: 2026-04-10T00:02:00Z
  checked: SACNController.startControl() flow
  found: startControl() does REST calls to save/kill state (works on mobile), starts keep-alive, sets active=true. Keep-alive sends to dead bridge on mobile.
  implication: SACNController.isActive() returns true on mobile but sACN frames are silently dropped.

- timestamp: 2026-04-10T00:03:00Z
  checked: WLEDPaintOutput.flush() payload format
  found: Builds payload as flat array of numbers: [startIndex, R, G, B, R, G, B, ...]. All values are JavaScript numbers, serialized as JSON integers.
  implication: WLED parser sees all values as integers -- they're all treated as LED indices, not colors.

- timestamp: 2026-04-10T00:08:00Z
  checked: WLED firmware source code (json.cpp) seg.i parsing
  found: WLED uses JSON type-checking: `if (iarr[i].is<JsonInteger>())` -> treat as index, else -> treat as color (parse [R,G,B] array or "RRGGBB" hex string). A flat array of numbers like [5, 255, 0, 0] is ALL interpreted as indices. No setRawPixelColor() calls are made.
  implication: This is the ROOT CAUSE. The seg.i payload format is fundamentally wrong.

- timestamp: 2026-04-10T00:09:00Z
  checked: Why desktop paint works despite wrong payload format
  found: On desktop, CubeMesh useFrame reads ledStateProxy and sends full frame via SACNController -> SACNBridgeOutput -> SACNBridgeClient -> ws://localhost:3001 -> Python bridge -> sACN UDP to cube. sACN has highest priority in WLED and directly controls LEDs, bypassing the JSON API/effect engine entirely. The REST seg.i calls from WLEDPaintOutput are also made but their failure is masked by sACN working correctly.
  implication: The REST fallback path in WLEDPaintOutput has NEVER actually worked. It was always overshadowed by sACN on desktop.

## Resolution

root_cause: WLEDPaintOutput.flush() and sendAll() built the seg.i payload as a flat array of JavaScript numbers [startIdx, R, G, B, ...]. WLED's JSON parser (json.cpp) uses type-checking to distinguish indices from colors: JsonInteger = index, JsonArray/JsonString = color. Since all values in the payload were numbers, WLED interpreted ALL of them as LED indices, never setting any colors. This bug was masked on desktop because the sACN bridge (which works correctly via raw UDP) handles all LED output with higher priority than the JSON API.
fix: Added rgbToHex() helper function and changed both flush() and sendAll() to encode RGB values as "RRGGBB" hex strings in the seg.i payload. Format: [startIdx, "RRGGBB", "RRGGBB", ...]. Updated all test mocks to include isWsAvailable() and assertions to match hex string format.
verification: All 620 tests pass (78 files). Production build succeeds. Awaiting human verification on physical Android device.
files_changed:
  - src/plugins/outputs/WLEDPaintOutput.ts
  - src/plugins/outputs/__tests__/WLEDPaintOutput.test.ts
  - test/integration/paint-pipeline.test.ts
  - test/scenarios/manual-painting.test.tsx
