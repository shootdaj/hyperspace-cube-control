# HyperCube Control

## What This Is

A web-based creative control toolkit for the HyperCube 15-SE infinity mirror LED cube (480 addressable LEDs, 20 per edge, 12 edges). It communicates with the cube's WLED firmware via JSON API, WebSocket, and sACN/Art-Net protocols. It provides real-time 3D visualization, multiple input sources (manual painting, video mapping, MIDI, camera, audio), and a modular plugin architecture that makes every component swappable and extensible. Built with React + TypeScript + Vite + Three.js + Tailwind. Deployable to Vercel.

## Core Value

Real-time creative control of the HyperCube from any device — see what the cube sees in 3D, feed it visuals from any source, and make it dead simple to add new input sources and output protocols.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Real-time 3D cube visualization mirroring physical cube state via WebSocket
- [ ] Manual LED painting — draw directly on 3D cube, per-pixel control
- [ ] Video/image mapping with pluggable strategies (edge sampling + face-to-edge extraction)
- [ ] MIDI controller input via generic Web MIDI API (any controller)
- [ ] Camera/webcam motion-reactive input via getUserMedia
- [ ] Audio-reactive input (mic, system audio, BlackHole virtual devices) via Web Audio API
- [ ] Built-in WLED effects/palette browser and control
- [ ] Color picker, brightness/speed/intensity sliders
- [ ] Preset save/load system
- [ ] Modular plugin architecture — input sources, mapping strategies, output protocols all swappable
- [ ] First-launch setup wizard
- [ ] 5 distinct UI design variations (dark pro-tool aesthetic)
- [ ] Responsive — works on phone and desktop
- [ ] Deployable to Vercel

### Out of Scope

- Native mobile app — web-first, responsive handles phone use
- Multi-cube sync — single cube focus for v1
- Custom WLED firmware — works with stock WLED/Hyperspace firmware as-is
- Resolume/TouchDesigner integration — users can use those tools separately via Art-Net/sACN
- Timeline/sequencer — defer to v2
- Screen capture mode — defer to v2

## Context

- **Hardware:** HyperCube 15-SE by Hyperspace Lighting Company. 480 WS2812 LEDs along 12 edges of an infinity mirror cube. 15 inches. Powered by ESP32 running custom WLED fork (hs-1.6).
- **Communication:** WLED JSON API (`/json/state`, `/json/info`, `/json/eff`, `/json/pal`), WebSocket for real-time state, sACN/E1.31 for pixel streaming (2-3 universes), Art-Net (switchable in WLED settings), DDP.
- **LED Layout:** 480 LEDs across 2 tracks of 240 each. 20 LEDs per edge, 12 edges. HC15 needs ~3 DMX universes for full pixel control.
- **Existing control:** Hyperspace Lighting App (iOS/Android, WiFi, often unreliable), WLED web UI at device IP, physical button on control box.
- **WiFi:** 2.4GHz only. Device IP configurable in app settings.
- **Audio routing:** User uses BlackHole for virtual audio routing on macOS. App must support any Web Audio API source including virtual devices.
- **Design direction:** Dark pro-tool aesthetic (Ableton/Resolume-inspired). 5 distinct UI variations will be designed using ui-ux-pro-max and frontend-design skills.

## Constraints

- **Tech Stack**: React + TypeScript + Vite + Three.js + Tailwind CSS — chosen for component architecture matching modularity requirement, 3D rendering, and fast dev
- **Protocol**: Must work with WLED firmware as-is (no custom firmware required)
- **Network**: WiFi latency (~5-20ms) is the bottleneck, not app performance
- **Browser APIs**: Web MIDI, Web Audio, WebRTC/getUserMedia — all require HTTPS in production
- **Testing**: TDD + VDD throughout. Virtual cube mocking WLED API for all tests. Tests verify modular plugin contracts.
- **Deployment**: Vercel — must work as static site or with minimal serverless functions

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Web app over native | WiFi latency dominates; web works on all devices; no app store friction | -- Pending |
| React + TypeScript | Component architecture fits modular plugin system; strong typing for plugin contracts | -- Pending |
| Three.js for 3D | Industry standard for WebGL; handles 480-LED cube easily; good ecosystem | -- Pending |
| WLED JSON API as primary protocol | Cleanest interface; full feature control; WebSocket for real-time | -- Pending |
| Plugin architecture for inputs/outputs | User explicitly requires swappable, composable modules; testable in isolation | -- Pending |
| 5 UI design variations | User wants to pick from distinct options; uses frontend-design + ui-ux-pro-max skills | -- Pending |
| Webcam for camera (pluggable) | Start with built-in getUserMedia; architecture allows adding IP cameras later | -- Pending |
| Any Web Audio source | User uses BlackHole for audio routing; must support mic + system + virtual devices | -- Pending |

---
*Last updated: 2026-04-09 after initialization*
