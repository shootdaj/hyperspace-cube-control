# Architecture Research

**Domain:** Modular real-time LED creative control web app
**Researched:** 2026-04-09
**Confidence:** HIGH (for structural patterns) / MEDIUM (for specific library choices)

## Standard Architecture

### System Overview

```
┌──────────────────────────────────────────────────────────────────┐
│                         INPUT LAYER                               │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────┐ │
│  │  Manual  │ │  Video/  │ │   MIDI   │ │  Camera  │ │ Audio  │ │
│  │  Paint   │ │  Image   │ │Controller│ │  Webcam  │ │  Mic   │ │
│  │  Plugin  │ │  Plugin  │ │  Plugin  │ │  Plugin  │ │ Plugin │ │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘ └───┬────┘ │
└───────┴────────────┴────────────┴────────────┴────────────┴──────┘
         │            │            │            │            │
         └────────────┴────────────┴────────────┴────────────┘
                                   │
                    ┌──────────────▼──────────────┐
                    │       PIPELINE ENGINE        │
                    │   (game loop, 30-60fps tick) │
                    │  InputPlugin → FrameData →   │
                    │  MappingStrategy → LEDState  │
                    └──────────────┬──────────────┘
                                   │
         ┌─────────────────────────┼──────────────────────────┐
         │                         │                           │
┌────────▼────────┐   ┌────────────▼──────────┐  ┌───────────▼───┐
│  CUBE STATE     │   │   MAPPING LAYER        │  │  OUTPUT LAYER │
│  STORE          │   │                        │  │               │
│  (Zustand/refs) │   │  ┌──────────────────┐  │  │ ┌───────────┐ │
│                 │   │  │ Edge Sampling    │  │  │ │WLED JSON  │ │
│  480 LED colors │   │  └──────────────────┘  │  │ │  API      │ │
│  (Uint8Array)   │   │  ┌──────────────────┐  │  │ └───────────┘ │
│                 │   │  │ Face Extraction  │  │  │ ┌───────────┐ │
│  segments[]     │   │  └──────────────────┘  │  │ │WebSocket  │ │
│  effects{}      │   │  ┌──────────────────┐  │  │ │ (live)    │ │
│  brightness     │   │  │ Manual Override  │  │  │ └───────────┘ │
└────────┬────────┘   └────────────┬──────────┘  │ ┌───────────┐ │
         │                         │             │ │ sACN/     │ │
         │                         │             │ │ Art-Net   │ │
┌────────▼─────────────────────────▼─────────────┴─┴───────────┘ │
│                       UI LAYER                                    │
│  ┌─────────────────┐  ┌──────────────────┐  ┌───────────────┐   │
│  │  3D Cube View   │  │  Control Panel   │  │  Plugin       │   │
│  │  (R3F/Three.js) │  │  (sliders,       │  │  Switcher     │   │
│  │  480 LED mesh   │  │   presets, WLED) │  │  (input src)  │   │
│  └─────────────────┘  └──────────────────┘  └───────────────┘   │
└──────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| InputPlugin | Produce a `FrameData` payload each tick — raw RGB data or a command intent | TypeScript class implementing `InputPlugin` interface |
| PipelineEngine | Drive the game loop, call active plugin, route FrameData through active MappingStrategy, write to CubeState | `useRef`-based loop outside React render |
| MappingStrategy | Convert plugin's FrameData (e.g., video pixels, audio spectrum) into 480 LED colors indexed by cube edge position | Pure function or class implementing `MappingStrategy` interface |
| CubeState | Single source of truth for 480 LED colors (Uint8Array), segment config, brightness, effect params | Zustand store or plain ref-based store for hot path |
| OutputPlugin | Read CubeState and emit to physical device via chosen protocol | Class implementing `OutputPlugin` interface; swappable |
| 3D Visualization | Render 480 LED mesh in Three.js, read from CubeState each frame | React Three Fiber scene; useFrame reads from ref, not React state |
| Control Panel UI | User controls: brightness, effects, preset save/load, plugin selection | React components; write to Zustand store; store drives downstream |
| WLED WebSocket | Bidirectional sync with physical device; incoming state updates CubeState; outgoing sends changes | Singleton service class |
| PluginRegistry | Register, discover, and instantiate input/output plugins by ID | Factory pattern; maintains `Map<string, PluginFactory>` |

## Recommended Project Structure

```
src/
├── core/                    # Framework — no business logic here
│   ├── pipeline/
│   │   ├── PipelineEngine.ts    # game loop, tick orchestration
│   │   ├── types.ts             # FrameData, plugin interfaces
│   │   └── PluginRegistry.ts    # factory registration
│   ├── store/
│   │   ├── cubeStore.ts         # Zustand: LED state, segments, brightness
│   │   ├── uiStore.ts           # Zustand: active plugin, panel state, presets
│   │   └── types.ts             # LEDColor, CubeSegment, Preset types
│   └── wled/
│       ├── WLEDWebSocket.ts     # WebSocket connection, state sync
│       ├── WLEDRestClient.ts    # JSON API: effects, palettes, presets
│       └── types.ts             # WLED state/info types
├── plugins/
│   ├── inputs/
│   │   ├── ManualPaintPlugin.ts
│   │   ├── VideoPlugin.ts
│   │   ├── MIDIPlugin.ts
│   │   ├── CameraPlugin.ts
│   │   └── AudioPlugin.ts
│   ├── outputs/
│   │   ├── WLEDJsonOutput.ts
│   │   ├── WLEDWebSocketOutput.ts
│   │   └── SACNOutput.ts
│   └── mapping/
│       ├── EdgeSamplingStrategy.ts
│       ├── FaceExtractionStrategy.ts
│       └── types.ts
├── visualization/
│   ├── CubeScene.tsx            # R3F scene root
│   ├── CubeMesh.tsx             # 480-LED mesh geometry
│   ├── LEDMaterial.tsx          # custom shader for LED glow
│   └── useFrameSync.ts          # useFrame hook reading CubeState ref
├── ui/
│   ├── panels/
│   │   ├── ControlPanel.tsx
│   │   ├── PluginPanel.tsx
│   │   ├── EffectsBrowser.tsx
│   │   └── PresetManager.tsx
│   ├── controls/
│   │   ├── BrightnessSlider.tsx
│   │   ├── ColorPicker.tsx
│   │   └── SegmentControl.tsx
│   └── layouts/
│       └── MainLayout.tsx       # 5 design variations swap here
├── setup/
│   └── SetupWizard.tsx          # first-launch WLED IP configuration
└── __tests__/
    ├── plugins/                 # isolated plugin unit tests
    ├── pipeline/                # pipeline integration tests
    └── mocks/
        ├── MockWLEDServer.ts    # vitest-websocket-mock based mock
        └── MockPlugins.ts       # stub input/output plugins
```

### Structure Rationale

- **core/**: Engine internals that never import from plugins or UI. The pipeline doesn't know what a "video plugin" is — it only knows `InputPlugin`.
- **plugins/**: All domain-specific modules. New input sources are dropped here without touching core.
- **visualization/**: Kept separate from UI panels. The 3D scene runs its own R3F loop; panels run React's loop. They never share state directly — both read from the same Zustand store.
- **ui/**: Pure React components; write to Zustand, never to plugin instances directly.

## Architectural Patterns

### Pattern 1: Plugin Interface Contract (Strategy + Factory)

**What:** Define a minimal TypeScript interface every input plugin must satisfy. A `PluginRegistry` maps plugin IDs to factory functions. The pipeline calls `registry.create(id)` and only ever holds an `InputPlugin` reference.

**When to use:** Any time a feature is swappable. This is the load-bearing pattern of the entire architecture.

**Trade-offs:** More interfaces/files than a direct implementation; pays off immediately when adding the second plugin.

**Example:**
```typescript
// core/pipeline/types.ts

export interface FrameData {
  // Raw 480-LED colors OR a mapping hint (video canvas, audio spectrum)
  type: 'direct' | 'video' | 'audio' | 'midi';
  leds?: Uint8Array;        // type === 'direct': 480 × 3 bytes RGB
  canvas?: OffscreenCanvas; // type === 'video': caller owns the canvas
  spectrum?: Float32Array;  // type === 'audio': FFT frequency bins
  midiCC?: Map<number, number>; // type === 'midi': CC number → value
}

export interface InputPlugin {
  id: string;
  name: string;
  initialize(context: PluginContext): Promise<void>;
  tick(deltaMs: number): FrameData | null;  // called every pipeline tick
  destroy(): void;
}

export interface MappingStrategy {
  id: string;
  map(frame: FrameData, ledCount: number): Uint8Array; // returns 480×3
}

export interface OutputPlugin {
  id: string;
  send(leds: Uint8Array, brightness: number): void;
  destroy(): void;
}
```

### Pattern 2: Game Loop Outside React

**What:** The real-time pipeline runs in a `useEffect`-owned `requestAnimationFrame` loop using refs, not React state. LED data lives in a `Uint8Array` ref. React state is only updated at ~10fps for UI displays — not for the hot path.

**When to use:** Any data that changes at 30-60fps. React reconciliation at 60fps causes garbage collection spikes and dropped frames.

**Trade-offs:** Two sources of truth (ref for hot path, Zustand for UI). The ref IS the source of truth; Zustand is a projection for display purposes only.

**Example:**
```typescript
// core/pipeline/PipelineEngine.ts

export function usePipelineEngine(registry: PluginRegistry) {
  const ledStateRef = useRef<Uint8Array>(new Uint8Array(480 * 3));
  const activePlugin = useRef<InputPlugin | null>(null);
  const activeMapping = useRef<MappingStrategy>(new EdgeSamplingStrategy());
  const activeOutput = useRef<OutputPlugin | null>(null);

  useEffect(() => {
    let lastTime = performance.now();
    let rafId: number;

    function tick(now: number) {
      const deltaMs = now - lastTime;
      lastTime = now;

      const plugin = activePlugin.current;
      if (plugin) {
        const frame = plugin.tick(deltaMs);
        if (frame) {
          const leds = activeMapping.current.map(frame, 480);
          ledStateRef.current.set(leds);
          activeOutput.current?.send(leds, brightnessRef.current);
        }
      }
      rafId = requestAnimationFrame(tick);
    }

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, []);

  return ledStateRef; // visualization reads this ref in useFrame
}
```

### Pattern 3: Middle-Layer State Manager (React/3D boundary)

**What:** React state and Three.js rendering run at different frequencies. React state is a low-frequency projection (~10fps updates for UI); Three.js reads from refs at GPU frequency (~60fps). A `useCubeSync` hook bridges them.

**When to use:** Any React component that also has Three.js representation (the LED cube).

**Trade-offs:** More indirection; prevents the most common performance trap (calling `setState` in a rAF loop).

**Example:**
```typescript
// visualization/useFrameSync.ts

export function useFrameSync(ledStateRef: React.RefObject<Uint8Array>) {
  const meshRef = useRef<THREE.InstancedMesh>(null);

  useFrame(() => {
    const leds = ledStateRef.current;
    const mesh = meshRef.current;
    if (!leds || !mesh) return;

    for (let i = 0; i < 480; i++) {
      const r = leds[i * 3] / 255;
      const g = leds[i * 3 + 1] / 255;
      const b = leds[i * 3 + 2] / 255;
      _color.setRGB(r, g, b);
      mesh.setColorAt(i, _color);
    }
    mesh.instanceColor!.needsUpdate = true;
  });

  return meshRef;
}
```

### Pattern 4: Output Protocol Abstraction

**What:** All output protocols (WLED JSON, WLED WebSocket, sACN) implement `OutputPlugin`. Switching protocol is a single registry call. The pipeline never imports WLED-specific code.

**When to use:** Always. sACN cannot run from the browser (UDP socket required); it will need either a local Node.js bridge process or a Vercel serverless function as proxy.

**Note on sACN/Art-Net in browser:** Browser cannot send raw UDP. sACN and Art-Net require a thin Node.js bridge process running locally on the same machine (or a Raspberry Pi on the network). The `SACNOutput` plugin sends fetch/WebSocket commands to the bridge; the bridge sends UDP to WLED. This is the only protocol that requires an out-of-browser component. WLED JSON and WebSocket work directly from browser.

### Pattern 5: Pipes and Filters for Processing Chain

**What:** The data path from input to output is a linear filter chain: `Input → (optional transform filters) → Mapping → Output`. Each filter is stateless and takes `FrameData` in, returns `FrameData` out. Filters can be composed.

**When to use:** When adding effects (brightness scaling, color correction, gamma, masking) that are independent of the input source and mapping strategy.

```typescript
export type FrameFilter = (frame: FrameData) => FrameData;

// Composing filters:
const pipeline = [gammaFilter, brightnessFilter, maskFilter];
const processed = pipeline.reduce((f, filter) => filter(f), rawFrame);
```

## Data Flow

### Primary Frame Path (hot path, 30-60fps)

```
InputPlugin.tick(deltaMs)
    ↓ FrameData
MappingStrategy.map(frame, 480)
    ↓ Uint8Array (480×3 RGB)
ledStateRef.current.set(leds)    ← writes to ref, NOT React state
    ↓ (parallel)
OutputPlugin.send(leds, bri)     → WLED device
useFrame() reads ledStateRef     → Three.js InstancedMesh update
```

### WLED State Sync Path (bidirectional, event-driven)

```
WLED Device
    ↓ WebSocket broadcast (on any state change)
WLEDWebSocket.onMessage(json)
    ↓ deserialize
cubeStore.setWLEDState(state)    → Zustand update (React re-renders)
    ↑
Control Panel UI actions
    ↓ cubeStore.setBrightness() / setEffect() / setSegment()
WLEDWebSocket.send(json)         → WLED device
```

### Plugin Switching Path (infrequent, UI-driven)

```
User clicks input source in PluginPanel
    ↓
uiStore.setActivePlugin(id)
    ↓ Zustand update
PipelineEngine useEffect watches uiStore.activePlugin
    ↓
activePlugin.current.destroy()   ← cleanup resources (camera, MIDI)
activePlugin.current = registry.create(id)
activePlugin.current.initialize(context)
```

### Video/Camera Input Sub-Flow

```
Video element / getUserMedia stream
    ↓ requestVideoFrameCallback (browser) or rAF
Draw to OffscreenCanvas (Web Worker recommended for CPU-heavy cases)
    ↓ ImageData (RGBA, original resolution)
MappingStrategy (EdgeSampling or FaceExtraction)
    ↓ sample 12 edges × 20 LEDs = 240 sample points each
    ↓ (two tracks: 240+240 for both LED tracks)
Uint8Array(480 × 3)
```

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| Single user, local WiFi | Direct WebSocket to WLED device. No backend needed for WLED JSON/WS. Vercel static deploy. |
| Multi-user / shared control | Add Cloudflare Durable Objects or Supabase Realtime for state broadcast between browser tabs/devices. WLED has 4 WS connection limit — bottleneck. |
| Remote (not on local WiFi) | Need WLED device on accessible IP or VPN. Or use Art-Net bridge on local network. |

### Scaling Priorities

1. **First bottleneck:** WLED WebSocket connection limit (4 simultaneous). If multiple browser tabs open, connections compete. Mitigation: singleton WebSocket service shared across all tabs via BroadcastChannel.
2. **Second bottleneck:** Video mapping on main thread at 60fps. Mitigation: OffscreenCanvas + Web Worker for pixel processing; only pass final Uint8Array back to main thread via transferable.

## Anti-Patterns

### Anti-Pattern 1: setState in the Render Loop

**What people do:** Call `setState` or Zustand `set()` every frame with 480 LED colors, then have Three.js read from React state.

**Why it's wrong:** React's reconciliation is not designed for 60fps mutation of large objects. Causes consistent GC pauses and dropped frames. One dev measured ~40× performance difference between direct ref updates and setState at high frequency.

**Do this instead:** Store LED colors in a `Uint8Array` ref. Update Three.js `InstancedMesh` color attributes directly in `useFrame`. Only update Zustand when semantically meaningful state changes (active effect, brightness level) — not per-frame pixel data.

### Anti-Pattern 2: Monolithic Input Handler

**What people do:** Build a single component that handles video, MIDI, audio, camera, and manual painting as one tangled state machine with a mode flag.

**Why it's wrong:** Impossible to test in isolation. Adding a new input source requires modifying the monolith. Bugs in one input affect others. This is what causes rewrites.

**Do this instead:** Each input source is an independent class implementing `InputPlugin`. The pipeline engine calls the interface, never the concrete class. Tests can pass a mock plugin.

### Anti-Pattern 3: Direct WLED Coupling Throughout

**What people do:** Import `fetch('/json/state', ...)` calls directly in React components and event handlers.

**Why it's wrong:** No way to mock for testing. No way to swap output protocol. App breaks entirely if WLED is offline. Multiple components compete to send conflicting state.

**Do this instead:** All WLED communication goes through `WLEDWebSocket` and `WLEDRestClient` services. Components dispatch to Zustand. A single effect watches Zustand and issues WLED calls. This is the Command pattern.

### Anti-Pattern 4: sACN Direct from Browser

**What people do:** Try to open a UDP socket from browser JavaScript to send sACN directly.

**Why it's wrong:** Browsers have no UDP socket API. sACN/Art-Net require raw UDP. This cannot work from a browser.

**Do this instead:** For sACN support, build a minimal Node.js bridge script (200 lines) that the user runs locally. The browser app sends `fetch()` or WS messages to `localhost:PORT`; the bridge forwards as UDP to WLED. The `SACNOutput` plugin targets this bridge. This is the correct architecture — Resolume/xLights/etc. all follow this pattern.

### Anti-Pattern 5: Blocking Main Thread for Video Processing

**What people do:** Call `ctx.getImageData()` on every frame in the main thread, then sample 480 pixels synchronously.

**Why it's wrong:** `getImageData()` on a 1080p canvas takes 6-10ms. At 60fps that's 360-600ms/sec just reading pixels. Drops to ~15fps on weaker hardware.

**Do this instead:** Use `OffscreenCanvas` transferred to a Web Worker. Worker does sampling and returns only the final 480×3 byte array via `postMessage` with `transfer`. Main thread cost is near zero.

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| WLED JSON API | `WLEDRestClient` wraps `fetch()` calls to `/json/state`, `/json/info`, `/json/eff`, `/json/pal` | Needs CORS or same-network; device IP stored in uiStore |
| WLED WebSocket | `WLEDWebSocket` singleton; connects to `ws://[IP]/ws`; max 4 connections | Send `{"v":true}` to request full state; `{"lv":true}` for live LED stream (only 1 subscriber) |
| Web MIDI API | `MIDIPlugin` wraps `navigator.requestMIDIAccess()`; requires HTTPS | Use WebMIDI.js library for cross-browser abstraction |
| Web Audio API | `AudioPlugin` wraps `AudioContext`; AnalyserNode for FFT | Requires user gesture to initialize; BlackHole works as any audio input device |
| getUserMedia | `CameraPlugin` wraps `navigator.mediaDevices.getUserMedia()` | Requires HTTPS; permissions prompt |
| sACN/Art-Net | `SACNOutput` sends to local Node bridge via `fetch` | Bridge is a separate out-of-browser process; not in Vercel deploy |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| PipelineEngine ↔ InputPlugin | Interface method call (`plugin.tick(deltaMs)`) | Plugin never imports engine; engine only holds interface ref |
| PipelineEngine ↔ OutputPlugin | Interface method call (`output.send(leds, bri)`) | Swappable at runtime |
| PipelineEngine ↔ 3D Visualization | Shared `ledStateRef: React.RefObject<Uint8Array>` | No events; visualization reads ref in useFrame |
| UI Controls ↔ WLED | Write to Zustand → watched by WLEDWebSocket service | Components never call WLED directly |
| WLED Incoming ↔ UI | WLEDWebSocket writes to Zustand → React components re-render | One-way update, no loops |
| Video/Camera Plugin ↔ Mapping | `FrameData` with `canvas: OffscreenCanvas` field | Mapping strategy owns sampling logic; plugin just provides canvas |

## Build Order Implications

The component dependency graph dictates this build order. Each phase unlocks the next:

1. **Core types and interfaces** (`core/pipeline/types.ts`) — nothing else can start without these contracts defined. Changing interfaces later is the most expensive refactor possible.

2. **CubeState store** (`core/store/cubeStore.ts`) — both UI and pipeline need this. Defines the data shape for 480 LEDs, segments, brightness.

3. **WLED WebSocket + REST client** (`core/wled/`) — needed for visualization to show real cube state and for UI controls to have any effect.

4. **Pipeline engine + plugin registry** (`core/pipeline/`) — skeleton engine with no plugins; proves the loop works.

5. **3D visualization** (`visualization/`) — can stub LED data until pipeline is wired; needs CubeState ref.

6. **First input plugin (Manual Paint)** — simplest plugin; proves plugin contract works end-to-end.

7. **First output plugin (WLED WebSocket)** — closes the loop: paint → 3D view → physical cube.

8. **Remaining input plugins** (Video, MIDI, Camera, Audio) — all follow the same plugin interface; build in any order.

9. **Mapping strategies** — needed by Video and Camera plugins; build in parallel with them.

10. **UI Control Panel + Preset system** — can be built any time after CubeState store exists.

11. **sACN bridge + output plugin** — last because it requires out-of-browser component.

## Sources

- WLED WebSocket docs: https://kno.wled.ge/interfaces/websocket/ (HIGH confidence — official docs)
- WLED JSON API docs: https://kno.wled.ge/interfaces/json-api/ (HIGH confidence — official docs)
- WLED E1.31/DMX docs: https://kno.wled.ge/interfaces/e1.31-dmx/ (HIGH confidence — official docs)
- React/3D sync architecture: https://medium.com/@18667911647yosgi/high-frequency-synchronization-architecture-between-react-state-and-a-3d-engine-61b882c98a38 (MEDIUM confidence — independent article, patterns align with official R3F perf docs)
- React Three Fiber performance scaling: https://r3f.docs.pmnd.rs/advanced/scaling-performance (MEDIUM confidence — official R3F docs)
- openFrameworks plugin pattern: https://github.com/elliotwoods/ofxPlugin (MEDIUM confidence — established creative coding library)
- Plugin system TypeScript: https://dev.to/hexshift/designing-a-plugin-system-in-typescript-for-modular-web-applications-4db5 (MEDIUM confidence — aligns with factory pattern docs)
- Web Audio API architecture: https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API (HIGH confidence — MDN official)
- Video frame processing performance: https://webrtchacks.com/video-frame-processing-on-the-web-webassembly-webgpu-webgl-webcodecs-webnn-and-webtransport/ (MEDIUM confidence)
- Vitest WebSocket mock: https://github.com/akiomik/vitest-websocket-mock (HIGH confidence — active library, 100+ stars)
- Zustand vs Jotai 2025: https://www.reactlibraries.com/blog/zustand-vs-jotai-vs-valtio-performance-guide-2025 (MEDIUM confidence)

---
*Architecture research for: HyperCube Control — modular real-time LED creative control web app*
*Researched: 2026-04-09*
