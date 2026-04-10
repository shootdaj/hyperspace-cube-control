# HyperCube Control — Progress

## Session: 2026-04-10

### Accomplished
- **3D Visualization Fixed**: Root cause was `vertexColors: true` on MeshBasicMaterial — SphereGeometry has no vertex colors, so instanceColor was multiplied by zero. Removed flag, increased sphere size to 0.025, boosted bloom intensity. Viz now shows glowing LEDs matching physical cube state.
- **sACN Bridge via Python**: macOS Local Network permission blocks Node.js UDP. Solved by spawning a Python subprocess (sacn-relay.py) that sends sACN packets — Python was already approved by macOS.
- **Paint Mode Fixed**: WLEDPaintOutput was sending RGB as flat integers in seg.i JSON — WLED treats integers as LED indices, not colors. Fixed to send hex strings ("ff0000"). Also fixed WLEDLiveSync overwriting paint buffer (added isPaintMode guard).
- **MIDI Controls Wired**: CC mappings (brightness, speed, intensity, hue) now send to physical cube via WLEDControlService REST. Drum pad triggers use direct REST for instant response.
- **XY Color Grid**: Live paint controller — drag finger across hue/brightness pad, cube changes color in real-time via throttled REST.
- **Device Discovery**: Subnet scanner in connection wizard — probes IPs 1-254 with 20-way concurrency, 800ms timeout. Shows found WLED devices as clickable cards.
- **Capacitor Android App**: Native wrapper with cleartext traffic enabled, CapacitorHttp for native fetch, network security config. APK released on GitHub.
- **Vercel Deployment**: Production build at hyperspace-cube-control.vercel.app. Works over HTTPS (mixed content not blocked for local network in user's browser).
- **Theme Cleanup**: Removed all themes except Neon Void. Removed scan-line texture that rendered as blue stripes in production. Switched body font to Inter (readable) with Orbitron for headings only.
- **REST Polling Guard**: WLEDStatePoller skips when sACN is active (ESP32 can't handle both). Also populates ledStateProxy with firmware effect color when sACN is NOT active.
- **Play/Pause Button**: Global toggle in header, pauses InputPipelineRunner tick loop while sACN keep-alive continues.
- **Paint Rainbow Drag**: Hue auto-cycles as user drags across 3D cube.

### Current State
- 620+ tests passing (78 test files)
- Dev server: http://localhost:5173 with embedded sACN bridge (Python relay)
- Vercel: https://hyperspace-cube-control.vercel.app
- Android APK: GitHub releases v2.0.0
- Physical cube control confirmed working: colors, effects, brightness, paint, MIDI

### Known Issues
- 3D viz shows firmware effect's primary color only (not animated) — no /json/live endpoint on hs-1.7
- Playwright can't test 3D InstancedMesh (software GL, triangles: 1)
- Node.js v24 can't reach LAN on this machine (libuv issue with macOS routing)

### Blockers
- None critical — app is functional end-to-end
