---
status: fixing
trigger: "Paint mode shows as ON in UI, color selected, app shows Connected status, but clicking/dragging on the 3D cube does nothing — no visual feedback, no LED changes on physical cube."
created: 2026-04-10T00:00:00Z
updated: 2026-04-10T00:02:00Z
---

## Current Focus

hypothesis: CONFIRMED — WLEDLiveSync continuously overwrites ledStateProxy with WLED's live state (~15fps push). applyPaint() correctly writes to ledStateProxy but WLEDLiveSync stomps it within ~65ms, erasing visual paint. Guard needed in WLEDLiveSync subscriber to skip writes when isPaintMode is true.
test: Code trace of entire flow from pointer event → applyPaint() → ledStateProxy → useFrame → WLEDLiveSync overwrite
expecting: Adding `if (paintStore.getState().isPaintMode) return;` inside the WLEDLiveSync subscriber callback stops the stomp. Paint persists in ledStateProxy, useFrame renders it, sACN sends it to cube.
next_action: Routing to GSD for fix implementation

## Symptoms

expected: Clicking on LED spheres in the 3D cube visualization should paint them the selected color, update ledStateProxy, and send frames to the physical cube via sACN
actual: Nothing happens — LED spheres stay as dim glow, no colors change, physical cube unchanged
errors: None visible in UI
reproduction: Open app at http://localhost:5173, app is connected (green status), enable Paint Mode, select a color, click/drag on the 3D cube
started: Unknown — app was just rebuilt after full audit

## Eliminated

- hypothesis: OrbitControls swallows pointer events before they reach CubeMesh
  evidence: CubeScene.tsx PaintAwareControls correctly sets enableRotate={!isPaintMode} — orbit rotation is disabled in paint mode.
  timestamp: 2026-04-10T00:01:00Z

- hypothesis: SACNController.getInstance() throws and crashes the useFrame loop
  evidence: The throw is inside try/catch (CubeMesh.tsx line 141-151), silently swallowed. sACN frames not sent but 3D update path is unaffected.
  timestamp: 2026-04-10T00:01:00Z

- hypothesis: handlePointerDown never fires
  evidence: Guard `if (!paintStore.getState().isPaintMode) return;` is correct. When isPaintMode=true the function proceeds. Event wiring on InstancedMesh is correct.
  timestamp: 2026-04-10T00:01:00Z

- hypothesis: InputPipelineRunner overwrites ledStateProxy when no plugin is active
  evidence: Runner only writes to ledStateProxy inside audioActive/cameraActive/videoLoaded branches. At idle (all false) it does nothing. Runner is innocent.
  timestamp: 2026-04-10T00:01:00Z

## Evidence

- timestamp: 2026-04-10T00:01:00Z
  checked: CubeMesh.tsx applyPaint() (lines 25-52)
  found: Correctly calls paintPlugin.setPixel(), then ledStateProxy.colors.set(paintPlugin.getBuffer()), then paintOutput.sendPaint(). All three steps execute.
  implication: Paint IS written to ledStateProxy. Something else overwrites it before the next frame renders.

- timestamp: 2026-04-10T00:01:00Z
  checked: CubeMesh.tsx useFrame visual path (lines 112-133)
  found: Reads ledStateProxy.colors directly on every frame, no guard. If any byte is non-zero, renders color. If all zero → dim glow (0.06, 0.06, 0.08).
  implication: If ledStateProxy stays painted, 3D view will show it. It's not staying painted.

- timestamp: 2026-04-10T00:01:00Z
  checked: WLEDLiveSync.ts subscriber callback (lines 37-51)
  found: WS subscriber runs on every WLED push event (leds array). WLED pushes live LED state at ~15fps (~65ms). The subscriber unconditionally overwrites ledStateProxy.colors with the cube's actual state — which is black (fx:0, bri:255 but no sACN data → all LEDs off).
  implication: ROOT CAUSE. applyPaint() writes paint to ledStateProxy. Within ~65ms, WLEDLiveSync overwrites ledStateProxy with black. The 3D view renders black. No paint visible.

- timestamp: 2026-04-10T00:01:00Z
  checked: App.tsx lines 112, 144 — startLiveSync() always called when connected
  found: No isPaintMode check. Live sync runs unconditionally for the lifetime of the connection.
  implication: Confirms stomp. Fix: add isPaintMode guard inside WLEDLiveSync subscriber.

- timestamp: 2026-04-10T00:01:00Z
  checked: Physical cube output path
  found: paintOutput.sendPaint() sends WebSocket seg.i commands. But WLED has been put into fx:0 (Solid) mode by SACNController with bri:255. WLED's seg.i commands DO work in Solid mode. However, the WS send only fires on paint events — the cube does not receive updates between paints. sACN path (CubeMesh useFrame bridge) would keep the cube updated, but sacn.isActive() is false if the sACN bridge is not running.
  implication: Physical cube issue is secondary — it may or may not work depending on whether the sACN bridge is available. The primary fix (visual feedback) is the WLEDLiveSync guard.

## Resolution

root_cause: WLEDLiveSync unconditionally overwrites ledStateProxy.colors with WLED's live LED state on every WebSocket push (~15fps). applyPaint() writes paint to ledStateProxy, but WLEDLiveSync stomps it within ~65ms, erasing the painted colors before useFrame renders them. The 3D visualization therefore always shows the live WLED state (black, since fx:0 + sACN sends nothing), not the paint buffer. The physical cube is also unaffected because visual feedback never persists.

fix: |
  In WLEDLiveSync.ts, add isPaintMode guard in the subscriber callback:
  
    import { paintStore } from '@/stores/paintStore';
    
    const unsubscribe = ws.subscribe((msg: WLEDMessage) => {
      if (!isLiveStreamMessage(msg)) return;
      if (paintStore.getState().isPaintMode) return;  // <-- ADD THIS
      // ... rest of handler
    });
  
  This yields ledStateProxy ownership to the paint mode handler. When paint mode exits, live sync resumes updating the 3D view from WLED state.

verification:
files_changed:
  - src/core/pipeline/WLEDLiveSync.ts
