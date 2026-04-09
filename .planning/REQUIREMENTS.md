# Requirements: HyperCube Control

**Defined:** 2026-04-09
**Core Value:** Real-time creative control of the HyperCube from any device — see what the cube sees in 3D, feed it visuals from any source, with a modular plugin architecture.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Connection & Communication

- [ ] **CONN-01**: App discovers or accepts manual entry of HyperCube IP address
- [ ] **CONN-02**: App connects to WLED via WebSocket singleton (shared across all components)
- [ ] **CONN-03**: App displays real-time connection health indicator (connected/reconnecting/disconnected)
- [ ] **CONN-04**: App auto-reconnects on WebSocket disconnect with exponential backoff
- [ ] **CONN-05**: App serializes WLED API requests to avoid overloading ESP32 (request queue)
- [ ] **CONN-06**: App detects HTTP/HTTPS mismatch and warns user with clear instructions
- [ ] **CONN-07**: App reads cube state (on/off, brightness, current effect, palette, colors) via JSON API

### 3D Visualization

- [ ] **VIZ-01**: App renders interactive 3D cube model with 480 LEDs positioned on 12 edges (20 per edge)
- [ ] **VIZ-02**: 3D cube mirrors real-time LED state from the physical cube via WebSocket
- [ ] **VIZ-03**: User can rotate, zoom, and pan the 3D cube with mouse/touch
- [ ] **VIZ-04**: 3D visualization updates at 30fps+ without frame drops
- [ ] **VIZ-05**: LED colors in 3D view match physical cube output with visual accuracy
- [ ] **VIZ-06**: 3D cube renders infinity mirror glow/bloom effect for visual fidelity

### Plugin Architecture

- [ ] **PLUG-01**: InputPlugin interface defined — any input source implements `start()`, `stop()`, `getFrame(): Uint8Array`
- [ ] **PLUG-02**: MappingStrategy interface defined — transforms input data to 480-LED color array
- [ ] **PLUG-03**: OutputPlugin interface defined — sends LED data to cube via any protocol
- [ ] **PLUG-04**: PipelineEngine orchestrates input → mapping → output at configurable frame rate
- [ ] **PLUG-05**: Plugins can be swapped at runtime without restarting the pipeline
- [ ] **PLUG-06**: Each plugin is independently testable with mocked pipeline context
- [ ] **PLUG-07**: Plugin registry allows dynamic registration and enumeration of available plugins

### Manual LED Painting

- [ ] **PAINT-01**: User can click/tap individual LEDs on the 3D cube to set their color
- [ ] **PAINT-02**: User can paint across multiple LEDs by dragging on the 3D cube
- [ ] **PAINT-03**: User can select paint color from color picker
- [ ] **PAINT-04**: User can select brush size (single LED, edge, face-adjacent edges)
- [ ] **PAINT-05**: User can clear all LEDs to black or a solid color
- [ ] **PAINT-06**: Painted LED state is sent to cube in real-time (<50ms perceived latency)

### WLED Effects & Control

- [ ] **CTRL-01**: User can toggle cube on/off
- [ ] **CTRL-02**: User can adjust brightness with a slider
- [ ] **CTRL-03**: User can browse and activate any of the 100+ WLED effects
- [ ] **CTRL-04**: User can browse and apply WLED color palettes
- [ ] **CTRL-05**: User can adjust effect speed and intensity with sliders
- [ ] **CTRL-06**: User can set up to 3 simultaneous colors via color pickers
- [ ] **CTRL-07**: 3D visualization reflects effect/palette changes in real-time

### Presets

- [ ] **PRES-01**: User can save current cube state (colors, effect, palette, brightness, speed, intensity) as a named preset
- [ ] **PRES-02**: User can load a saved preset with one tap
- [ ] **PRES-03**: User can delete saved presets
- [ ] **PRES-04**: Presets persist across browser sessions (localStorage)
- [ ] **PRES-05**: User can have up to 50 saved presets

### Audio-Reactive Input

- [ ] **AUD-01**: User can select any audio input source (mic, system audio, BlackHole virtual devices)
- [ ] **AUD-02**: App performs real-time FFT audio analysis via Web Audio API
- [ ] **AUD-03**: Audio spectrum data maps to LED colors/brightness via configurable mapping
- [ ] **AUD-04**: User can adjust audio sensitivity/gain
- [ ] **AUD-05**: App handles AudioContext suspended state (requires user gesture to initialize)
- [ ] **AUD-06**: Audio input works as a swappable InputPlugin in the pipeline

### MIDI Controller Input

- [ ] **MIDI-01**: App detects connected MIDI devices via Web MIDI API
- [ ] **MIDI-02**: User can map MIDI CC knobs/sliders to brightness, speed, intensity, color hue
- [ ] **MIDI-03**: User can map MIDI note-on events to preset activation or effect switching
- [ ] **MIDI-04**: MIDI mapping configuration is saveable and loadable
- [ ] **MIDI-05**: App gracefully degrades on browsers without Web MIDI support (Safari/iOS) with clear message
- [ ] **MIDI-06**: MIDI input works as a swappable InputPlugin in the pipeline

### Video & Image Mapping

- [ ] **VID-01**: User can load a video file or image and map it onto the cube
- [ ] **VID-02**: Edge sampling mapping strategy — samples pixel colors along the 12 edge positions
- [ ] **VID-03**: Face-to-edge extraction mapping strategy — maps face content then extracts edge pixels
- [ ] **VID-04**: User can switch between mapping strategies at runtime
- [ ] **VID-05**: Video processing runs in Web Worker to avoid blocking main thread
- [ ] **VID-06**: Video input works as a swappable InputPlugin in the pipeline

### Camera / Motion-Reactive Input

- [ ] **CAM-01**: User can activate webcam feed via getUserMedia
- [ ] **CAM-02**: App detects motion from webcam via frame differencing
- [ ] **CAM-03**: Motion data maps to LED colors/brightness (movement = light)
- [ ] **CAM-04**: User can adjust motion sensitivity threshold
- [ ] **CAM-05**: Camera permissions handled gracefully with clear UI prompts
- [ ] **CAM-06**: Camera input works as a swappable InputPlugin in the pipeline

### Setup Wizard

- [ ] **SETUP-01**: First-launch wizard guides user through connecting to their HyperCube
- [ ] **SETUP-02**: Wizard prompts for cube IP address with validation (ping/API check)
- [ ] **SETUP-03**: Wizard confirms successful connection with live cube state display
- [ ] **SETUP-04**: Wizard offers brief tour of main features
- [ ] **SETUP-05**: User can skip wizard and go straight to settings
- [ ] **SETUP-06**: Wizard state persists (doesn't show again after completion)

### UI Design & Responsiveness

- [ ] **UI-01**: 5 distinct dark pro-tool UI theme variations available
- [ ] **UI-02**: User can switch between themes in settings
- [ ] **UI-03**: All controls accessible on mobile (375px+) and desktop (1440px+)
- [ ] **UI-04**: Touch targets minimum 44x44px on mobile
- [ ] **UI-05**: Keyboard navigation and focus states for accessibility
- [ ] **UI-06**: Responsive layout adapts between phone (stacked panels) and desktop (multi-panel)

### Deployment

- [ ] **DEP-01**: App builds as static site deployable to Vercel
- [ ] **DEP-02**: App works on localhost for local development (Vite dev server)
- [ ] **DEP-03**: Environment-appropriate warnings for HTTPS/HTTP mixed content

### Testing & Quality

- [ ] **TEST-01**: Virtual cube mock that simulates WLED API responses for all tests
- [ ] **TEST-02**: Unit tests for each plugin interface contract
- [ ] **TEST-03**: Integration tests for pipeline (input → mapping → output)
- [ ] **TEST-04**: Visual regression tests for 3D cube rendering
- [ ] **TEST-05**: All tests pass in CI without physical hardware

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Multi-Cube

- **MULTI-01**: User can control multiple cubes simultaneously
- **MULTI-02**: User can sync effects across cubes

### Timeline & Sequencer

- **SEQ-01**: User can program light shows over time
- **SEQ-02**: User can sequence preset transitions

### Advanced Protocols

- **PROTO-01**: sACN/E1.31 output via local proxy for pixel streaming
- **PROTO-02**: DDP output via local proxy for lower-latency pixel streaming
- **PROTO-03**: Screen capture mode (mirror screen content to cube)

### Social

- **SOC-01**: Shareable URL so guests can control the cube (party mode)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Native mobile app | Web app with responsive design handles phone use |
| Custom WLED firmware | Must work with stock WLED/Hyperspace firmware as-is |
| Resolume/TouchDesigner integration | Users can use those tools directly via Art-Net/sACN |
| Multi-cube sync | Single cube focus for v1; architecture supports future expansion |
| sACN/Art-Net direct from browser | UDP impossible in browsers — deferred to v2 with proxy |
| DDP pixel streaming | Requires proxy component — deferred to v2 |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| CONN-01 | Phase 1 | Pending |
| CONN-02 | Phase 1 | Pending |
| CONN-03 | Phase 1 | Pending |
| CONN-04 | Phase 1 | Pending |
| CONN-05 | Phase 1 | Pending |
| CONN-06 | Phase 1 | Pending |
| CONN-07 | Phase 1 | Pending |
| PLUG-01 | Phase 1 | Pending |
| PLUG-02 | Phase 1 | Pending |
| PLUG-03 | Phase 1 | Pending |
| PLUG-06 | Phase 1 | Pending |
| PLUG-07 | Phase 1 | Pending |
| DEP-01 | Phase 1 | Pending |
| DEP-02 | Phase 1 | Pending |
| DEP-03 | Phase 1 | Pending |
| SETUP-01 | Phase 1 | Pending |
| SETUP-02 | Phase 1 | Pending |
| SETUP-03 | Phase 1 | Pending |
| SETUP-04 | Phase 1 | Pending |
| SETUP-05 | Phase 1 | Pending |
| SETUP-06 | Phase 1 | Pending |
| TEST-01 | Phase 1 | Pending |
| TEST-02 | Phase 1 | Pending |
| VIZ-01 | Phase 2 | Pending |
| VIZ-02 | Phase 2 | Pending |
| VIZ-03 | Phase 2 | Pending |
| VIZ-04 | Phase 2 | Pending |
| VIZ-05 | Phase 2 | Pending |
| VIZ-06 | Phase 2 | Pending |
| PLUG-04 | Phase 2 | Pending |
| PLUG-05 | Phase 2 | Pending |
| TEST-03 | Phase 2 | Pending |
| TEST-04 | Phase 2 | Pending |
| CTRL-01 | Phase 3 | Pending |
| CTRL-02 | Phase 3 | Pending |
| CTRL-03 | Phase 3 | Pending |
| CTRL-04 | Phase 3 | Pending |
| CTRL-05 | Phase 3 | Pending |
| CTRL-06 | Phase 3 | Pending |
| CTRL-07 | Phase 3 | Pending |
| PRES-01 | Phase 3 | Pending |
| PRES-02 | Phase 3 | Pending |
| PRES-03 | Phase 3 | Pending |
| PRES-04 | Phase 3 | Pending |
| PRES-05 | Phase 3 | Pending |
| UI-03 | Phase 3 | Pending |
| UI-04 | Phase 3 | Pending |
| UI-06 | Phase 3 | Pending |
| PAINT-01 | Phase 4 | Pending |
| PAINT-02 | Phase 4 | Pending |
| PAINT-03 | Phase 4 | Pending |
| PAINT-04 | Phase 4 | Pending |
| PAINT-05 | Phase 4 | Pending |
| PAINT-06 | Phase 4 | Pending |
| AUD-01 | Phase 5 | Pending |
| AUD-02 | Phase 5 | Pending |
| AUD-03 | Phase 5 | Pending |
| AUD-04 | Phase 5 | Pending |
| AUD-05 | Phase 5 | Pending |
| AUD-06 | Phase 5 | Pending |
| MIDI-01 | Phase 6 | Pending |
| MIDI-02 | Phase 6 | Pending |
| MIDI-03 | Phase 6 | Pending |
| MIDI-04 | Phase 6 | Pending |
| MIDI-05 | Phase 6 | Pending |
| MIDI-06 | Phase 6 | Pending |
| VID-01 | Phase 7 | Pending |
| VID-02 | Phase 7 | Pending |
| VID-03 | Phase 7 | Pending |
| VID-04 | Phase 7 | Pending |
| VID-05 | Phase 7 | Pending |
| VID-06 | Phase 7 | Pending |
| CAM-01 | Phase 7 | Pending |
| CAM-02 | Phase 7 | Pending |
| CAM-03 | Phase 7 | Pending |
| CAM-04 | Phase 7 | Pending |
| CAM-05 | Phase 7 | Pending |
| CAM-06 | Phase 7 | Pending |
| UI-01 | Phase 8 | Pending |
| UI-02 | Phase 8 | Pending |
| UI-05 | Phase 8 | Pending |
| TEST-05 | Phase 8 | Pending |

**Coverage:**
- v1 requirements: 82 total
- Mapped to phases: 82
- Unmapped: 0

---
*Requirements defined: 2026-04-09*
*Last updated: 2026-04-09 after roadmap creation — all 82 requirements mapped to 8 phases*
