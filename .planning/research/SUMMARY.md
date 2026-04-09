# Project Research Summary

**Project:** HyperCube Control
**Domain:** Real-time creative LED controller web app (WebGL 3D + WLED/ESP32 + Web APIs)
**Researched:** 2026-04-09
**Confidence:** HIGH (stack, architecture, pitfalls) / MEDIUM-HIGH (features)

## Executive Summary

HyperCube Control is a creative tooling problem, not a typical CRUD web app. It sits at the intersection of real-time 3D rendering (Three.js/R3F), hardware communication (WLED on ESP32), and browser-native peripheral APIs (Web MIDI, Web Audio, WebRTC). The recommended approach is a layered architecture with a game-loop pipeline at its core: input plugins produce per-frame data, a mapping strategy converts it to 480 LED colors, and output plugins emit to the physical device — all bypassing React's render cycle for the hot path. React owns UI and configuration state; refs and Zustand selectors own live data. This separation is the single most important architectural decision.

The stack is fully determined: React 19 + TypeScript 5 + Vite 6 + Three.js 0.183 + Tailwind CSS 4 are locked in. The 3D layer uses @react-three/fiber v9 + drei v10 (declarative Three.js in React, avoids ~60-70% boilerplate). State splits between Zustand (configuration/UI/presets) and Valtio (high-frequency live data). WLED communication uses native WebSocket and fetch — no third-party library survives the star threshold. WebMIDI.js v3 handles MIDI. All hardware browser APIs require HTTPS in production, and Vercel deployment handles this automatically.

The dominant risk is the HTTPS/HTTP mixed-content wall: the app deploys to HTTPS on Vercel, but WLED on ESP32 only speaks plain HTTP and `ws://`. Browsers hard-block this. The architectural answer is: Vercel is for sharing/demos; normal use runs a local dev server (`vite dev`) on HTTP. A second structural risk is treating the WLED WebSocket naively — it allows only 4 simultaneous clients, and the live pixel stream (`{"lv":true}`) has a single-subscriber exclusive lock. Both require a singleton connection manager with internal pub/sub from day one. A third risk is DDP/sACN pixel streaming: both are UDP protocols that browsers cannot send directly, so full per-pixel painting at 60fps requires a local WebSocket-to-UDP proxy for v1.x, or must use WLED's chunked JSON API as a slower fallback.

## Key Findings

### Recommended Stack

The stack is well-matched to the problem. @react-three/fiber v9 is the correct choice over raw Three.js in a React app — it eliminates imperative ref sprawl and the R3F team (pmndrs) is the same ecosystem as Zustand/Valtio, ensuring tight integration. The dual state management strategy (Zustand for slow state, Valtio for fast state) is the critical insight: React Context at 60fps causes a re-render storm that would make the app unusable. shadcn/ui over Tailwind v4 gives accessible unstyled primitives that support the 5 distinct UI variation requirement without a styling framework conflict. For WLED communication, building a thin custom typed client (~200 lines) is clearly better than the available libraries (wled-js, wled-client: under 50 GitHub stars each).

**Core technologies:**
- React 19 + TypeScript 5: Component model matches plugin architecture; strong typing enforces plugin contracts
- @react-three/fiber 9 + @react-three/drei 10: Declarative Three.js for the 480-LED cube visualization; same ecosystem as state libraries
- @react-three/postprocessing 3: Bloom effects on LEDs; batches effects efficiently via EffectPass
- Zustand 5: Configuration, preset, connection, and UI state — fine-grained subscriptions prevent unnecessary re-renders
- Valtio 2: Proxy-based mutation for 60fps hot path data (LED buffer, audio spectrum, MIDI CC values)
- Custom WLED client (native fetch + WebSocket): WLED API is simple enough; no library has sufficient traction
- WebMIDI.js 3: De facto standard Web MIDI wrapper; high-level event model, TypeScript support
- Native Web Audio API + Meyda (optional): FFT via AnalyserNode for audio reactivity; Meyda only if advanced features needed
- react-colorful 5: Tiny (2.8 KB), zero-dep color picker; 781+ npm dependents; sufficient for HSB/RGB/HEX
- shadcn/ui (CLI): Owned-source accessible primitives; supports 5 Tailwind-customized UI variations cleanly
- Vitest 3 + MSW 2: Vitest for speed; MSW v2 has first-class WebSocket mocking for WLED integration tests

### Expected Features

**Must have (table stakes):**
- Device connection + connection status indicator — everything depends on this; must be in Phase 1
- Real-time 3D cube visualization — core value proposition; validates the 3D interaction model
- Color picker + brightness/speed/intensity sliders — universal baseline; users expect these immediately
- Effect browser with live preview — WLED's 100+ effects are the primary use case after color control
- Palette browser — paired with effects; low implementation cost
- Segment control — power users need per-edge effects; cube has 12 distinct edges
- Preset save/load — without persistence, every session starts from scratch; a retention-killer
- Manual LED painting on 3D model — primary differentiator; no existing WLED controller offers 3D painting
- DDP pixel streaming output — required for per-pixel painting at full fidelity; JSON API is too slow
- First-launch setup wizard — reduces IP configuration friction for new users
- Responsive layout (desktop + phone)

**Should have (competitive differentiators):**
- Audio-reactive input (mic + BlackHole virtual audio) — browser-native, no Python install required; fills LedFx's installation gap
- MIDI controller mapping — no existing WLED controller offers this; high value for performers
- Video/image mapping to cube edges — novel for 3D cube; edge sampling + face-to-edge extraction strategies
- Webcam motion-reactive input — lowest priority of the input sources; add after audio and MIDI
- 5 distinct UI design variations — Ableton/Resolume pro-tool aesthetic; differentiated by user archetype

**Defer (v2+):**
- Multi-cube sync — adds protocol complexity; single-cube focus for v1
- Timeline/sequencer — xLights covers this better; build only with explicit user demand
- Screen capture input — `getDisplayMedia` requires permission each session; defer
- Plugin marketplace / sharing — requires CDN, security review, versioning infrastructure

### Architecture Approach

The architecture is a layered pipeline with clean interface boundaries. Input plugins implement `InputPlugin` (producing `FrameData` per tick), mapping strategies implement `MappingStrategy` (converting `FrameData` to a `Uint8Array` of 480x3 RGB bytes), and output plugins implement `OutputPlugin` (sending the byte array to the device). The pipeline engine runs in a `requestAnimationFrame` loop driven by `useRef`, completely outside React's render cycle. Three.js reads from the same `ledStateRef` in R3F's `useFrame`. React state only updates at ~10fps for UI display — never for the hot path. WLED communication is centralized in a singleton `WLEDWebSocket` service; components write to Zustand and a single effect dispatches to WLED.

**Major components:**
1. PipelineEngine — game loop (30-60fps RAF), calls active InputPlugin.tick(), routes through MappingStrategy, writes to ledStateRef, calls OutputPlugin.send(); lives entirely in refs, never touches React state
2. CubeState store (Zustand) — 480 LED colors (Uint8Array), segments, brightness, active effect; single source of truth for UI; projections updated at display frequency (~10fps)
3. WLEDWebSocket singleton — bidirectional sync; incoming state updates Zustand; outgoing changes batched from Zustand; serialized request queue prevents parallel API calls
4. 3D Visualization (R3F) — InstancedMesh of 480 LED nodes; useFrame reads ledStateRef directly; no React state in the render loop; geometry/material created once with useMemo
5. PluginRegistry — factory pattern mapping plugin IDs to constructors; core never imports concrete plugin classes
6. InputPlugin / MappingStrategy / OutputPlugin interfaces — the load-bearing contracts; all plugin development follows these interfaces; enables isolated unit testing
7. Control Panel UI — React components writing to Zustand; never calling WLED directly; WLED calls dispatched by a single watched effect

### Critical Pitfalls

1. **HTTPS/HTTP mixed content** — Vercel deploys HTTPS; WLED speaks plain HTTP/ws. Browsers hard-block this. Mitigation: document that normal use requires local HTTP server (`vite dev`); app must detect HTTP vs HTTPS and display clear warning when deployed to HTTPS. Must be addressed in Phase 1.

2. **WLED 4-client WebSocket limit + live stream exclusivity** — WLED allows max 4 concurrent WS clients; the live pixel stream (`{"lv":true}`) is exclusive to one subscriber at a time. Mitigation: singleton `WLEDWebSocket` service sharing one connection; internal pub/sub fan-out; never request live stream from multiple places. Must be in Phase 1 design.

3. **React re-renders killing Three.js animation** — Calling `setState` or Zustand `set()` with 480 LED colors per frame causes 60 React reconciliations/second; completely breaks animation performance. Mitigation: LED colors live in `Uint8Array` refs; Three.js InstancedMesh attributes updated directly in `useFrame`; Zustand only updated for semantically meaningful state changes. This pattern is non-negotiable from Phase 1.

4. **WLED JSON API sequential-only + 24KB buffer limit** — WLED explicitly prohibits parallel API requests; the ESP32 buffer caps LED array payloads at ~256 LEDs per request. Mitigation: serialized request queue wrapper; chunk 480 LED writes into <=256-LED sequential batches; always verify brightness > 0 before LED writes. Must be built in the communication layer before any painting feature.

5. **UDP protocols (DDP, sACN, Art-Net) are inaccessible from browsers** — Browsers have no raw UDP socket API. Mitigation: use WLED JSON API + WebSocket for all v1 control; defer full 60fps pixel streaming to a local WebSocket-to-UDP proxy for v1.x; document this constraint clearly. Decision must be made in Phase 1 to avoid discovering it mid-build.

6. **WLED firmware fork (hs-1.6) may diverge from upstream docs** — The HyperCube runs a custom WLED fork. API behavior may differ. Mitigation: probe `/json/info` at startup; build virtual cube mock from observed `hs-1.6` behavior; test against real device in every communication phase.

7. **AudioContext suspended state** — `new AudioContext()` created outside a user gesture starts suspended and silently returns zeros. Mitigation: create/resume AudioContext only inside click/touch event handlers; test specifically in Firefox.

8. **Web MIDI dead zone on Safari/iOS** — Web MIDI API has zero Safari support and is completely blocked on iOS. Mitigation: treat MIDI as progressive enhancement with feature detection and graceful fallback.

## Implications for Roadmap

### Phase 1: Foundation and Core Communication

**Rationale:** Every feature depends on a working WLED connection. The HTTPS/HTTP mixed-content constraint, singleton WebSocket manager, serialized API queue, firmware version probing, and `hs-1.6` behavioral differences must all be solved before any UI work begins. Plugin interface contracts defined here are the most expensive to change later.

**Delivers:** Working WLED connection with singleton WebSocket, serialized REST client with request queue, probed firmware capabilities from `/json/info`, core TypeScript interface definitions (`InputPlugin`, `MappingStrategy`, `OutputPlugin`, `FrameData`), Zustand/Valtio store structure, first-launch setup wizard, connection status UI, HTTP/HTTPS detection with user warning.

**Addresses:** Device connection + connection status indicator, first-launch setup wizard

**Avoids:** HTTPS/HTTP mixed content, WLED 4-client limit, parallel API request corruption, hs-1.6 firmware divergence

### Phase 2: 3D Visualization + Pipeline Engine

**Rationale:** The 3D cube is the core value proposition and most technically risky component. Building it second forces the pipeline architecture to be proven before business logic is layered on. The game loop pattern and ref-based LED state must be validated with a real Three.js scene.

**Delivers:** R3F canvas with 480-node InstancedMesh cube geometry, `useFrame`-based LED color sync from `ledStateRef`, game loop `PipelineEngine` with RAF loop and plugin interface, `PluginRegistry` factory, first working ManualPaintPlugin (simplest input plugin), first working WLEDWebSocketOutput (closes the end-to-end loop), `renderer.info` monitoring for memory leak detection.

**Addresses:** Real-time 3D cube visualization, core plugin architecture

**Avoids:** React re-renders killing Three.js animation, Three.js GPU memory leaks, setState-in-RAF antipattern

### Phase 3: WLED Control Panel + Presets

**Rationale:** With the 3D view working and WLED connection established, users need core LED control UI. Effect browser, palette browser, segment control, and preset system all share the same WLED API surface and are more efficient built together.

**Delivers:** Effect browser with live preview (from `/json/eff`), palette browser (from `/json/pal`), segment control UI, color picker + brightness/speed/intensity sliders, preset save/load backed by WLED's 250-preset API and local JSON export, per-effect dynamic parameter labels via `/json/fxdata`, responsive layout for desktop and phone.

**Addresses:** Color picker, brightness/speed/intensity sliders, effect browser, palette browser, segment control, preset save/load, responsive design

**Avoids:** WLED sequential API queue (established in Phase 1), chunked LED writes, brightness-before-color sequencing

### Phase 4: Manual LED Painting + DDP Output

**Rationale:** Manual 3D painting is the primary differentiator and requires Phase 2 (3D visualization) and Phase 1 (WLED communication) to both be solid. DDP pixel streaming is the prerequisite for full-fidelity painting — WLED JSON API's buffer limit makes it too slow for interactive 480-LED painting.

**Delivers:** Raycasting against 480-node cube geometry for paint targeting, ManualPaintPlugin producing direct Uint8Array frames, per-pixel DDP output (via local WebSocket-to-UDP proxy or chunked JSON fallback), paint brush size/color/opacity controls, DDP proxy architecture decision and documentation.

**Addresses:** Manual LED painting on 3D model, DDP pixel streaming output

**Avoids:** UDP accessibility constraint (must choose proxy path or JSON chunked fallback explicitly), WLED buffer limits on JSON painting path

**Research flag:** DDP proxy architecture is the most open question. Need to decide local Node.js bridge vs. chunked JSON API as primary painting protocol. Latency test on real hardware required before committing.

### Phase 5: Audio-Reactive Input Plugin

**Rationale:** Audio reactivity is the highest-value creative input after manual painting. Building it as the first advanced input plugin also validates the `InputPlugin` interface against a non-trivial data type (Float32Array spectrum). BlackHole virtual device support is automatic via Web Audio's device enumeration.

**Delivers:** `AudioPlugin` implementing `InputPlugin`, Web Audio API capture with device enumeration (mic + BlackHole + system audio), FFT AnalyserNode frequency band extraction, audio-to-LED mapping strategies, lazy AudioContext initialization behind user gesture, `audioContext.state` monitoring.

**Addresses:** Audio-reactive input (mic + BlackHole)

**Avoids:** AudioContext suspended state (user gesture initialization), React Context for high-frequency audio data

### Phase 6: MIDI Controller Mapping

**Rationale:** MIDI is high value for live performers. Similar plugin structure to audio. Safari/iOS incompatibility must be handled with graceful degradation. Validates progressive enhancement patterns.

**Delivers:** `MIDIPlugin` implementing `InputPlugin`, WebMIDI.js integration with device enumeration, CC-to-parameter mapping UI, note-on-to-preset-trigger, MIDI learn mode, feature detection and graceful fallback for Safari/iOS.

**Addresses:** MIDI controller mapping

**Avoids:** Safari/iOS Web MIDI dead zone, Chrome permission gate UX pitfall

### Phase 7: Video/Image Mapping + Webcam Input

**Rationale:** Video and camera inputs share the OffscreenCanvas/Web Worker pixel processing pipeline and mapping strategies. Most computationally intensive feature set; benefits from stable pipeline foundation.

**Delivers:** `VideoPlugin` and `CameraPlugin` implementing `InputPlugin`, OffscreenCanvas + Web Worker architecture for pixel processing, `EdgeSamplingStrategy` and `FaceExtractionStrategy` implementing `MappingStrategy`, video file/URL input support, webcam motion detection via frame pixel diffing.

**Addresses:** Video/image mapping, webcam motion-reactive input

**Avoids:** `getImageData()` on main thread (6-10ms per frame = dropped frames)

**Research flag:** OffscreenCanvas + Web Worker message passing with transferable Uint8Array needs concrete API design. The spatial mapping from video canvas pixels to the 12-edge cube geometry is novel and needs detailed design during planning.

### Phase 8: UI Design Variations + Polish

**Rationale:** 5 distinct UI design variations are built on top of a working core. Aesthetic variations before stable features lead to rework.

**Delivers:** 5 distinct Tailwind CSS theme configurations (zinc/slate base with distinct accent palettes), dark pro-tool aesthetic for all variations, Ableton/Resolume-inspired layout refinements, mobile-optimized touch-friendly layout, final responsive polish.

**Addresses:** 5 distinct UI design variations, final responsive design polish

### Phase Ordering Rationale

- Communication layer (Phase 1) must precede everything — without working WLED connection, no feature can be validated against real hardware
- Plugin interfaces must be defined before any concrete plugins — changing interfaces after two plugins exist forces refactoring both
- 3D visualization (Phase 2) before input plugins — proves the pipeline loop; ManualPaint is the simplest plugin and closes the first end-to-end loop
- Control panel (Phase 3) before advanced inputs — users need basic WLED control before creative inputs add value; validates WLED state round-trip
- DDP painting (Phase 4) before other input plugins — audio, MIDI, and video all ultimately need per-pixel output; DDP proxy architecture decision must be made first
- Audio (Phase 5) before MIDI (Phase 6) — wider appeal and simpler graceful degradation; MIDI has a hard browser compatibility constraint that benefits from being scoped after core is proven
- Video/webcam (Phase 7) last among inputs — most computationally complex; benefits from stable pipeline and proven OffscreenCanvas patterns

### Research Flags

Phases needing deeper research or design during planning:

- **Phase 4 (DDP Painting):** DDP proxy architecture is the most open architectural question. Whether chunked JSON LED writes are fast enough for interactive painting is an empirical question requiring latency testing on real hardware over WiFi. If JSON chunked path is too slow, the local proxy becomes mandatory for v1 — this has significant UX implications.
- **Phase 7 (Video/Webcam):** OffscreenCanvas + Web Worker message passing with transferable Uint8Array needs concrete API design. The EdgeSampling spatial mapping from video canvas pixels to the 12-edge x 20-LED cube geometry is novel — no direct reference implementation exists.

Phases with standard, well-documented patterns (skip deep research):

- **Phase 1 (Foundation):** WebSocket singleton, REST client with queue — standard patterns, well-documented
- **Phase 2 (3D Visualization):** R3F InstancedMesh pattern is covered in official docs and widely deployed
- **Phase 3 (Control Panel):** WLED JSON API surface is fully documented; shadcn/ui + Tailwind well-established
- **Phase 5 (Audio):** Web Audio API AnalyserNode FFT is canonical MDN-documented pattern
- **Phase 6 (MIDI):** WebMIDI.js v3 has clear docs; plugin pattern proven by Phase 5

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All versions verified against npm and official docs; version compatibility table validated; rationale grounded in well-documented ecosystem constraints |
| Features | MEDIUM-HIGH | WLED capabilities verified against official kno.wled.ge docs; competitor analysis from official sources; user behavior inferred from GitHub issues and community |
| Architecture | HIGH | Patterns verified against official R3F docs, MDN, and established creative coding patterns; game loop + plugin interface contract is the canonical approach for this problem class |
| Pitfalls | MEDIUM-HIGH | HTTPS/HTTP constraint verified by WLED security docs; WebSocket limit from official WLED docs; UDP constraint from browser platform docs; hs-1.6 fork behavior is a known unknown requiring real hardware validation |

**Overall confidence:** HIGH

### Gaps to Address

- **hs-1.6 firmware behavior:** The custom WLED fork's API surface relative to upstream docs is unknown until tested on real hardware. Build virtual cube mock conservatively against observed behavior, not assumed upstream. Probe `/json/info` at startup in all tests.
- **DDP proxy architecture for v1:** Whether chunked JSON LED writes are fast enough for interactive painting is an empirical question requiring latency testing on the real device over WiFi. This gates the Phase 4 implementation path decision.
- **OffscreenCanvas + Web Worker API surface for video mapping:** The mapping from a video canvas to 12-edge cube geometry is novel; no direct reference implementation exists. Needs concrete design during Phase 7 planning.
- **5 UI variations design direction:** The Tailwind theme token structure for 5 distinct themes needs design work; the functional system exists (CSS variables, shadcn/ui) but the actual aesthetic decisions for each variation are deferred to design phase.

## Sources

### Primary (HIGH confidence)
- WLED official docs (kno.wled.ge) — WebSocket, JSON API, DDP protocol, segment control, preset system, security
- React Three Fiber docs (r3f.docs.pmnd.rs) — performance pitfalls, scaling, useFrame patterns, peer dependencies
- MDN Web Docs — Web Audio API, Web MIDI API, getUserMedia, AudioContext autoplay policy
- shadcn/ui Tailwind v4 docs (ui.shadcn.com) — React 19 + Tailwind v4 compatibility, March 2025 update confirmed
- npm package pages — R3F 9.5.0, drei 10.7.7, postprocessing 3.0.4, zustand 5.0.12, valtio 2.3.1, webmidi 3.1.14 all verified
- three.js GitHub releases — v0.183.2 confirmed current
- R3F GitHub package.json — `three: >=0.156` peer dep confirmed
- Can I Use: Web MIDI — Safari unsupported, iOS blocked, confirmed 2024
- Chrome Web MIDI Permission (developer.chrome.com) — 2024 permission gate documented

### Secondary (MEDIUM confidence)
- WLED GitHub issue tracker — WebSocket limit issue #3855, connectivity issue #3954; real user behavior confirmed
- React performance community sources — Zustand vs Jotai vs Valtio 2025 comparison
- LedFx docs (docs.ledfx.app) — competitor feature comparison; MIDI support 2024
- MadMapper features (madmapper.com) — competitor feature comparison; video mapping capabilities
- R3F/Three.js architecture articles — React/3D sync patterns; high-frequency state management
- MSW WebSocket docs (mswjs.io) — v2 WebSocket mocking first-class support confirmed

### Tertiary (LOW confidence)
- Hyperspace Lighting App App Store page — competitor feature comparison; reported unreliability
- 2020 Resolume/MadMapper LED mapping article — workflow reference only; API details may be stale

---
*Research completed: 2026-04-09*
*Ready for roadmap: yes*
