# Feature Research

**Domain:** Web-based creative LED controller for addressable LEDs (WLED devices)
**Researched:** 2026-04-09
**Confidence:** MEDIUM-HIGH (competitor research via official docs + verified web sources; user behavior inferred from multiple sources)

---

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist. Missing these = product feels incomplete.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Color picker (wheel + RGB/HEX input) | Every LED app has this; WLED native UI, Hue, Nanoleaf all include it | LOW | Three color slots for primary/secondary/tertiary like WLED |
| Brightness slider | Universal. Present in every single LED controller surveyed | LOW | Maps to WLED `bri` state field |
| Effect browser with live preview | WLED ships 100+ effects; users expect to browse them. WLED+ app added previews as a user-requested feature | MEDIUM | Effect previews are the #1 differentiator of WLED+ over native WLED UI |
| Speed + Intensity sliders per effect | WLED 0.14+ dynamically shows only parameters relevant to the active effect; users expect contextual controls | LOW | Use WLED `/json/fxdata` to get per-effect param labels |
| Palette browser | WLED ships 70+ palettes. Users expect to browse/select | LOW | API: `/json/pal` |
| Preset save/load | Every competitor (WLED, LedFx, MadMapper, Hue, Nanoleaf) has this. Missing = users have no persistence | MEDIUM | WLED supports up to 250 presets via JSON API |
| Real-time feedback (no lag on control changes) | WiFi control feels broken if changes don't appear <200ms. This is the #1 frustration cited in WLED connectivity issues | HIGH | Use WebSocket for state push; batch slider updates with debounce |
| Connection status indicator | Users need to know if the cube is reachable. WLED WiFi intermittency is a known pain point | LOW | Poll `/json/info` or use WebSocket heartbeat |
| Device IP / config setup | Must configure cube IP at first use. Native WLED app uses mDNS discovery; web app needs manual entry fallback | LOW | First-launch wizard flow |
| Segment control | WLED segments are a core power-user feature. Users who've used WLED expect to run different effects on different LED zones | MEDIUM | Up to 10 segments; each has own effect, color, speed, intensity, reverse flag |
| On/off toggle | Fundamental. Present in every app surveyed | LOW | Maps to WLED `on` state field |

### Differentiators (Competitive Advantage)

Features that set the product apart. Not expected, but valued.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Real-time 3D cube visualization | No existing WLED controller offers a 3D model mirroring physical state. Users painting on a 3D cube is uniquely intuitive for a 3D object. ledcube-webgl (GitHub) proved the concept | HIGH | Three.js cube with 480 LED nodes; WebSocket drives state updates; mirror mode = visual feedback loop |
| Manual LED painting on 3D model | Direct per-pixel control on the 3D visualization. WLED has a 2D pixel art tool (`/pixart.htm`) but no 3D painting. MadMapper offers click-to-paint on 2D fixture layouts | HIGH | Raycasting against LED node geometry; maps painted color to WLED individual LED addresses via DDP |
| Audio-reactive input (mic + virtual audio) | LedFx is the de facto standard for audio-reactive WLED, but it requires local Python installation. A browser-native solution that works with BlackHole/virtual audio devices is a genuine gap | HIGH | Web Audio API; FFT analysis per frequency band; map bands to effect parameters. Requires HTTPS |
| MIDI controller mapping | LedFx added MIDI support in 2024 (Chrome only, not Safari). No WLED native app does this. Lets musicians use hardware they already own | HIGH | Web MIDI API; map CC values and note-on to brightness, color, preset recall, effect params |
| Webcam motion-reactive input | Nanoleaf Screen Mirror and Philips Hue Sync do screen capture; nobody does webcam-to-LED for WLED. Motion/color from camera drives LED state | HIGH | getUserMedia + canvas pixel sampling; requires HTTPS; motion delta maps to intensity |
| Video/image mapping to cube edges | Map a video frame's pixels onto the cube edge layout. MadMapper and Resolume do this for flat arrays; a 3D cube mapper is novel | HIGH | Sampling strategies: edge projection, face-to-edge extraction. DDP output for pixel streaming |
| Plugin architecture (swappable input sources) | Allows users to add custom input sources without modifying core. No existing WLED controller offers this | HIGH | TypeScript interface contracts for InputSource, MappingStrategy, OutputProtocol plugins |
| 5 distinct UI design variations | No LED controller offers aesthetic choice at launch. Dark pro-tool variants let the user pick their workflow style | MEDIUM | Tailwind theme tokens; each variant targets different user archetype (live performer, art installer, home user) |
| Protocol agnosticism (WLED API + DDP + sACN) | Most apps lock to one protocol. Offering DDP (lowest latency, fits 480 LEDs in 1-2 packets), sACN (2-3 universes), and JSON API gives users optimal path for each use case | MEDIUM | DDP: UDP port 4048, ~2ms WiFi hop. sACN: 3 universes for 480 LEDs. JSON: preset/effect control |
| First-launch setup wizard | WLED Native app does this for device discovery; no web controller has a guided setup for cube-specific configuration | LOW | Step through: network config → LED count verification → layout mapping → first preset |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem good but create problems.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Multi-cube sync | Users with multiple WLED devices want them synced | Adds protocol complexity (UDP sync groups, E1.31 multicast), multiplies UI surface area, dilutes v1 focus on getting the single-cube experience right | Design plugin architecture to support multi-output in v2; WLED's native UDP sync handles basic sync without app intervention |
| Timeline / sequence editor | xLights is the go-to for this and users know it | Building a timeline editor is a product in itself; xLights + Art-Net export is a better answer for sequencing use cases | Recommend xLights + Art-Net output for sequencing; v2 consideration once core validated |
| Screen capture / screen mirror | Nanoleaf and Hue do this; users ask for it | Browser `getDisplayMedia` requires user permission each session and doesn't work headlessly; adds complexity for a niche use case vs. video file input | Video file/URL mapping covers the media-reactive use case without screen capture friction; defer screen capture to v2 |
| Native mobile app | Users want phone control | PROJECT.md explicitly out of scope; web-first responsive covers phone use without app store friction | Responsive web UI designed for phone use |
| Cloud preset sync | "Save presets to the cloud" sounds useful | Adds backend infrastructure (auth, storage, API), breaks "deployable as static site" Vercel constraint, creates privacy concerns for custom home device IP configs | Export/import preset JSON files; satisfies round-trip without backend |
| Built-in firmware OTA updates | WLED native UI has this (`/update`) | Touching firmware from a third-party UI is high-risk and out of scope for a creative controller | Link to WLED's own `/update` page; makes firmware management WLED's responsibility |
| Plugin marketplace / sharing | Community-created plugins sound valuable | Requires CDN, security review, versioning infrastructure — a product unto itself | Ship well-documented plugin contracts; community can share plugins as npm packages or GitHub gists |
| Generative GLSL shader editor | MadMapper has this for power users | Extremely high learning curve; niche audience; MadMapper already covers this use case better | Expose WLED's custom palette editor and effect metadata; recommend MadMapper for GLSL users |

---

## Feature Dependencies

```
[Device Connection / IP Config]
    └──required by──> [All Features]

[WebSocket Connection]
    └──required by──> [Real-Time 3D Visualization]
    └──required by──> [Real-Time Feedback on Controls]
    └──required by──> [Live Effect/Palette Browser]

[3D Cube Visualization]
    └──enables──> [Manual LED Painting]
    └──enables──> [Video Mapping (3D projection view)]

[WLED JSON API + Effect/Palette/Segment fetch]
    └──required by──> [Effect Browser]
    └──required by──> [Palette Browser]
    └──required by──> [Segment Controls]
    └──required by──> [Preset Save/Load]

[DDP Output Protocol]
    └──required by──> [Manual LED Painting at full 480-pixel fidelity]
    └──required by──> [Video/Image Mapping to cube]
    └──required by──> [Audio-Reactive per-pixel control]
    └──required by──> [MIDI per-pixel mapping]
    └──enables──> [Real-time pixel streaming at <5ms vs JSON API's ~20ms]

[Plugin Architecture (InputSource interface)]
    └──required by──> [Audio Input as swappable plugin]
    └──required by──> [MIDI Input as swappable plugin]
    └──required by──> [Webcam Input as swappable plugin]
    └──required by──> [Video Mapping as swappable plugin]

[Web Audio API]
    └──required by──> [Audio-Reactive Input]
    └──note──> [Requires HTTPS in production; BlackHole virtual devices appear as standard audio inputs]

[Web MIDI API]
    └──required by──> [MIDI Controller Mapping]
    └──note──> [Requires HTTPS; Chrome/Edge support confirmed; Safari does NOT support Web MIDI API as of 2024]

[getUserMedia / WebRTC]
    └──required by──> [Webcam Motion-Reactive Input]
    └──note──> [Requires HTTPS; standard Web API]

[Preset System]
    └──enhanced by──> [MIDI preset recall mapping]
    └──enhanced by──> [Playlist/cycle through presets]

[Color Picker]
    └──required by──> [Manual LED Painting (per-pixel color)]
    └──required by──> [Segment color assignment]
```

### Dependency Notes

- **All features require Device Connection:** The app is useless without a live WLED connection. Connection status, error handling, and reconnection logic must be in Phase 1.
- **3D Visualization is a prerequisite for Manual Painting:** You paint on the 3D model; the model must exist and be accurate first.
- **DDP unlocks per-pixel streaming:** WLED's JSON API is too slow for per-pixel real-time updates (network + ESP32 processing). DDP is the right protocol for painting, video mapping, and audio-reactive use cases. 480 RGB pixels fit in 1-2 UDP packets (~2ms WiFi hop).
- **Plugin architecture must precede input source implementations:** If audio, MIDI, and webcam plugins are built before the plugin interface is stable, they will need to be refactored. Define the interface first, then implement plugins against it.
- **HTTPS is required for Audio, MIDI, and Camera:** All three browser APIs (Web Audio, Web MIDI, getUserMedia) require a secure context. Vercel deployment handles this automatically; local dev needs `vite --https` or localhost exception.
- **Safari incompatibility with Web MIDI:** Web MIDI API is not supported in Safari (verified via MDN 2024). Users on Safari cannot use MIDI input. This is a platform constraint, not a build decision — document and provide graceful fallback.

---

## MVP Definition

### Launch With (v1)

Minimum viable product — what's needed to validate the concept.

- [ ] **Device connection + connection status** — without this, nothing works
- [ ] **Real-time 3D cube visualization** — the core value prop; validates the 3D approach
- [ ] **Color picker + brightness/speed/intensity sliders** — baseline control, expected by every user
- [ ] **Effect browser with live preview** — most-used WLED feature after color; required to feel like a controller
- [ ] **Palette browser** — paired with effects; expected
- [ ] **Segment control** — power users need this; the cube has 12 edges that benefit from segmentation
- [ ] **Preset save/load** — without this, every session starts from scratch; retention killer
- [ ] **Manual LED painting on 3D model** — the primary differentiator; validates the 3D interaction model
- [ ] **DDP pixel streaming** — required for painting and real-time input sources at full fidelity
- [ ] **First-launch setup wizard** — reduces friction for initial cube IP configuration
- [ ] **Responsive layout (desktop + phone)** — PROJECT.md constraint

### Add After Validation (v1.x)

Features to add once core is working.

- [ ] **Audio-reactive input (mic + BlackHole)** — adds creative depth once baseline is working; validate core first
- [ ] **MIDI controller mapping** — niche but high-value for performer users; add when core UX is stable
- [ ] **Video/image mapping** — complex to do well; validate the 3D painting UX pattern first
- [ ] **Webcam motion-reactive input** — interesting but lowest priority input source for v1.x

### Future Consideration (v2+)

Features to defer until product-market fit is established.

- [ ] **Timeline/sequencer** — xLights covers this; only build if users explicitly need it inside this app
- [ ] **Screen capture input** — browser API friction; defer to v2
- [ ] **Multi-cube sync** — single-cube focus until architecture is proven
- [ ] **Plugin marketplace** — needs community, infrastructure, versioning

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Device connection + status | HIGH | LOW | P1 |
| Real-time 3D visualization | HIGH | HIGH | P1 |
| Color picker + basic sliders | HIGH | LOW | P1 |
| Effect browser with preview | HIGH | MEDIUM | P1 |
| Palette browser | MEDIUM | LOW | P1 |
| Segment control | HIGH (power users) | MEDIUM | P1 |
| Preset save/load | HIGH | MEDIUM | P1 |
| Manual LED painting (3D) | HIGH | HIGH | P1 |
| DDP pixel streaming output | HIGH | MEDIUM | P1 |
| First-launch wizard | MEDIUM | LOW | P1 |
| Responsive design | HIGH | MEDIUM | P1 |
| Audio-reactive input | HIGH (creative users) | HIGH | P2 |
| MIDI mapping | MEDIUM | HIGH | P2 |
| Video/image mapping | HIGH (creative users) | HIGH | P2 |
| Webcam reactive input | MEDIUM | HIGH | P2 |
| Playlist / preset cycling | MEDIUM | LOW | P2 |
| Timeline/sequencer | LOW | VERY HIGH | P3 |
| Screen capture input | LOW | MEDIUM | P3 |
| Multi-cube sync | LOW (v1) | HIGH | P3 |

**Priority key:**
- P1: Must have for launch
- P2: Should have, add when core is validated
- P3: Nice to have, v2+ consideration

---

## Competitor Feature Analysis

| Feature | WLED Native UI | Hyperspace App | LedFx | xLights | MadMapper | Nanoleaf | Our Approach |
|---------|---------------|----------------|-------|---------|-----------|----------|--------------|
| 3D visualization | No (2D live view only) | No | No | 3D layout editor (not real-time mirror) | 2D/3D fixture layout, not mirror | No | Real-time 3D mirror of physical cube state |
| LED painting | 2D pixel art tool (`/pixart.htm`) | No | No | No | Click-to-paint on 2D fixture map | No | 3D painting on cube model, per-pixel via DDP |
| Audio reactive | No (needs WLED Sound Reactive fork) | Yes (built-in) | Yes (core feature) | No (sequencer only) | Yes (beat detection) | Yes (Orchestrator) | Browser-native Web Audio, plugin architecture |
| MIDI input | No | No | Yes (Chrome-only, 2024) | No | Yes | No | Web MIDI API, any controller, plugin-based |
| Webcam input | No | No | No | No | Yes (live camera input) | No | getUserMedia plugin |
| Video mapping | No | No | No | No | Yes (core feature) | No | Edge sampling + face-to-edge extraction strategies |
| Preset system | Yes (250 presets) | Yes (patterns) | Yes | Yes (sequences) | Yes (scenes + cues) | Yes (scenes) | WLED API-backed presets; local JSON backup |
| Segment control | Yes (up to 10 segments) | No | No | Yes (models) | Yes (fixtures) | No | Full WLED segment API; zone-based creative control |
| Effect browser | Yes (100+ effects) | Yes (95 patterns) | Yes (audio effects) | Yes (150+ effects) | Yes (effects library) | Yes (scenes) | WLED effects + palette browser with live preview |
| Protocol support | JSON API, WebSocket, sACN, Art-Net, DDP | Custom WiFi API | DDP (default), E1.31, Art-Net | E1.31, Art-Net, DDP, DMX | Art-Net 4, sACN 3, DMX | Proprietary | WLED JSON API + WebSocket (control) + DDP (pixels) |
| Responsive / web | Yes (mobile-first web UI) | iOS/Android native | Browser-based (port 8888) | Desktop app | Desktop app | iOS/Android native | React web, responsive, Vercel-deployable |
| Connection reliability | Prone to WiFi drops (known issue) | Reported unreliable | Local network, stable | Local, stable | Local + cloud | Cloud-reliant | WebSocket reconnect logic; visual connection health |
| Plugin extensibility | Usermod API (C++) | No | Limited | No | No | No | TypeScript plugin contracts for input/mapping/output |

---

## Sources

- WLED official documentation: [https://kno.wled.ge/](https://kno.wled.ge/) — MEDIUM-HIGH confidence (official)
- WLED web UI subpages: [https://kno.wled.ge/features/subpages/](https://kno.wled.ge/features/subpages/) — HIGH confidence
- WLED segments: [https://kno.wled.ge/features/segments/](https://kno.wled.ge/features/segments/) — HIGH confidence
- WLED effect metadata: [https://kno.wled.ge/advanced/custom-features/](https://kno.wled.ge/advanced/custom-features/) — HIGH confidence
- WLED DDP protocol: [https://kno.wled.ge/advanced/ddp/](https://kno.wled.ge/advanced/ddp/) — HIGH confidence
- LedFx documentation: [https://docs.ledfx.app/en/latest/](https://docs.ledfx.app/en/latest/) — MEDIUM confidence (fetched 403, web search supplemented)
- LedFx MIDI support: [https://apatchworkboy.com/projects/2024/project-ledfx-via-midi/](https://apatchworkboy.com/projects/2024/project-ledfx-via-midi/) — MEDIUM confidence
- MadMapper features: [https://madmapper.com/madmapper/features](https://madmapper.com/madmapper/features) — HIGH confidence (fetched directly)
- Hyperspace Lighting App: [https://apps.apple.com/us/app/hyperspace-lighting/id1537198833](https://apps.apple.com/us/app/hyperspace-lighting/id1537198833) — MEDIUM confidence (web search)
- WLED Native Android by Moustachauve: [https://github.com/Moustachauve/WLED-Android](https://github.com/Moustachauve/WLED-Android) — HIGH confidence (GitHub README)
- Nanoleaf desktop app: [https://nanoleaf.me/en-US/integration/desktop-app/](https://nanoleaf.me/en-US/integration/desktop-app/) — MEDIUM confidence
- Philips Hue features 2024: [https://hueblog.com/2024/12/11/philips-hue-many-new-features-in-app-version-5-32/](https://hueblog.com/2024/12/11/philips-hue-many-new-features-in-app-version-5-32/) — MEDIUM confidence
- Resolume LED mapping: [https://projectileobjects.com/2020/02/10/led-pixel-mapping-with-madmapper-vdmx-and-resolume/](https://projectileobjects.com/2020/02/10/led-pixel-mapping-with-madmapper-vdmx-and-resolume/) — LOW confidence (2020 article)
- xLights official: [https://xlights.org/](https://xlights.org/) — HIGH confidence
- ledcube-webgl (3D visualization concept): [https://github.com/ultrafez/ledcube-webgl](https://github.com/ultrafez/ledcube-webgl) — MEDIUM confidence
- LedFx DDP performance: [https://docs.ledfx.app/en/latest/troubleshoot/network.html](https://docs.ledfx.app/en/latest/troubleshoot/network.html) — MEDIUM confidence
- Web MIDI API MDN: [https://developer.mozilla.org/en-US/docs/Web/API/MIDIAccess](https://developer.mozilla.org/en-US/docs/Web/API/MIDIAccess) — HIGH confidence
- WLED connectivity issues (real user pain): [https://github.com/wled/WLED/issues/3954](https://github.com/wled/WLED/issues/3954) — HIGH confidence (official issue tracker)

---
*Feature research for: Web-based creative LED controller (HyperCube 15-SE / WLED)*
*Researched: 2026-04-09*
