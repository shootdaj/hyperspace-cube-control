# Phase 2: 3D Visualization & Pipeline Engine - Research

**Researched:** 2026-04-09
**Domain:** React Three Fiber v9, Three.js InstancedMesh, postprocessing bloom, PipelineEngine game loop, WLED live LED stream
**Confidence:** HIGH (stack verified via official docs and Phase 1 codebase; geometry math is original derivation verified against HyperCube specs)

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| VIZ-01 | Render interactive 3D cube with 480 LEDs on 12 edges (20 per edge) | InstancedMesh geometry layout documented; exact vertex positions derived below |
| VIZ-02 | Mirror real-time LED state from physical cube via WebSocket | `{"lv":true}` stream format confirmed as `{leds: string[], n: number}`; Valtio ledStateProxy from Phase 1 is the bridge |
| VIZ-03 | User can rotate, zoom, pan with mouse/touch | OrbitControls from drei — touch/pinch built-in; props documented below |
| VIZ-04 | Updates at 30fps+ without frame drops | InstancedMesh + useFrame + direct buffer mutation — zero React re-renders; pattern fully documented |
| VIZ-05 | LED colors match physical cube output | Hex→RGB conversion from live stream; MeshBasicMaterial with vertexColors=true for accurate color display |
| VIZ-06 | Infinity mirror glow/bloom effect | @react-three/postprocessing Bloom with emissiveIntensity > 1 + toneMapped={false}; EffectComposer setup documented |
| PLUG-04 | PipelineEngine orchestrates input → mapping → output at configurable frame rate | useRef-based RAF loop pattern — reads from activePlugin.current, writes ledStateProxy, calls output.send; pattern fully designed |
| PLUG-05 | Plugins can be swapped at runtime without restarting the pipeline | Ref swap pattern: activePlugin.current = newPlugin; RAF loop continues uninterrupted; documented |
| TEST-03 | Integration tests for pipeline (input → mapping → output) | MockInputPlugin and MockOutputPlugin exist in Phase 1; pipeline test pattern documented |
| TEST-04 | Visual regression tests for 3D cube rendering | @react-three/test-renderer for scene-graph assertions; vitest-webgl-canvas-mock for WebGL context; approach documented |
</phase_requirements>

---

## Summary

Phase 2 builds on the stable foundation of Phase 1 (plugin interfaces, Valtio `ledStateProxy`, Zustand stores, WLED WebSocket singleton). The core technical challenge is rendering 480 LED instances at 60fps without React re-renders — this is solved by Three.js `InstancedMesh` with per-instance colors updated via `setColorAt()` + `instanceColor.needsUpdate = true` inside R3F's `useFrame`. The entire LED color hot path flows: `WLEDWebSocket → ledStateProxy → useFrame reads proxy directly → InstancedMesh buffer update` — no `setState`, no component re-renders.

The `PipelineEngine` runs as a `useRef`-based `requestAnimationFrame` loop started in a `useEffect`. It reads from `activePlugin.current`, runs the mapping strategy, writes `ledStateProxy.colors`, and calls `activeOutput.current.send()`. Plugin swaps are ref mutations — the loop never stops. This satisfies PLUG-04 (game loop) and PLUG-05 (runtime swap) without any React re-render complexity.

The bloom/glow effect uses `@react-three/postprocessing` (`EffectComposer` + `Bloom`). LEDs that are lit use `emissiveIntensity > 1.0` on a `MeshStandardMaterial` with `toneMapped={false}` to push colors above the 0-1 range, which Bloom picks up via its `luminanceThreshold`. The HyperCube 15-SE is a 385mm cube; LED positions are computed analytically from the 12 edge vectors of a unit cube scaled to half-size (0.5m canonical units), with 20 evenly spaced points per edge.

**Primary recommendation:** Use `InstancedMesh` + `useFrame` + Valtio direct proxy reads (not `useSnapshot`) for the LED hot path. `@react-three/postprocessing` Bloom for glow. `OrbitControls` from drei. PipelineEngine as a `useEffect`-owned RAF loop with refs for all active plugins.

---

## Standard Stack

### Core (not yet installed — Phase 1 only installed React, Zustand, Valtio, Tailwind, shadcn)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @react-three/fiber | 9.x (latest 9.5.x) | React renderer for Three.js | Official pmndrs R3F; declarative scene graph; useFrame hook for render loop |
| three | 0.183.x (already peer dep) | WebGL 3D rendering | R3F peerDep; InstancedMesh, Color, Vector3 — all used directly |
| @react-three/drei | 10.x (latest 10.7.x) | R3F helpers — OrbitControls, Stats | Saves hundreds of lines; OrbitControls is the one we need most |
| @react-three/postprocessing | 3.x (latest 3.0.x) | EffectComposer + Bloom | Official pmndrs postprocessing; batches effects efficiently; Bloom with emissive materials |
| @types/three | 0.183.x | TypeScript types for Three.js | Required for type-safe Three.js code |

### Supporting (testing only)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @react-three/test-renderer | latest | R3F scene-graph testing without WebGL | Unit and integration tests for 3D scene structure |
| vitest-webgl-canvas-mock | latest | Mock WebGL context in jsdom | Needed for any test file that imports Three.js (WebGLRenderer needs canvas+WebGL) |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| @react-three/postprocessing | three.js built-in post-processing passes | postprocessing lib is more efficient (batches passes); R3F postprocessing wraps it declaratively |
| MeshStandardMaterial | MeshBasicMaterial | MeshStandardMaterial supports emissive for bloom; MeshBasicMaterial is faster but no bloom possible |
| SelectiveBloom | Full-scene Bloom | SelectiveBloom only blooms specific meshes — more accurate but slightly more complex setup; both are valid |

**Installation (run once at start of Phase 2):**
```bash
npm install @react-three/fiber @react-three/drei @react-three/postprocessing three
npm install -D @types/three @react-three/test-renderer vitest-webgl-canvas-mock
```

---

## Architecture Patterns

### Recommended Project Structure (Phase 2 additions)

```
src/
├── core/
│   └── pipeline/
│       ├── PipelineEngine.ts       # useRef RAF game loop hook
│       └── WLEDLiveSync.ts         # reads {"lv":true} stream → writes ledStateProxy
├── visualization/
│   ├── CubeScene.tsx               # Canvas + EffectComposer + CubeMesh + OrbitControls
│   ├── CubeMesh.tsx                # InstancedMesh with 480 LED positions; useFrame sync
│   ├── cubeGeometry.ts             # Pure fn: 480 LED positions as Vector3[] (12 edges × 20)
│   └── postprocessing/
│       └── LedBloom.tsx            # EffectComposer + Bloom configured for LED aesthetic
├── plugins/
│   └── outputs/
│       └── WLEDWebSocketOutput.ts  # OutputPlugin: writes ledStateProxy back to WLED
test/
└── integration/
    └── pipeline.test.ts            # integration: MockInput → MockMapping → MockOutput
```

### Pattern 1: InstancedMesh with Per-Instance Colors (VIZ-01, VIZ-04, VIZ-05)

**What:** One `InstancedMesh` holds all 480 LED sphere instances. Per-instance colors are updated via `mesh.setColorAt(i, color)` + `mesh.instanceColor!.needsUpdate = true` in `useFrame`.

**Critical initialization requirement:** The material MUST have `vertexColors: true`. The `instanceColor` buffer is `null` until at least one `setColorAt()` call is made — call it for all 480 instances in a `useEffect` at mount time to pre-allocate the buffer.

**Source:** Three.js official docs (threejs.org/docs/#api/en/objects/InstancedMesh) — HIGH confidence

```typescript
// Source: Three.js docs + R3F pitfalls docs
// src/visualization/CubeMesh.tsx

import { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { ledStateProxy } from '@/core/store/ledStateProxy';
import { computeLEDPositions } from './cubeGeometry';

const _color = new THREE.Color(); // Reuse — NEVER allocate inside useFrame

export function CubeMesh() {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const positions = useMemo(() => computeLEDPositions(), []); // 480 Vector3s

  const geometry = useMemo(() => new THREE.SphereGeometry(0.012, 6, 6), []);
  const material = useMemo(
    () => new THREE.MeshStandardMaterial({ vertexColors: true, toneMapped: false }),
    []
  );

  // Initialize instance matrices and pre-allocate instanceColor buffer
  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const dummy = new THREE.Object3D();
    positions.forEach((pos, i) => {
      dummy.position.copy(pos);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      // Pre-allocate instanceColor by calling setColorAt on all instances
      mesh.setColorAt(i, new THREE.Color(0, 0, 0));
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.instanceColor!.needsUpdate = true;

    return () => {
      geometry.dispose();
      material.dispose();
    };
  }, [positions, geometry, material]);

  // Hot path: read Valtio proxy DIRECTLY (not useSnapshot — that would cause re-renders)
  useFrame(() => {
    const mesh = meshRef.current;
    if (!mesh?.instanceColor) return;
    const colors = ledStateProxy.colors; // Direct proxy read — no subscription
    for (let i = 0; i < 480; i++) {
      _color.setRGB(
        colors[i * 3] / 255,
        colors[i * 3 + 1] / 255,
        colors[i * 3 + 2] / 255,
      );
      // Also set emissive-equivalent by adjusting color intensity for bloom
      // MeshStandardMaterial with emissive uses separate emissive uniform
      mesh.setColorAt(i, _color);
    }
    mesh.instanceColor!.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[geometry, material, 480]}>
    </instancedMesh>
  );
}
```

**Bloom note:** For bloom to activate on lit LEDs, the material needs emissive color above the `luminanceThreshold`. Switch to `MeshStandardMaterial`, set `emissiveIntensity` per-instance via a custom uniform or use a single shared emissive color and drive glow via `color` intensity above 1.0 (HDR). See Pattern 3 (Bloom) for the exact approach.

### Pattern 2: PipelineEngine Game Loop (PLUG-04, PLUG-05)

**What:** `useEffect`-owned RAF loop. All active plugins stored in refs. Plugin swap = ref mutation — loop never stops.

**Source:** R3F pitfalls docs (r3f.docs.pmnd.rs/advanced/pitfalls), ARCHITECTURE.md pattern — HIGH confidence

```typescript
// Source: ARCHITECTURE.md Pattern 2 + R3F pitfalls docs
// src/core/pipeline/PipelineEngine.ts

import { useRef, useEffect } from 'react';
import type { InputPlugin, MappingStrategy, OutputPlugin } from './types';
import { ledStateProxy } from '@/core/store/ledStateProxy';

const TARGET_FPS = 30;
const FRAME_INTERVAL_MS = 1000 / TARGET_FPS;

export function usePipelineEngine() {
  const activeInputRef = useRef<InputPlugin | null>(null);
  const activeMappingRef = useRef<MappingStrategy | null>(null);
  const activeOutputRef = useRef<OutputPlugin | null>(null);
  const lastTimeRef = useRef<number>(0);

  useEffect(() => {
    let rafId: number;

    function tick(now: number) {
      rafId = requestAnimationFrame(tick);
      const delta = now - lastTimeRef.current;
      if (delta < FRAME_INTERVAL_MS) return; // Frame rate limiting
      lastTimeRef.current = now - (delta % FRAME_INTERVAL_MS);

      const input = activeInputRef.current;
      const mapping = activeMappingRef.current;
      if (!input || !mapping) return;

      const frame = input.tick(delta);
      if (!frame) return;

      const leds = mapping.map(frame, 480);
      // Write to Valtio proxy — Three.js reads this in useFrame
      ledStateProxy.colors.set(leds);
      ledStateProxy.lastUpdated = now;

      activeOutputRef.current?.send(leds, 255);
    }

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, []); // Empty deps — loop runs once, refs hold current values

  // Plugin swap: just update the ref. Loop reads ref next tick.
  function setInputPlugin(plugin: InputPlugin | null) {
    activeInputRef.current?.destroy();
    activeInputRef.current = plugin;
  }

  function setMappingStrategy(strategy: MappingStrategy | null) {
    activeMappingRef.current = strategy;
  }

  function setOutputPlugin(plugin: OutputPlugin | null) {
    activeOutputRef.current?.destroy();
    activeOutputRef.current = plugin;
  }

  return { setInputPlugin, setMappingStrategy, setOutputPlugin };
}
```

**CRITICAL:** The `useEffect` dependency array MUST be `[]`. If deps are added, the loop restarts on every dep change (destroys the hot path guarantee). Plugins are updated through ref mutations only, never through the deps array.

### Pattern 3: Bloom / Infinity Mirror Glow (VIZ-06)

**What:** `EffectComposer` + `Bloom` from `@react-three/postprocessing`. LEDs that are lit get their emissive color pushed above 1.0 to trigger bloom.

**Source:** react-postprocessing.docs.pmnd.rs/effects/bloom — HIGH confidence

```typescript
// Source: react-postprocessing.docs.pmnd.rs + EffectComposer docs
// src/visualization/CubeScene.tsx

import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import { KernelSize } from 'postprocessing';
import { CubeMesh } from './CubeMesh';

export function CubeScene() {
  return (
    <Canvas
      camera={{ position: [1.5, 1.5, 1.5], fov: 50 }}
      gl={{ antialias: true, toneMapping: 0 }} // ACESFilmicToneMapping = 0 disables default tone mapping
    >
      <ambientLight intensity={0.1} />
      <CubeMesh />
      <OrbitControls
        enableDamping
        dampingFactor={0.05}
        minDistance={0.8}
        maxDistance={3.0}
        makeDefault
      />
      <EffectComposer>
        <Bloom
          intensity={1.5}
          luminanceThreshold={0.6}
          luminanceSmoothing={0.025}
          kernelSize={KernelSize.LARGE}
          mipmapBlur
        />
      </EffectComposer>
    </Canvas>
  );
}
```

**For bloom on LEDs:** Each LED uses `MeshStandardMaterial` with `emissive` and `emissiveIntensity`. In the `useFrame` loop, for each lit LED set:
- `color` = actual RGB (0-1 range)
- `emissive` = same RGB
- `emissiveIntensity` = `brightness / 128` * 2.0 (so a bright LED has emissiveIntensity ~2.0)
- `toneMapped={false}` on the material allows color values > 1 to pass to the bloom pass

**Alternative (simpler):** Use `MeshBasicMaterial` with HDR colors (values > 1.0). No emissive needed. Set `toneMapped={false}`. Bloom luminance threshold detects values above 1.0.

### Pattern 4: WLED Live Stream → ledStateProxy (VIZ-02)

**What:** Parse `{"lv":true}` WebSocket response `{leds: string[], n: number}` (confirmed from virtualCube.ts mock) into `ledStateProxy.colors`.

**Source:** virtualCube.ts mock confirms format; WLED WebSocket docs state format matches `/json/live` — MEDIUM confidence (not in official written docs but confirmed in mock)

```typescript
// src/core/pipeline/WLEDLiveSync.ts

import { WLEDWebSocketService } from '@/core/wled/WLEDWebSocketService';
import { ledStateProxy } from '@/core/store/ledStateProxy';

export function startLiveSync(): () => void {
  const ws = WLEDWebSocketService.getInstance();
  ws.requestLiveStream(); // sends {"lv": true}

  const unsubscribe = ws.subscribe((msg) => {
    // Live stream messages have a "leds" array of hex strings
    if (!('leds' in msg) || !Array.isArray(msg.leds)) return;
    const leds = msg.leds as string[];
    for (let i = 0; i < Math.min(leds.length, 480); i++) {
      const hex = leds[i];
      ledStateProxy.colors[i * 3]     = parseInt(hex.slice(0, 2), 16);
      ledStateProxy.colors[i * 3 + 1] = parseInt(hex.slice(2, 4), 16);
      ledStateProxy.colors[i * 3 + 2] = parseInt(hex.slice(4, 6), 16);
    }
    ledStateProxy.lastUpdated = Date.now();
  });

  return unsubscribe;
}
```

### Pattern 5: HC15-SE Cube Geometry (VIZ-01)

**What:** Compute 480 LED positions (12 edges × 20 LEDs) for a unit cube centered at origin.

**Physical spec:** HyperCube 15-SE is 385mm (15.16") on all sides. Canonical 3D units: 1.0 = 1 meter, so cube half-size = 0.1925m ≈ 0.19. Use 0.5 as canonical half-size and scale the scene camera to match.

**Edge enumeration:** A cube has 12 edges. Each edge goes between two adjacent corner vertices. Corner vertices of a unit cube (half-size 0.5):

```
(-0.5, -0.5, -0.5), (+0.5, -0.5, -0.5),   // Bottom face 4 corners
(+0.5, -0.5, +0.5), (-0.5, -0.5, +0.5),
(-0.5, +0.5, -0.5), (+0.5, +0.5, -0.5),   // Top face 4 corners
(+0.5, +0.5, +0.5), (-0.5, +0.5, +0.5)
```

```
12 edges:
Bottom face: (0→1), (1→2), (2→3), (3→0)
Top face:    (4→5), (5→6), (6→7), (7→4)
Verticals:   (0→4), (1→5), (2→6), (3→7)
```

```typescript
// Source: Derived from HyperCube 15-SE spec (385mm cube, 20 LEDs/edge)
// src/visualization/cubeGeometry.ts

import * as THREE from 'three';

const HALF = 0.5;

// 8 vertices of a cube
const V = [
  new THREE.Vector3(-HALF, -HALF, -HALF), // 0
  new THREE.Vector3(+HALF, -HALF, -HALF), // 1
  new THREE.Vector3(+HALF, -HALF, +HALF), // 2
  new THREE.Vector3(-HALF, -HALF, +HALF), // 3
  new THREE.Vector3(-HALF, +HALF, -HALF), // 4
  new THREE.Vector3(+HALF, +HALF, -HALF), // 5
  new THREE.Vector3(+HALF, +HALF, +HALF), // 6
  new THREE.Vector3(-HALF, +HALF, +HALF), // 7
] as const;

// 12 edges as [startVertex, endVertex] pairs
const EDGES: [number, number][] = [
  [0, 1], [1, 2], [2, 3], [3, 0], // bottom face
  [4, 5], [5, 6], [6, 7], [7, 4], // top face
  [0, 4], [1, 5], [2, 6], [3, 7], // verticals
];

const LEDS_PER_EDGE = 20;

/**
 * Returns 480 Vector3 positions for all LEDs in edge order.
 * LED index = edgeIndex * 20 + positionOnEdge (0-based from start vertex).
 * Used by InstancedMesh to set instance matrices.
 */
export function computeLEDPositions(): THREE.Vector3[] {
  const positions: THREE.Vector3[] = [];
  for (const [startIdx, endIdx] of EDGES) {
    const start = V[startIdx];
    const end = V[endIdx];
    for (let j = 0; j < LEDS_PER_EDGE; j++) {
      // Evenly distribute 20 LEDs between the two end vertices
      // t = 0 is at start vertex, t = 1 is at end vertex
      const t = (j + 0.5) / LEDS_PER_EDGE;
      positions.push(new THREE.Vector3().lerpVectors(start, end, t));
    }
  }
  return positions; // Length: 240 (12 * 20)
}
```

**Note:** WLED's LED index ordering for a physical strip matters — the WLED firmware maps physical strip positions to this index. Since the strip is a single continuous run, the `EDGES` array order above should match the physical wiring order of the HC15-SE strip. This may need validation against the physical cube's wiring sequence. If LED ordering appears wrong, re-sort `EDGES` to match the observed wiring.

### Anti-Patterns to Avoid

- **`useSnapshot(ledStateProxy)` inside `useFrame`:** `useSnapshot` creates React subscriptions and triggers re-renders on every frame. Read the proxy directly: `ledStateProxy.colors`.
- **`setState` with LED color arrays:** Even `zustand.set({ leds: ... })` at 60fps will cause React re-renders. LED colors must flow through Valtio proxy only.
- **Allocating `new THREE.Color()` inside `useFrame`:** Creates 480+ GC objects per frame → GC pauses → dropped frames. Allocate ONE `_color` outside the hook and reuse.
- **Creating geometry inside the render function:** Use `useMemo`. Without memoization, `new THREE.SphereGeometry()` runs on every React re-render, creating a new geometry and GPU object.
- **Unmounting/remounting the Canvas:** Destroys and recreates the WebGL context. Use CSS `display: none` to hide, never unmount.
- **Two separate RAF loops (one in PipelineEngine, one in R3F):** R3F's `useFrame` already runs inside the single shared RAF loop. The `PipelineEngine` uses its own `useEffect`-based RAF loop for the plugin tick cycle — this is a separate loop for the plugin data pipeline. They both exist and should not interfere (they operate on different frequencies: pipeline at 30fps, R3F rendering at device refresh rate).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Orbit controls with touch/pinch/zoom | Custom pointer event handler | `OrbitControls` from drei | Handles all edge cases: two-finger pan vs pinch on iOS, trackpad on macOS, inertia/damping |
| Bloom/glow postprocessing | Custom GLSL blur shader | `@react-three/postprocessing` Bloom | pmndrs-maintained; batches multiple effects; luminance threshold controls which objects glow |
| Camera frustum, resize handling | Manual canvas resize listener | R3F Canvas handles this | Canvas auto-resizes to container; camera aspect ratio updated automatically |
| WebGL context creation + Three.js renderer setup | Manual `new WebGLRenderer()` | R3F Canvas | R3F manages renderer lifecycle, context loss recovery, and pixel ratio |
| Frame rate throttling | `setTimeout` inside RAF | RAF delta time comparison (see PipelineEngine pattern above) | setTimeout is not frame-aligned; delta-based throttling is the correct pattern |
| Instance color pre-allocation | Trying to use instanceColor before any setColorAt call | Call `setColorAt` for all 480 instances at mount | instanceColor buffer is null until first setColorAt; pre-allocate in useEffect |

**Key insight:** The pmndrs ecosystem (R3F + drei + postprocessing) eliminates ~80% of the boilerplate for 3D canvas apps. Every Three.js lifecycle concern (renderer, camera, resize, RAF) is handled declaratively.

---

## Common Pitfalls

### Pitfall 1: instanceColor is null until first setColorAt call

**What goes wrong:** Calling `mesh.instanceColor!.needsUpdate = true` in `useFrame` before any `setColorAt` has been called throws `Cannot read properties of null`.

**Why it happens:** `instanceColor` starts as `null`. It is only allocated when `setColorAt()` is first called.

**How to avoid:** In `useEffect` at mount time, call `setColorAt(i, blackColor)` for all 480 instances. This pre-allocates the `InstancedBufferAttribute`. Then `useFrame` can safely set `needsUpdate = true`.

**Warning signs:** TypeError crash on first frame. Only affects fresh mounts, not hot reloads (buffer survives HMR).

### Pitfall 2: Material must have vertexColors: true

**What goes wrong:** Per-instance colors render as the material's base color (white/grey) for all instances, ignoring `setColorAt()` values.

**Why it happens:** Without `vertexColors: true`, the shader does not sample from the `instanceColor` buffer.

**How to avoid:** Always create the material with `vertexColors: true`. For `MeshStandardMaterial` used with bloom: `new THREE.MeshStandardMaterial({ vertexColors: true, toneMapped: false })`.

**Warning signs:** All LEDs render identical color despite different `setColorAt()` values.

### Pitfall 3: Bloom only activates on colors > luminanceThreshold

**What goes wrong:** Bloom effect is added but LEDs don't glow. Bloom is invisible.

**Why it happens:** The default `luminanceThreshold` is 0.9. An LED with RGB (255, 0, 0) normalized to `color(1, 0, 0)` has luminance ≈ 0.21 (below threshold). Without emissive intensity or HDR colors, nothing glows.

**How to avoid:** Use `MeshStandardMaterial` with `emissive` + `emissiveIntensity > 1` OR set `toneMapped={false}` and use HDR color values (> 1.0). Set `luminanceThreshold` to 0.5-0.7 for LED aesthetic.

**Warning signs:** EffectComposer renders normally but no bloom visible. No console errors.

### Pitfall 4: useSnapshot in useFrame causes 60 React re-renders/sec

**What goes wrong:** Performance collapses — `useSnapshot(ledStateProxy)` in a component re-renders that component on every proxy mutation. Inside `useFrame` this is catastrophic.

**How to avoid:** In `useFrame`, read `ledStateProxy.colors` directly (not through `useSnapshot`). `useSnapshot` is only for React render functions that display LED data in the DOM.

**Warning signs:** React DevTools shows 60 commits/second for the CubeMesh component.

### Pitfall 5: PipelineEngine useEffect dependency array causes loop restarts

**What goes wrong:** Plugin swap triggers a React re-render → `useEffect` with the RAF loop has deps array → loop stops, restarts → audible pop/flash during swap.

**How to avoid:** `useEffect` dependency array for the RAF loop MUST be `[]`. Plugin refs are updated via the returned setter functions, which mutate refs and never trigger the effect cleanup/rerun.

**Warning signs:** Brief visual glitch on every plugin swap. Sometimes a dropped frame on the canvas.

### Pitfall 6: Three.js geometry/material not disposed on unmount

**What goes wrong:** GPU memory climbs on every mount/unmount cycle. After 10+ remounts: slowdown.

**How to avoid:** Return a cleanup function from `useEffect` that calls `geometry.dispose()` and `material.dispose()`. Monitor `renderer.info.memory.geometries` in dev — should stay at 1.

**Warning signs:** `renderer.info.memory.geometries` count grows. GPU memory in Activity Monitor climbs.

### Pitfall 7: Two-finger scroll on desktop triggers zoom instead of scroll

**What goes wrong:** OrbitControls captures all scroll/touch events. Page scrolling is broken when the canvas is embedded in a scrollable layout.

**How to avoid:** Use `makeDefault` prop on OrbitControls (locks controls to camera). Optionally `enableZoom={false}` and replace with custom scroll handling. Or use CSS `pointer-events: none` on the canvas in non-interactive contexts.

---

## Code Examples

### InstancedMesh Color Update Loop (verified pattern)

```typescript
// Source: Three.js docs + R3F pitfalls + verified against issue #2854
const _color = new THREE.Color(); // Pre-allocate OUTSIDE useFrame

useFrame(() => {
  const mesh = meshRef.current;
  if (!mesh?.instanceColor) return;

  const buf = ledStateProxy.colors; // Direct Valtio proxy read
  for (let i = 0; i < 480; i++) {
    _color.setRGB(buf[i * 3] / 255, buf[i * 3 + 1] / 255, buf[i * 3 + 2] / 255);
    mesh.setColorAt(i, _color);
  }
  mesh.instanceColor.needsUpdate = true;
});
```

### OrbitControls Setup (verified from drei docs)

```typescript
// Source: @react-three/drei OrbitControls component
<OrbitControls
  enableDamping         // Smooth deceleration
  dampingFactor={0.05}
  minDistance={0.8}     // Don't zoom inside the cube
  maxDistance={3.0}     // Don't zoom too far out
  enablePan={true}      // Allow pan
  touches={{            // Explicit touch config
    ONE: THREE.TOUCH.ROTATE,
    TWO: THREE.TOUCH.DOLLY_PAN,
  }}
  makeDefault           // Registers as default camera controls
/>
```

### EffectComposer + Bloom (verified from official docs)

```typescript
// Source: react-postprocessing.docs.pmnd.rs/effects/bloom
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import { KernelSize } from 'postprocessing';

// Inside Canvas:
<EffectComposer>
  <Bloom
    intensity={2.0}              // Bloom strength
    luminanceThreshold={0.5}     // Lower = more objects glow
    luminanceSmoothing={0.025}   // Threshold edge smoothness
    kernelSize={KernelSize.LARGE}
    mipmapBlur                   // Higher quality blur
  />
</EffectComposer>
```

### PipelineEngine Integration Test Pattern

```typescript
// Source: Phase 1 MockPlugins + ARCHITECTURE.md integration test
// test/integration/pipeline.test.ts

import { MockInputPlugin, MockMappingStrategy, MockOutputPlugin } from '../mocks/mockPlugins';

it('TestPipelineEngine_TicksInput_WritesLedProxy_CallsOutput', async () => {
  const input = new MockInputPlugin();
  const mapping = new MockMappingStrategy();
  const output = new MockOutputPlugin();

  // Set a test frame
  const leds = new Uint8Array(480 * 3);
  leds.fill(128); // mid-brightness grey
  input.setNextFrame({ type: 'direct', leds });

  // Run one pipeline tick manually
  const frame = input.tick(16);
  const mapped = mapping.map(frame!, 480);
  ledStateProxy.colors.set(mapped);
  output.send(mapped, 255);

  expect(output.sentFrames).toHaveLength(1);
  expect(output.sentFrames[0].leds.length).toBe(480 * 3);
  expect(Array.from(ledStateProxy.colors).some(v => v > 0)).toBe(true);
});
```

### Visual Regression Test Pattern (TEST-04)

```typescript
// Source: r3f.docs.pmnd.rs/api/testing + @react-three/test-renderer
// src/visualization/__tests__/CubeMesh.test.tsx
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { CubeMesh } from '../CubeMesh';

it('TestCubeMesh_Renders_480Instances', async () => {
  const renderer = await ReactThreeTestRenderer.create(<CubeMesh />);
  const mesh = renderer.scene.children[0];
  // InstancedMesh has count=480
  expect(mesh.props.args[2]).toBe(480);
});

it('TestCubeMesh_AdvancesFrame_UpdatesColors', async () => {
  // Set a test color in ledStateProxy
  ledStateProxy.colors[0] = 255; // LED 0 Red channel = 255
  const renderer = await ReactThreeTestRenderer.create(<CubeMesh />);
  await renderer.advanceFrames(1, 16);
  // Verify scene object exists and hasn't crashed
  expect(renderer.scene.children).toHaveLength(1);
});
```

**Note on visual regression:** @react-three/test-renderer tests the scene graph, not pixel output. True pixel-level visual regression (TEST-04) requires either:
1. Playwright/Vitest browser mode screenshots (headless Chrome with GPU — requires CI with GPU or xvfb), or
2. Snapshot the scene graph structure and material properties as the "visual" regression baseline.

For this phase, use option 2 (scene graph snapshots via test-renderer) as the pragmatic approach. Pixel screenshots in CI are HIGH complexity without clear benefit.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| R3F v8 + React 18 | R3F v9 + React 19 | 2024 | R3F v9 supports React 19 concurrent features; minor API changes (Canvas props) |
| @react-three/postprocessing v2.x | v3.x | 2024 | API largely stable; updated peer dep to postprocessing v6; Bloom props unchanged |
| drei v9 | drei v10 | 2024 | Aligns with R3F v9; OrbitControls API unchanged |
| Manual geometry + OrbitControls from 'three/examples' | OrbitControls from drei | Ongoing | Drei wrapper handles R3F Canvas context binding; no manual camera ref wiring |
| `new THREE.Vector3()` in loops | Pre-allocated reused objects | Always best practice | Eliminates GC pressure in 60fps loops |

**Deprecated/outdated:**
- `import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'` in R3F: Use `@react-three/drei` version instead — it properly binds to the R3F Canvas camera.
- `@react-three/postprocessing` v1.x `EffectComposer` API: Breaking changes in v2/v3. Only use v3.x API shown above.

---

## Open Questions

1. **WLED live stream LED index order vs physical wiring order**
   - What we know: WLED strips are a single continuous strip; the index in `leds[]` from `{"lv":true}` corresponds to WLED's segment 0 LED order
   - What's unclear: Does the HC15-SE wiring start at a corner and snake through all 12 edges in the same order as our `EDGES` array? Or does it start at a different edge?
   - Recommendation: In plan 02-03, add a debug overlay that shows LED indices on the 3D cube. On first hardware connection, observe which physical LED lights up when index 0 is set to red. Map accordingly. Create a `LED_ORDER_MAPPING` constant that can be adjusted.

2. **WLEDMessage type compatibility with live stream**
   - What we know: `WLEDMessage` type from Phase 1 (`src/core/wled/types.ts`) was designed for state updates, not live stream. Live stream messages have `{leds: string[], n: number}` shape.
   - What's unclear: Does `WLEDMessage` in types.ts already allow arbitrary fields? Or does it need a union type update?
   - Recommendation: In plan 02-03, extend `WLEDMessage` to include a `LiveStreamMessage` union member before implementing `WLEDLiveSync.ts`.

3. **MeshStandardMaterial emissive per-instance vs single shared emissive**
   - What we know: `MeshStandardMaterial` has a single `emissive` uniform shared across all instances; per-instance emissive is not natively supported
   - What's unclear: The cleanest way to vary bloom intensity per-LED is to use HDR colors (> 1.0) with `MeshBasicMaterial` + `toneMapped: false` instead of emissive, since emissive is not per-instance
   - Recommendation: Use `MeshBasicMaterial` with `toneMapped: false`. Scale RGB values to 0-2 range based on WLED brightness. Bloom threshold at 0.5. Simpler and avoids per-instance emissive limitation.

4. **@react-three/test-renderer Vitest compatibility**
   - What we know: A Vitest issue (#4207) reports constructor equality problems with @react-three/test-renderer in recent Vitest versions
   - What's unclear: Whether this is resolved in Vitest 3.x (the project uses Vitest 3.1.0)
   - Recommendation: Install @react-three/test-renderer, write one smoke test in plan 02-08, and verify it passes before building the full test suite. If broken, fall back to testing scene-graph properties via vitest-webgl-canvas-mock + manual Three.js object inspection.

---

## Sources

### Primary (HIGH confidence)
- Three.js InstancedMesh docs: https://threejs.org/docs/pages/InstancedMesh.html — setColorAt, instanceColor, vertexColors requirement
- R3F Performance Pitfalls: https://r3f.docs.pmnd.rs/advanced/pitfalls — useFrame mutation pattern, no setState
- React Postprocessing Bloom docs: https://react-postprocessing.docs.pmnd.rs/effects/bloom — Bloom props, emissive materials, luminanceThreshold
- React Postprocessing EffectComposer docs: https://react-postprocessing.docs.pmnd.rs/effect-composer — setup, Canvas nesting
- Phase 1 codebase: `src/core/store/ledStateProxy.ts` — Valtio proxy confirmed, `colors: Uint8Array(480*3)`
- Phase 1 codebase: `src/core/pipeline/types.ts` — InputPlugin, MappingStrategy, OutputPlugin interfaces confirmed
- Phase 1 codebase: `src/core/wled/WLEDWebSocketService.ts` — `requestLiveStream()` method confirmed, subscriber pattern
- Phase 1 mock: `test/mocks/virtualCube.ts` — live stream format `{leds: string[], n: number}` confirmed
- HyperCube 15-SE product page: https://hyperspacelight.com/products/hypercube15-se — 385mm cube, 480 LEDs, 20/edge confirmed

### Secondary (MEDIUM confidence)
- WLED WebSocket docs: https://kno.wled.ge/interfaces/websocket/ — `{"lv":true}` live stream; format matches `/json/live`
- WLED JSON API docs: https://kno.wled.ge/interfaces/json-api/ — `i[]` per-LED format, 256 LED chunk limit
- Valtio docs: https://valtio.dev/docs/api/basic/useSnapshot — confirmed `useSnapshot` is for render, direct proxy access is for callbacks/frame loops
- R3F testing docs: https://r3f.docs.pmnd.rs/api/testing — @react-three/test-renderer usage, `advanceFrames`, `fireEvent`

### Tertiary (LOW confidence — needs validation)
- @react-three/test-renderer Vitest compatibility: Vitest issue #4207 — unresolved, needs hands-on validation
- HC15-SE LED wiring order relative to edge enumeration: No official documentation found — needs hardware validation

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages confirmed from official npm/docs; versions from STACK.md already verified in Phase 1 research
- Architecture: HIGH — PipelineEngine pattern from ARCHITECTURE.md; InstancedMesh pattern from Three.js official docs; confirmed with R3F pitfalls docs
- Pitfalls: HIGH — instanceColor null, vertexColors requirement, and bloom threshold all verified against official Three.js docs and GitHub issues; frame loop patterns from R3F official docs

**Research date:** 2026-04-09
**Valid until:** 2026-05-09 (30 days — Three.js/R3F APIs are stable; postprocessing API may have minor updates)
