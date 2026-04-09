# Roadmap: HyperCube Control

## Overview

Eight phases take HyperCube Control from nothing to a fully-featured real-time creative LED controller. Phase 1 establishes the WLED communication layer and plugin interface contracts — the load-bearing foundation everything else attaches to. Phase 2 proves the 3D rendering and pipeline architecture with a working end-to-end loop. Phase 3 adds the core WLED control UI. Phases 4–7 layer in the four input modalities (manual painting, audio, MIDI, video/camera) as independent plugins. Phase 8 delivers the five UI design variations and final polish. Depth is comprehensive: each phase has 5–10 plans and natural delivery boundaries driven by the requirements.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Foundation & WLED Communication** - Establish WLED connection layer, plugin interface contracts, setup wizard, deployment config, and virtual cube testing infrastructure
- [ ] **Phase 2: 3D Visualization & Pipeline Engine** - Render the interactive 3D cube, prove the game-loop pipeline with refs (no React state in hot path), close the first end-to-end loop
- [ ] **Phase 3: WLED Control Panel & Presets** - Effect/palette browser, color/brightness/speed controls, preset save/load, and responsive layout baseline
- [ ] **Phase 4: Manual LED Painting** - Raycasting-based 3D paint on the cube with per-pixel output, brush controls, and real-time send to hardware
- [ ] **Phase 5: Audio-Reactive Input** - Web Audio API FFT pipeline as an InputPlugin, with device enumeration, sensitivity controls, and BlackHole virtual device support
- [ ] **Phase 6: MIDI Controller Mapping** - WebMIDI.js integration as an InputPlugin, CC/note mapping UI, MIDI learn mode, and Safari/iOS graceful degradation
- [ ] **Phase 7: Video & Camera Input** - Video/image and webcam InputPlugins using OffscreenCanvas + Web Worker, with edge-sampling and face-extraction MappingStrategies
- [x] **Phase 8: UI Design Variations & Polish** - 5 distinct dark pro-tool Tailwind themes, theme switcher, accessibility polish, and CI test coverage

## Phase Details

### Phase 1: Foundation & WLED Communication
**Goal**: Users can connect to their HyperCube, the app establishes a robust WLED communication layer, and all plugin interface contracts are defined so every subsequent phase builds on stable ground
**Depends on**: Nothing (first phase)
**Requirements**: CONN-01, CONN-02, CONN-03, CONN-04, CONN-05, CONN-06, CONN-07, PLUG-01, PLUG-02, PLUG-03, PLUG-06, PLUG-07, DEP-01, DEP-02, DEP-03, SETUP-01, SETUP-02, SETUP-03, SETUP-04, SETUP-05, SETUP-06, TEST-01, TEST-02
**Success Criteria** (what must be TRUE):
  1. User can enter (or see auto-detected) HyperCube IP and the app connects, showing a real-time connected/reconnecting/disconnected indicator
  2. Connection auto-recovers with exponential backoff — unplugging and replugging the cube restores the session without a page reload
  3. The app detects HTTP/HTTPS mismatch and shows a clear, actionable warning explaining the mixed-content constraint
  4. `InputPlugin`, `MappingStrategy`, `OutputPlugin`, and `FrameData` TypeScript interfaces exist in the codebase and each has a passing unit test verifying the contract
  5. First-launch setup wizard guides a new user from blank screen to confirmed connection, and does not reappear after completion
**Plans**: 9 plans

Plans:
- [ ] 01-01: Project scaffold — Vite + React 19 + TypeScript 5 + Tailwind CSS 4 + shadcn/ui init; Vercel config; directory structure for plugin architecture
- [ ] 01-02: Plugin interface contracts — `InputPlugin`, `MappingStrategy`, `OutputPlugin`, `FrameData` TypeScript definitions; `PluginRegistry` factory skeleton; unit tests for each contract
- [ ] 01-03: Zustand + Valtio store structure — `connectionStore`, `cubeStateStore`, `uiStore`; Valtio `ledStateProxy` for high-frequency data; no React Context for live data
- [ ] 01-04: Virtual cube mock — MSW v2 WebSocket handler simulating WLED JSON API (`/json/state`, `/json/info`, `/json/eff`, `/json/pal`) and `hs-1.6` observed behavior; used by all tests
- [ ] 01-05: WLED WebSocket singleton — `WLEDWebSocketService` with internal pub/sub fan-out, 4-client limit awareness, `{"lv":true}` exclusive stream guard, exponential backoff reconnect
- [ ] 01-06: Serialized REST client — `WLEDRestClient` with request queue preventing parallel calls; chunked LED write support (≤256 LEDs/request); `/json/info` firmware probe at startup
- [ ] 01-07: Connection health UI — real-time status indicator (connected/reconnecting/disconnected) wired to `WLEDWebSocketService`; HTTPS/HTTP mixed-content detection with user-facing warning
- [ ] 01-08: First-launch setup wizard — IP entry with validation (ping + `/json/info` check), confirmed connection display with live cube state, feature tour, skip option, `localStorage` completion flag
- [ ] 01-09: Deployment config — Vercel `vercel.json`; `vite.config.ts` with HTTPS proxy option for local dev; `DEP-01/02/03` verified end-to-end

### Phase 2: 3D Visualization & Pipeline Engine
**Goal**: The interactive 3D cube renders all 480 LEDs in correct positions, mirrors real-time state from the physical cube, and the PipelineEngine game loop proves the ref-based hot path with a working ManualPaintPlugin end-to-end
**Depends on**: Phase 1
**Requirements**: VIZ-01, VIZ-02, VIZ-03, VIZ-04, VIZ-05, VIZ-06, PLUG-04, PLUG-05, TEST-03, TEST-04
**Success Criteria** (what must be TRUE):
  1. The 3D cube displays all 480 LEDs in correct edge positions (12 edges × 20 LEDs), rotatable and zoomable with mouse and touch
  2. Changing a color on the physical cube updates the 3D visualization within one WebSocket frame — no React re-renders in the hot path
  3. The 3D view sustains 30fps+ without frame drops, verified by `renderer.info` monitoring with no GPU memory leaks
  4. The bloom/glow effect is visible on lit LEDs, giving visual fidelity to the infinity mirror aesthetic
  5. Swapping the active InputPlugin or OutputPlugin at runtime does not stop or restart the pipeline — the PipelineEngine continues its RAF loop
**Plans**: 8 plans

Plans:
- [ ] 02-01: R3F canvas setup — `@react-three/fiber` v9 canvas with `@react-three/drei` and `@react-three/postprocessing`; camera rig with orbit controls; `renderer.info` monitoring
- [ ] 02-02: 480-LED cube geometry — `InstancedMesh` with correct 3D positions for 12 edges × 20 LEDs using HC15-SE physical layout; `useMemo` for geometry/material creation
- [ ] 02-03: Real-time LED sync — `useFrame` reads from Valtio `ledStateProxy` directly; instance color buffer updated per frame; zero React state calls in the render loop
- [ ] 02-04: Orbit controls + touch — mouse drag to rotate, scroll to zoom, two-finger pinch on mobile; `OrbitControls` from drei configured for cube bounds
- [ ] 02-05: Bloom + infinity mirror glow — `@react-three/postprocessing` `Bloom` effect on LED instances; tuned threshold/intensity for pro-tool aesthetic
- [ ] 02-06: PipelineEngine — `useRef`-based RAF game loop; calls `activeInputPlugin.tick()` → `activeMappingStrategy.process()` → writes `ledStateProxy` → calls `activeOutputPlugin.send()`; configurable frame rate
- [ ] 02-07: Plugin swap at runtime — `PipelineEngine` accepts plugin refs swappable without loop restart; Zustand action triggers ref update only
- [ ] 02-08: Integration test for pipeline — Vitest test: virtual cube → `WLEDWebSocketOutput` → verify `ledStateProxy` updates; visual regression baseline for 3D cube

### Phase 3: WLED Control Panel & Presets
**Goal**: Users can fully control the cube's WLED features — toggling power, adjusting brightness, browsing and activating effects and palettes, tuning speed and intensity, managing colors — and save/load those configurations as named presets
**Depends on**: Phase 2
**Requirements**: CTRL-01, CTRL-02, CTRL-03, CTRL-04, CTRL-05, CTRL-06, CTRL-07, PRES-01, PRES-02, PRES-03, PRES-04, PRES-05, UI-03, UI-04, UI-06
**Success Criteria** (what must be TRUE):
  1. User can toggle the cube on/off and adjust brightness, speed, and intensity — changes reflect on the physical cube and in the 3D visualization within one WebSocket round-trip
  2. User can browse all 100+ WLED effects by name, activate one, and see it playing on both the physical cube and the 3D visualization
  3. User can browse WLED color palettes, apply one, and set up to 3 simultaneous colors via color pickers
  4. User can save the current cube state as a named preset, reload it with one tap, and the preset survives a browser refresh
  5. All controls are reachable on a 375px-wide phone screen with 44px+ touch targets; layout adapts between stacked (phone) and multi-panel (desktop)
**Plans**: 7 plans

Plans:
- [ ] 03-01: WLED state round-trip — `CTRL-07` wiring: Zustand `cubeStateStore` updates from WebSocket; outgoing changes batched and dispatched through the serialized REST client; never calling WLED directly from components
- [ ] 03-02: Power + brightness controls — on/off toggle, brightness slider; `CTRL-01/02` wired to Zustand → REST client
- [ ] 03-03: Effect browser — fetch `/json/eff`; scrollable searchable list; activate effect with one tap; live preview updates 3D visualization; `CTRL-03`
- [ ] 03-04: Palette browser — fetch `/json/pal`; scrollable list with color swatches; apply palette; `CTRL-04`
- [ ] 03-05: Speed, intensity, color controls — speed/intensity sliders; 3-slot color picker using `react-colorful`; `CTRL-05/06`
- [ ] 03-06: Preset system — save current state (colors, effect, palette, brightness, speed, intensity) as named preset; load with one tap; delete; `localStorage` persistence; up to 50 presets; `PRES-01–05`
- [ ] 03-07: Responsive layout — phone (375px, stacked panels, 44px touch targets) and desktop (1440px, multi-panel); `UI-03/04/06`

### Phase 4: Manual LED Painting
**Goal**: Users can paint individual LEDs and strokes directly on the 3D cube by clicking or dragging, with full color and brush controls, and painted state is transmitted to the physical cube in real time
**Depends on**: Phase 2
**Requirements**: PAINT-01, PAINT-02, PAINT-03, PAINT-04, PAINT-05, PAINT-06
**Success Criteria** (what must be TRUE):
  1. Clicking a single LED on the 3D cube sets that LED to the chosen color on both the visualization and the physical cube
  2. Dragging across the cube paints all LEDs under the pointer without frame drops
  3. Brush size selector controls whether paint applies to single LED, full edge, or face-adjacent edges
  4. Painted state is visible on the physical cube with perceived latency under 50ms from pointer release
  5. User can clear all LEDs to black or a chosen solid color in one action
**Plans**: 5 plans

Plans:
- [ ] 04-01: Raycasting paint targeting — Three.js raycaster against `InstancedMesh`; pointer-down and pointer-move events on the R3F canvas; identify LED index from instance ID
- [ ] 04-02: ManualPaintPlugin — implements `InputPlugin`; maintains a `Uint8Array[1440]` paint buffer; exposes `setPixel(index, r, g, b)` and `fill(r, g, b)`; produces `FrameData` each tick
- [ ] 04-03: Paint color + brush controls — color picker (reuse `react-colorful` from Phase 3), brush size selector (single/edge/face-adjacent), clear action; UI integrated into control panel
- [ ] 04-04: Real-time output — `ManualPaintPlugin` connected to `WLEDJSONOutput` (chunked JSON ≤256 LEDs/request, sequential); latency measurement; `PAINT-06` verified
- [ ] 04-05: Paint output architecture decision — latency test on real hardware: measure chunked JSON round-trip for full 480-LED frame; document whether JSON path meets <50ms target or if DDP proxy is required for v1

### Phase 5: Audio-Reactive Input
**Goal**: Users can select any audio input source including BlackHole virtual devices, and the cube responds to the audio spectrum in real time through a configurable mapping
**Depends on**: Phase 3
**Requirements**: AUD-01, AUD-02, AUD-03, AUD-04, AUD-05, AUD-06
**Success Criteria** (what must be TRUE):
  1. User can select from all available audio inputs (microphone, system audio, BlackHole virtual devices) via a dropdown enumerated by Web Audio API
  2. The cube reacts to audio in real time — louder or more dynamic audio produces visibly different LED output
  3. User can adjust audio sensitivity/gain and see the cube's reaction scale accordingly
  4. The AudioContext initializes only after a user gesture — no silent failure or suspended-state hang
  5. The audio plugin can be swapped in/out of the pipeline at runtime without restarting the RAF loop
**Plans**: 6 plans

Plans:
- [ ] 05-01: Audio device enumeration — `navigator.mediaDevices.enumerateDevices()` on user gesture; dropdown listing mic + system audio + BlackHole virtual devices; `AUD-01`
- [ ] 05-02: AudioContext initialization — create/resume only inside click/touch handler; `audioContext.state` monitoring with UI feedback; `AUD-05`
- [ ] 05-03: FFT analysis — `AnalyserNode` with configurable FFT size; extract frequency band data as `Float32Array`; `AUD-02`
- [ ] 05-04: AudioPlugin implementing InputPlugin — wraps AnalyserNode; `tick()` returns frequency `FrameData`; implements `start()`/`stop()` lifecycle; `AUD-06`
- [ ] 05-05: Audio-to-LED mapping — `AudioSpectrumMappingStrategy` implementing `MappingStrategy`; maps frequency bands to 480 LED colors/brightness; configurable band-to-edge assignment; `AUD-03`
- [ ] 05-06: Sensitivity controls — gain slider, threshold controls; `AUD-04` wired to `AudioPlugin` parameters; UI integrated into control panel

### Phase 6: MIDI Controller Mapping
**Goal**: Users can connect any MIDI controller, map its CC knobs and note-on events to cube parameters and presets, save those mappings, and get a clear message on unsupported browsers
**Depends on**: Phase 3
**Requirements**: MIDI-01, MIDI-02, MIDI-03, MIDI-04, MIDI-05, MIDI-06
**Success Criteria** (what must be TRUE):
  1. Connecting a MIDI device causes it to appear in the device list without a page reload
  2. User can enter MIDI learn mode, touch a knob or key on the controller, and it becomes mapped to a cube parameter (brightness, speed, intensity, or color hue)
  3. User can map a MIDI note-on event to activate a saved preset or switch effects
  4. MIDI mapping configuration survives a browser refresh when saved
  5. On Safari or iOS, the app shows a clear "MIDI not supported on this browser" message rather than silently failing
**Plans**: 6 plans

Plans:
- [ ] 06-01: WebMIDI.js integration — `webmidi` v3 init with feature detection; device enumeration; Chrome permission gate handling; `MIDI-01`
- [ ] 06-02: MIDIPlugin implementing InputPlugin — wraps WebMIDI.js event stream; `tick()` returns current CC/note state as `FrameData`; `start()`/`stop()` lifecycle; `MIDI-06`
- [ ] 06-03: CC-to-parameter mapping UI — MIDI learn mode (click a target, touch a knob to bind); map CC to brightness/speed/intensity/color hue; `MIDI-02`
- [ ] 06-04: Note-to-action mapping — map note-on to preset activation or effect switching; `MIDI-03`
- [ ] 06-05: Mapping persistence — save/load MIDI mapping configuration to `localStorage`; `MIDI-04`
- [ ] 06-06: Graceful degradation — `navigator.requestMIDIAccess` feature detection; clear user-facing message on Safari/iOS with browser recommendation; `MIDI-05`

### Phase 7: Video & Camera Input
**Goal**: Users can load a video or image file and map its pixels to the cube's 12 edges using either edge-sampling or face-extraction strategies, and can activate their webcam for motion-reactive LED output — all processing happening off the main thread
**Depends on**: Phase 3
**Requirements**: VID-01, VID-02, VID-03, VID-04, VID-05, VID-06, CAM-01, CAM-02, CAM-03, CAM-04, CAM-05, CAM-06
**Success Criteria** (what must be TRUE):
  1. User can load a video file or image URL and see the cube's LEDs update in real time based on that media's pixel content
  2. User can switch between edge-sampling and face-extraction mapping strategies at runtime and see the LED output change immediately
  3. User can activate their webcam and the cube reacts to motion — areas of detected movement produce light output
  4. Motion sensitivity threshold is adjustable and the cube's reaction scales accordingly
  5. Video and webcam processing does not block the main thread — no jank in the UI or 3D view during active video mapping
  6. Camera permission prompts are handled gracefully with clear UI guidance for grant and deny states
**Plans**: 8 plans

Plans:
- [ ] 07-01: Web Worker + OffscreenCanvas architecture — `VideoProcessorWorker.ts`; `transferable Uint8Array` message protocol design; main-thread plugin wrapper passes frames to worker via `postMessage`
- [ ] 07-02: VideoPlugin implementing InputPlugin — loads video file/URL into HTMLVideoElement; feeds frames to worker; returns `FrameData` from worker response; `VID-01`, `VID-05`, `VID-06`
- [ ] 07-03: EdgeSamplingStrategy — `MappingStrategy` that samples pixel colors at the 12 × 20 LED positions along the cube's geometric edges relative to video canvas dimensions; `VID-02`
- [ ] 07-04: FaceExtractionStrategy — `MappingStrategy` that maps video to each cube face then extracts edge-adjacent pixels; spatial coordinate transform for 3D cube faces; `VID-03`
- [ ] 07-05: Mapping strategy switcher — runtime swap between `EdgeSamplingStrategy` and `FaceExtractionStrategy` without pipeline restart; `VID-04`
- [ ] 07-06: CameraPlugin implementing InputPlugin — `getUserMedia` webcam capture; permission handling with UI prompts for grant/deny; `CAM-01`, `CAM-05`, `CAM-06`
- [ ] 07-07: Motion detection — frame differencing in Web Worker; threshold-based motion `FrameData` output; `CAM-02`, `CAM-03`
- [ ] 07-08: Motion sensitivity controls — threshold slider wired to `CameraPlugin` parameters; `CAM-04`

### Phase 8: UI Design Variations & Polish
**Goal**: The app ships with 5 distinct dark pro-tool Tailwind themes the user can switch between, keyboard navigation is complete, CI runs all tests without hardware, and the project is ready to deploy
**Depends on**: Phase 7
**Requirements**: UI-01, UI-02, UI-05, TEST-05
**Success Criteria** (what must be TRUE):
  1. User can switch between 5 visually distinct dark themes in settings — each has a different accent palette and feels like a different pro-tool aesthetic
  2. All interactive controls are reachable via keyboard navigation with visible focus states
  3. All automated tests (unit, integration, visual regression) pass in CI with no physical hardware required
**Plans**: 5 plans

Plans:
- [x] 08-01: Tailwind theme token system — 5 CSS variable sets (zinc/slate base + distinct accent palettes); shadcn/ui component theming; `UI-01`
- [x] 08-02: Theme switcher UI — settings panel theme picker; selected theme persisted to `localStorage`; `UI-02`
- [x] 08-03: Keyboard navigation + focus states — tab order audit for all control panel components; visible focus rings; `UI-05`
- [x] 08-04: CI test suite — Vitest + MSW virtual cube tests running in GitHub Actions without hardware; visual regression baselines committed; `TEST-05`
- [x] 08-05: Final responsive polish — cross-browser test (Chrome, Firefox, Safari) on desktop and phone; edge case layout fixes

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation & WLED Communication | 0/9 | Not started | - |
| 2. 3D Visualization & Pipeline Engine | 0/8 | Not started | - |
| 3. WLED Control Panel & Presets | 0/7 | Not started | - |
| 4. Manual LED Painting | 0/5 | Not started | - |
| 5. Audio-Reactive Input | 0/6 | Not started | - |
| 6. MIDI Controller Mapping | 0/6 | Not started | - |
| 7. Video & Camera Input | 0/8 | Not started | - |
| 8. UI Design Variations & Polish | 5/5 | Complete | 2026-04-09 |
