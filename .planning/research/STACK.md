# Stack Research

**Domain:** Real-time LED controller web app with 3D visualization, MIDI, audio, and camera inputs
**Researched:** 2026-04-09
**Confidence:** HIGH (most decisions verified against official docs/npm; a few supporting libs are MEDIUM)

---

## Recommended Stack

### Core Technologies (Already Decided)

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| React | 19.x | UI component tree, reactivity | Already decided; v19 is current stable; pairs with R3F v9 |
| TypeScript | 5.x | Type safety across plugin contracts | Already decided; critical for plugin interface typing |
| Vite | 6.x | Build tooling, HMR | Already decided; fastest DX for React; native ESM |
| Three.js | 0.183.x | WebGL 3D rendering | Already decided; >=0.156 required by R3F v9 |
| Tailwind CSS | 4.x | Utility-first styling | Already decided; v4 is CSS-first (no tailwind.config.js), OKLCH colors |

### 3D Layer

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| @react-three/fiber | 9.5.0 | React renderer for Three.js | R3F v9 pairs with React 19. Declarative component model matches the modular plugin architecture. Reduces Three.js boilerplate by ~60-70%. For a React-first app there is no reason to use raw Three.js |
| @react-three/drei | 10.7.7 | Helper abstractions for R3F | `OrbitControls`, `Html`, `useTexture`, `PerspectiveCamera`, `Stats` — all free. Saves dozens of hours. Standard companion to R3F |
| @react-three/postprocessing | 3.0.4 | Post-processing effects | Built on `postprocessing` library (6.38.x), meshes with R3F's render loop; EffectPass batches effects efficiently. Use for bloom on the cube visualization |

**Why not raw Three.js:** This is a React app. R3F does not add overhead beyond the small React reconciler cost, which is negligible compared to the WiFi latency bottleneck. Raw Three.js in React means imperative refs everywhere and a complete break from React's model.

**Why not A-Frame or Babylon.js:** A-Frame is HTML-attribute-based and not composable with React components. Babylon.js has a React renderer but a much smaller ecosystem and no equivalent of drei.

### WLED Communication

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Native WebSocket (browser built-in) | — | Real-time WLED state via `/ws` | No library needed. WLED WebSocket is a simple JSON channel. Roll a thin wrapper class |
| Native fetch (browser built-in) | — | WLED JSON API (`/json/state`, `/json/eff`, `/json/pal`) | REST calls are infrequent; native fetch is sufficient |

**Why not wled-js or wled-client:** Both have under 50 GitHub stars and low adoption. wled-client has ~15 stars and 2 dependent packages. wled-js is similarly minor. The WLED API is simple enough (WebSocket + REST) that a custom typed client wrapper is safer — no dependency rot risk, full control over DDP framing.

**DDP (pixel streaming):** DDP is UDP-only (port 4048). Browsers have no raw UDP access. **Use WLED's existing WebSocket + JSON API for real-time control.** If sub-5ms pixel streaming is needed later, a lightweight Vite dev proxy or a Vercel Edge Function can bridge WebSocket-to-DDP on the LAN. For v1, the WLED `/json/state` WebSocket is adequate.

**sACN/E1.31 and Art-Net:** Both are UDP multicast protocols. Browsers cannot send raw UDP. **These are out of scope for the browser app.** The recommendation is: use DDP via the server-side proxy path described above if pixel-perfect streaming is needed. Do not attempt to send sACN/E1.31 from the browser — it is architecturally impossible without a proxy.

### State Management

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Zustand | 5.0.12 | Global app state (connection config, presets, active mode) | From the pmndrs ecosystem (same team as R3F). Tiny (1 KB). No Provider wrapper. Selectors prevent unnecessary re-renders. v5 is current. Use for state that multiple distant components read |
| Valtio | 2.3.1 | High-frequency reactive state (LED frame buffer, audio levels, MIDI cc values) | Proxy-based mutations are ideal for 60fps data that updates on every frame. Components only re-render on the slices they read. Better DX than Zustand for hot paths where you mutate directly |

**Strategy:** Use Zustand for configuration, UI, preset, and connection state. Use Valtio for the live data plane (current LED colors, audio spectrum, MIDI values). This separation avoids re-rendering UI components at 60fps.

**Why not Jotai:** Jotai's atom model adds boilerplate for a domain with clear store boundaries. Zustand+Valtio covers both patterns better.

**Why not Redux:** Zero justification for Redux's ceremony in a single-developer creative tool. No time-travel debugging needed here.

**Why not React Context for real-time data:** Context triggers a full subtree re-render on every update. At 60fps that would destroy performance.

### MIDI

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| webmidi | 3.1.14 | Web MIDI API wrapper | WEBMIDI.js v3 is the de facto standard. High-level event model (`noteon`, `controlchange`, `pitchbend`) instead of raw MIDI bytes. TypeScript support. Actively maintained (last publish ~5 months ago). Much cleaner than the raw Web MIDI API |

**Why not JZZ:** JZZ is a lower-level MIDI library that primarily targets polyfilling browsers that lack Web MIDI. All target browsers (Chrome/Edge on desktop) support Web MIDI natively. WEBMIDI.js is simpler and more idiomatic.

**Browser requirement:** Web MIDI requires HTTPS in production (Vercel deployment satisfies this) and a user permission prompt.

### Audio Analysis

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Native Web Audio API | — | Capture mic/system/virtual audio, build AnalyserNode | No library needed for basic FFT and waveform data. `AnalyserNode.getByteFrequencyData()` gives a frequency array suitable for driving LED patterns directly |
| meyda | 5.6.3 | Advanced audio feature extraction (RMS, spectral centroid, MFCC) | Use only if basic FFT is insufficient. Meyda runs on an `AudioWorkletNode` or `ScriptProcessorNode`. Note: last published 2 years ago but stable; feature set is unlikely to change |

**Strategy for BlackHole:** Web Audio API enumerates all audio input devices including virtual devices (BlackHole). Use `navigator.mediaDevices.enumerateDevices()` to list and select them. No special library needed.

**Why not Tone.js:** Tone.js is a music synthesis framework, not an analysis library. Overkill for LED reactive audio — we need FFT data, not synthesis.

### Camera / Motion Detection

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Native WebRTC / getUserMedia | — | Webcam video stream capture | `navigator.mediaDevices.getUserMedia({video: true})` is the standard. No library needed |
| Canvas 2D API (`getImageData`) | — | Frame pixel diffing for motion detection | Standard approach: draw video frame to offscreen canvas, compare pixel arrays between frames, compute motion mask. Performant at 640x480 |

**No motion detection library needed.** The technique is a ~50-line implementation: draw frame to canvas, `getImageData`, diff against previous frame, derive a motion intensity float per LED region. Libraries like `diffyjs` exist but add dependency weight for trivial code.

**Performance note:** Downscale the captured frame to match the LED grid resolution (e.g., 20x12 for the HyperCube layout) before pixel comparison. Processing 240 pixels instead of 307,200 makes this trivially fast.

### Color Picker

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| react-colorful | 5.6.1 | Hex/HSL/RGB color selection UI | Tiny (2.8 KB), zero dependencies, mobile-friendly, accessible. Despite not being updated in 4 years, it is widely used (781+ npm dependents) and has no open critical bugs. Fully sufficient for a hue/saturation/brightness picker |

**Why not react-color:** `react-color` (the older casesandberg library) is unmaintained and significantly larger. react-colorful is its recommended modern replacement.

### UI Components

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| shadcn/ui | latest CLI | Headless component primitives with copy-owned source | Built on Radix UI primitives + Tailwind v4. Components are copied into your repo (not installed as a package), so you own the code completely. Updated for Tailwind v4 and React 19 in 2025. Dark mode works via Tailwind `.dark` class or `data-theme` attribute |

**Aesthetic strategy:** shadcn's default theme is neutral. For the Ableton/Resolume pro-tool aesthetic, override CSS variables in `globals.css` (zinc/slate base, custom accent colors). Use `next-themes` or a simple data-attribute toggle for dark mode. All 5 UI design variations will be Tailwind-class-level customizations over shadcn components.

**Why not Mantine or Chakra UI:** Both impose their own styling systems that conflict with Tailwind-first development. shadcn gives you unstyled accessible primitives that you style with Tailwind, which is exactly what 5 distinct UI variations require.

**Why not Material UI (MUI):** MUI has its own CSS-in-JS emotion runtime that conflicts with Tailwind and adds bundle weight. The pro-tool aesthetic runs counter to Material Design's opinionated visual language.

### Testing

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Vitest | 3.x | Unit and integration test runner | Native Vite integration, Jest-compatible API, ~10x faster than Jest for this project's configuration. Standard pairing for Vite+React |
| @testing-library/react | 16.x | React component testing | Standard for testing component behavior without implementation details. Works with Vitest via jsdom |
| vitest-canvas-mock | latest | Mock HTMLCanvasElement in Vitest | Required for testing Three.js canvas and audio canvas code in jsdom. Fork of jest-canvas-mock ported to Vitest |
| msw | 2.x | Mock WebSocket and HTTP API | First-class WebSocket mocking support in v2. Mock the WLED WebSocket server for integration tests. Works in both Vitest (Node) and browser environments |

**Testing strategy:** Do not attempt to render Three.js scenes in unit tests (jsdom has no WebGL). Test the data pipeline in isolation: state stores, LED mapper functions, plugin contracts, MIDI message handlers, audio feature transformers. Use MSW to mock the WLED WebSocket. For visual validation use Storybook or visual snapshot tests with Playwright.

**Why not Jest:** No Vite native integration. Slower due to transpilation overhead. Vitest is a drop-in replacement with better DX.

---

## Installation

```bash
# Core (add to existing React + TS + Vite + Three.js + Tailwind project)
npm install @react-three/fiber @react-three/drei @react-three/postprocessing
npm install zustand valtio
npm install webmidi
npm install react-colorful
npm install meyda

# shadcn/ui (CLI install, not npm package)
npx shadcn@latest init

# Dev dependencies
npm install -D vitest @testing-library/react @testing-library/jest-dom
npm install -D vitest-canvas-mock msw
npm install -D @types/three
```

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| @react-three/fiber | Raw Three.js | Non-React projects, or when you need direct render loop control without React reconciler overhead |
| @react-three/drei | Custom helpers | If drei's component model doesn't fit (very rare) |
| Zustand + Valtio | Jotai | When you prefer atomic state composition model over store model |
| webmidi | Raw Web MIDI API | If you need the absolute minimal bundle and can write your own MIDI parsing |
| Native Web Audio API | Meyda | Only add Meyda if you need MFCC, spectral rolloff, or other advanced features beyond FFT |
| Custom WLED client | wled-js / wled-client | Neither library has sufficient community traction for a production dependency |
| msw | Manual WebSocket mock | MSW is far cleaner and supports WebSocket interception natively in v2 |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| redux / @reduxjs/toolkit | Zero justification for the ceremony. Time-travel debugging not needed. | Zustand + Valtio |
| React Context for LED data | Triggers full subtree re-render at 60fps, causing performance collapse | Valtio for hot data paths |
| wled-js / wled-client | Under 50 GitHub stars each, low adoption, WLED API is simple enough to wrap yourself | Custom thin typed client (< 200 lines) |
| sACN / E1.31 / Art-Net from browser | UDP is not accessible from browsers. Architecturally impossible without a proxy | WLED JSON API + WebSocket (sufficient for all use cases); DDP via proxy if needed |
| Tone.js | Audio synthesis framework, not analysis | Native Web Audio API AnalyserNode |
| Jest | No native Vite integration; slower transpilation; Vitest is a drop-in replacement | Vitest |
| react-color (casesandberg) | Unmaintained, large bundle | react-colorful |
| Mantine / Chakra UI | Impose styling systems conflicting with Tailwind-first development | shadcn/ui |
| MUI (Material UI) | emotion/CSS-in-JS conflicts with Tailwind; Material Design aesthetic incompatible with pro-tool requirement | shadcn/ui |
| Babylon.js | Smaller ecosystem than Three.js; no equivalent of drei; not worth switching from Three.js | Three.js + R3F |
| A-Frame | HTML-attribute-based, not composable with React component model | Three.js + R3F |

---

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| @react-three/fiber@9.5.0 | react@19, three@>=0.156 | Official peerDep: `react: >=18`, `three: >=0.156`. Current three@0.183.x is well within range |
| @react-three/drei@10.7.7 | @react-three/fiber@9, three@>=0.159 | Verify with `npm ls` after install; drei v10 aligns with R3F v9 / React 19 |
| @react-three/postprocessing@3.0.4 | @react-three/fiber@8-9, postprocessing@6.x | Uses `postprocessing@6.38.x` underneath; that package is actively updated (16 days ago as of research date) |
| webmidi@3.1.14 | Browser (Web MIDI API), Node.js | Requires HTTPS for `navigator.requestMIDIAccess()` in production |
| zustand@5.0.12 | react@18+, react@19 | v5 dropped React 17 support |
| valtio@2.3.1 | react@18+, react@19 | Proxy-based; works fine alongside Zustand |
| shadcn/ui | tailwindcss@4, react@19 | CLI was updated March 2025 for Tailwind v4 + React 19 |
| meyda@5.6.3 | Web Audio API | Last published 2 years ago but stable; no active development needed |

---

## Protocol Decision Summary

```
Control plane (effects, brightness, presets, config):
  → WLED JSON API (fetch) + WLED WebSocket (/ws)
  → Native browser APIs, no library

Pixel streaming (per-LED color at 60fps):
  → DDP via UDP — NOT directly from browser
  → Option A: Use WLED WebSocket live-view hack ({"lv":true}) for read-only feedback
  → Option B: Add a tiny Vercel Edge Function / LAN proxy that accepts WebSocket and
              forwards as UDP DDP packets to the device (defer to later phase)
  → sACN/Art-Net: excluded — same UDP constraint, higher complexity, no benefit over DDP
```

---

## Sources

- [@react-three/fiber npm](https://www.npmjs.com/package/@react-three/fiber) — v9.5.0 confirmed, React 19 pairing
- [@react-three/drei npm](https://www.npmjs.com/package/@react-three/drei) — v10.7.7 confirmed
- [R3F Installation Docs](https://r3f.docs.pmnd.rs/getting-started/installation) — peer deps, installation pattern
- [R3F GitHub package.json](https://github.com/pmndrs/react-three-fiber/blob/master/packages/fiber/package.json) — `three: >=0.156` confirmed (HIGH confidence)
- [@react-three/postprocessing npm](https://www.npmjs.com/package/@react-three/postprocessing) — v3.0.4, underlying `postprocessing@6.38.x`
- [webmidi npm](https://www.npmjs.com/package/webmidi) — v3.1.14, WEBMIDI.js homepage
- [zustand npm](https://www.npmjs.com/package/zustand) — v5.0.12 confirmed
- [valtio npm](https://www.npmjs.com/package/valtio) — v2.3.1 confirmed
- [meyda npm](https://www.npmjs.com/package/meyda) — v5.6.3, last published 2 years ago
- [react-colorful GitHub](https://github.com/omgovich/react-colorful) — v5.6.1, 781 npm dependents
- [shadcn/ui Tailwind v4 docs](https://ui.shadcn.com/docs/tailwind-v4) — updated March 2025, React 19 + Tailwind v4
- [WLED WebSocket docs](https://kno.wled.ge/interfaces/websocket/) — WebSocket /ws endpoint, live LED stream
- [WLED JSON API docs](https://kno.wled.ge/interfaces/json-api/) — /json/state, /json/eff, /json/pal, /json/palx
- [DDP Protocol — WLED](https://kno.wled.ge/interfaces/ddp/) — UDP port 4048, 480 RGB pixels per packet
- [MSW WebSocket docs](https://mswjs.io/docs/websocket/) — first-class WebSocket mocking in v2
- [vitest-canvas-mock GitHub](https://github.com/wobsoriano/vitest-canvas-mock) — canvas mock for Vitest
- [Hacker News: Raw UDP in browser](https://news.ycombinator.com/item?id=31984112) — confirms UDP not available in browsers (HIGH confidence)
- [Zustand vs Jotai vs Valtio 2025](https://www.reactlibraries.com/blog/zustand-vs-jotai-vs-valtio-performance-guide-2025) — MEDIUM confidence (community source)
- [three.js releases](https://github.com/mrdoob/three.js/releases) — latest 0.183.2 confirmed

---

*Stack research for: HyperCube Control — real-time LED controller web app*
*Researched: 2026-04-09*
