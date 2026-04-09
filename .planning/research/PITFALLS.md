# Pitfalls Research

**Domain:** Real-time LED controller web app (WLED/ESP32 + Three.js + Web APIs)
**Researched:** 2026-04-09
**Confidence:** MEDIUM-HIGH (most findings verified against official docs or multiple sources)

---

## Critical Pitfalls

### Pitfall 1: HTTPS/HTTP Mixed Content — Vercel App Cannot Reach Local WLED

**What goes wrong:**
The app is deployed to Vercel (HTTPS). WLED on the ESP32 only speaks plain HTTP and plain WebSocket (`ws://`). Browsers hard-block mixed active content: an HTTPS page cannot `fetch()` an HTTP endpoint or open a `ws://` socket. The entire app becomes non-functional out of the box.

**Why it happens:**
Developers build locally (where `http://localhost` is a permitted secure origin) and everything works. The moment they deploy to Vercel the security model changes and all WLED communication breaks. WLED cannot implement TLS — it lacks the memory and processing power on ESP32.

**How to avoid:**
Two viable strategies:

1. **Serve app over HTTP in production** — deploy to a custom domain configured for HTTP, or self-host (nginx). Vercel cannot serve HTTP-only.
2. **Reverse proxy via Vercel serverless function** — App calls `/api/wled?ip=192.168.x.x` Vercel edge/serverless function, which proxies to the local WLED device. This requires the device IP to be accessible from the internet (not viable for local LAN) — so this only works if the ESP32 is port-forwarded, which is a security risk.
3. **Best approach: serve the app from `http://localhost` during normal use.** Since the target user is a single person on a local LAN, the pragmatic answer is: Vercel deployment is for sharing/demo only; normal use runs the dev server locally (`vite dev` or a static server). The app should detect whether it's on HTTP or HTTPS and warn the user if mixed-content will block connections.

**Warning signs:**
- App works on `http://localhost:5173` but all WLED calls fail on `https://yourapp.vercel.app`
- Browser console shows: "Mixed Content: The page at 'https://...' was loaded over HTTPS, but attempted to connect to the insecure WebSocket endpoint 'ws://...'"

**Phase to address:**
Foundation/core phase. The connection module must handle this from day one. Document clearly in README and first-launch wizard.

---

### Pitfall 2: WLED WebSocket 4-Client Limit + Live Stream Exclusivity

**What goes wrong:**
WLED allows a maximum of 4 simultaneous WebSocket clients. On ESP8266 (and cautiously on ESP32), the recommendation is no more than 2. If a 5th client connects, WLED silently disconnects a different client. More critically: the live LED color stream (`{"lv":true}`) is exclusive — **only one client can receive it at a time**. A new subscriber kicks off the previous one.

**Why it happens:**
ESP32 memory constraints. WLED is firmware on a microcontroller, not a server. Developers building multi-window or multi-tab experiences don't anticipate this hardware ceiling.

**How to avoid:**
- Build a single WebSocket connection manager (singleton) that all app components share — never open more than one connection to WLED from the app
- One tab/window = one connection; document that multiple browser tabs will conflict
- For the live LED stream, only one "observer" at a time; route through a single shared stream in app state rather than each component requesting `{"lv":true}`
- Use React context or a Zustand store to centralize the WebSocket connection and fan out to subscribers internally

**Warning signs:**
- LED visualization randomly stops updating
- Another client (e.g., the official WLED web UI open in another tab) silently disconnects
- Sporadic "connection closed" errors with no apparent cause

**Phase to address:**
Core communication/WebSocket layer phase. Design the connection as a singleton with internal pub/sub from the start.

---

### Pitfall 3: sACN and Art-Net Are UDP — Browsers Cannot Send Raw UDP

**What goes wrong:**
sACN (E1.31) uses UDP port 5568. Art-Net uses UDP port 6454. Browsers have no raw UDP socket API. There is no WebSocket-to-UDP bridge in WLED itself. A developer who plans "pixel streaming via sACN from the browser" discovers this is architecturally impossible from a browser context without a separate proxy.

**Why it happens:**
The project description mentions sACN/Art-Net as WLED communication options. It's natural to assume "I can use any WLED protocol," but raw UDP is simply not a browser capability. The Web platform does not expose UDP sockets (WebTransport over HTTP/3 exists but requires server support; WLED does not support it).

**How to avoid:**
- For real-time pixel streaming (all 480 LEDs at once), use **DDP over TCP** (WLED listens on port 4048 — DDP is supported over both UDP and TCP). However, from a browser, even TCP raw sockets aren't available.
- **Practical answer:** Use the WLED JSON API over WebSocket for state control and effect control. For full pixel-level streaming from the browser, you need a local WebSocket-to-UDP/DDP proxy (a Node.js process running on the user's machine). This is a significant UX complexity.
- **Simpler approach for v1:** Design the app around WLED's JSON API for everything (effect selection, palettes, brightness, segment colors). Pixel-level painting via the JSON API's `i[]` individual LED array works over HTTP/WebSocket within the 24KB ESP32 buffer limit. Full per-frame pixel streaming at 60fps from a browser is not achievable without a local proxy — defer this.

**Warning signs:**
- Any code that tries to import a raw UDP library in the browser
- Planning that assumes DDP/sACN will work the same as the JSON API

**Phase to address:**
Architecture/protocol decision phase — must be settled before any pixel streaming feature is planned. The roadmap should not promise sACN/Art-Net from the browser without explicitly scoping a local proxy component.

---

### Pitfall 4: React Re-renders Killing 60fps Three.js Animation

**What goes wrong:**
Three.js animation runs in a `requestAnimationFrame` loop. If React state updates trigger re-renders of components that own or are ancestors of the Three.js canvas, the component tree re-mounts/re-renders during the RAF loop. This causes frame drops, jank, or complete animation restarts. In the worst case: calling `setState` inside `useFrame` (R3F) triggers a React render on every frame — effectively 60 re-renders per second.

**Why it happens:**
React's rendering model and Three.js's imperative mutation model are philosophically opposed. React wants to own all state; Three.js wants direct object mutation. Developers who "React-ify" Three.js objects by storing their properties in state create a performance disaster.

**How to avoid:**
- Use `useRef` for Three.js object references; mutate `ref.current.position.x` directly in `useFrame`, never `setState`
- The `renderer.info` object and Three.js object properties live entirely outside React state
- LED color state that updates at 30-60fps must **not** flow through React state — use a `Float32Array` or `Uint8Array` in a ref and write to it directly, then update the `InstancedMesh` attribute buffer
- Use `useMemo` for geometries and materials so they are never recreated on re-render
- Keep the Three.js canvas component isolated — its parent should not re-render due to unrelated app state changes (use Zustand selectors or React.memo aggressively)

**Warning signs:**
- `renderer.info.render.calls` climbs rather than staying stable
- Chrome Performance tab shows React "commit" work happening during every frame
- `why-did-you-render` reports the canvas component re-rendering on every LED state update

**Phase to address:**
3D visualization phase. The LED color update path (WebSocket → Three.js) must bypass React state from the start.

---

### Pitfall 5: Three.js Memory Leaks — GPU Resources Not Disposed

**What goes wrong:**
Three.js does not automatically garbage-collect GPU resources. Every `BufferGeometry`, `Material`, and `Texture` that is created allocates GPU memory. In a React SPA where components mount and unmount (e.g., switching between visualization modes, switching UI tabs), old Three.js objects linger in GPU memory forever. Over time: GPU memory exhaustion, crashes, or severe slowdown.

**Why it happens:**
JavaScript GC handles JS heap objects; GPU resources require explicit `.dispose()` calls. The Three.js renderer has no way to know when a geometry "should" be freed — that's the developer's responsibility.

**How to avoid:**
- Every geometry, material, and texture created must be disposed in the React cleanup function (`return () => { geometry.dispose(); material.dispose(); }`)
- For the 480-LED cube: use a single `InstancedMesh` with one geometry and one material — created once, updated by attribute buffers, never recreated
- Monitor `renderer.info.memory.geometries` and `renderer.info.memory.textures` — they should stay at a flat number
- Use R3F's built-in disposal hooks if using React Three Fiber

**Warning signs:**
- `renderer.info.memory.geometries` or `textures` count climbing during normal use
- Browser GPU memory usage growing over minutes
- Eventual slowdown or tab crash during extended sessions

**Phase to address:**
3D visualization phase. Test with `renderer.info` from the first working visualization to catch leaks early.

---

### Pitfall 6: WLED JSON API Sequential-Only Requests + Buffer Limit

**What goes wrong:**
Two critical WLED API constraints that developers routinely ignore:
1. **No parallel requests** — the WLED docs explicitly state "do not make several calls in parallel." Parallel requests corrupt state or are silently dropped.
2. **Buffer size limit** — the ESP32 JSON buffer is 24KB. For individual LED control via the `i[]` array, requests above this must be split into multiple sequential chunks (~256 LEDs per chunk max).

Additionally: you cannot turn on LEDs and set individual colors in the same request — brightness must be set in a prior request, or LEDs stay dark.

**Why it happens:**
The WLED ESP32 is a constrained embedded device. Developers used to REST APIs assume it behaves like a web service. It doesn't handle concurrent requests well and has hard memory limits.

**How to avoid:**
- Build an API queue that serializes all WLED requests — never fire two simultaneously
- For painting 480 LEDs: chunk into batches of ≤256 LEDs, send sequentially
- Always ensure brightness > 0 before attempting individual LED color sets
- Test with real hardware early — the emulator/mock may accept parallel requests while the real device silently drops them

**Warning signs:**
- Colors appearing wrong intermittently during rapid painting
- API calls succeeding (200 OK) but LED state not updating as expected
- Works in mock/emulator, fails on real hardware

**Phase to address:**
Communication layer phase. Queue must be built before any painting feature.

---

### Pitfall 7: AudioContext Suspended State — Audio Never Starts

**What goes wrong:**
`new AudioContext()` created outside a user gesture starts in `suspended` state. The audio-reactive features appear to work (no errors thrown) but produce no output — the analyser nodes return silence. Chromium attempts to auto-resume but Firefox and Safari do not. The app silently fails to produce audio data.

**Why it happens:**
Browser autoplay policy blocks audio context creation without user interaction. Developers create the `AudioContext` at module load or in `useEffect` on mount — both happen outside a user gesture. The context is created in `suspended` state. `analyser.getByteFrequencyData()` returns all zeros because the context is not running.

**How to avoid:**
- Create and/or resume `AudioContext` only in a click/touch event handler
- After creating: `if (audioContext.state === 'suspended') await audioContext.resume()`
- Design the audio plugin to initialize lazily on first user interaction, not on plugin registration
- Test in Firefox specifically — Chromium's auto-resume hides the bug

**Warning signs:**
- `audioContext.state === 'suspended'` logged in console
- Analyser `getByteFrequencyData` returns all zeros with no error
- Works in Chrome, silent in Firefox/Safari

**Phase to address:**
Audio-reactive input plugin phase. Add `audioContext.state` check as a required test case.

---

### Pitfall 8: Web MIDI API — Safari Dead Zone + iOS Completely Blocked

**What goes wrong:**
Web MIDI API has zero support in Safari on macOS and is blocked entirely on iOS/iPadOS (including Chrome on iOS, because Apple forces all iOS browsers to use WebKit). The project targets "responsive — works on phone and desktop" — any phone that's an iPhone will have no MIDI support regardless of browser choice.

Additionally: since Chrome 124, Web MIDI requires an explicit permission prompt. Users who dismiss it or have it blocked by permissions policy get no MIDI access with no useful error message.

**Why it happens:**
Apple has not implemented Web MIDI API and has actively resisted it. Chrome's permission hardening in 2024 adds a second gate that many tutorials don't mention.

**How to avoid:**
- Treat MIDI as a progressive enhancement, not a core feature — graceful degradation is mandatory
- Feature-detect: `if (!navigator.requestMIDIAccess) { show "MIDI not supported in this browser" }`
- Show clear error state when permission is denied vs. when API is absent
- For iOS users who want MIDI, document that a native MIDI bridge app (e.g., rtpMIDI) is an alternative path
- Do not build any workflow that requires MIDI to function — it must be optional

**Warning signs:**
- `navigator.requestMIDIAccess` is `undefined` in Safari
- `requestMIDIAccess()` silently rejects on iOS
- Permission prompt appears but user cannot find how to re-grant it (Chrome's permission UI is non-obvious)

**Phase to address:**
MIDI input plugin phase. Test on Safari before shipping — do not discover iOS limitation in QA.

---

### Pitfall 9: React Context for High-Frequency State = Re-render Storm

**What goes wrong:**
Putting rapidly-changing state (live LED colors, audio frequency data, MIDI CC values — updating at 30-60 Hz) into React Context causes every consumer component to re-render at that frequency. A complex pro-tool UI with 50+ components all connected to a single "live state" context becomes unusable — the browser is spending all its time in React reconciliation, leaving nothing for rendering or Three.js.

**Why it happens:**
React Context is designed for slow-changing state (theme, auth, user preferences). Every context value change triggers a re-render in all consumers, regardless of whether they use that specific piece of state. Developers reach for Context because it's built-in and familiar.

**How to avoid:**
- **Use Zustand** for all live state — it supports fine-grained subscriptions (components only re-render when their specific slice changes)
- Separate "slow" state (user preferences, presets, UI layout) which can use Context from "fast" state (LED colors, audio levels, MIDI values) which must use Zustand with selectors
- For the Three.js visualization: bypass React entirely — read live state in `useFrame` via a ref or Zustand's `getState()` (which does not subscribe)
- Use `React.memo` and `useCallback` at component boundaries that sit near the live-state consumers

**Warning signs:**
- React DevTools Profiler shows 60 commits/second
- Typing in an input field stutters because the app is re-rendering
- `why-did-you-render` shows the entire component tree re-rendering on LED updates

**Phase to address:**
State architecture phase (before any real-time features). Get Zustand in before any live data flows.

---

### Pitfall 10: WLED Firmware Version Differences (hs-1.6 fork vs upstream)

**What goes wrong:**
The HyperCube runs a custom WLED fork (`hs-1.6`). Some WLED API features were added in specific versions; some were changed (e.g., nightlight fade mode removed in 0.13.0, `/json/live` error behavior changed in later versions, WebSocket behavior changed after 0.14.1). The custom fork may be pinned to a specific upstream version or may have diverged. Code written against upstream WLED docs may behave differently against `hs-1.6`.

**Why it happens:**
WLED forks are common in the community. The `hs-1.6` fork is not documented in the upstream WLED project. Developers assume 1:1 API compatibility.

**How to avoid:**
- Probe the device's `/json/info` endpoint at startup — it returns firmware version, LED count, and capabilities
- Use the live device to validate API behavior before implementing features that depend on specific WLED versions
- Build an abstraction layer for WLED calls so firmware-specific differences can be patched in one place
- Do not rely on features added after the fork's base version without testing against real hardware

**Warning signs:**
- API calls return `{"error": 4}` (unknown endpoint)
- `/json/fxdata` not available (added in 0.14)
- Individual LED writes behave differently than documented

**Phase to address:**
Foundation phase. The virtual cube mock must be built against observed `hs-1.6` behavior, not assumed upstream docs.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Put LED state in React useState | Simplicity, works in demo | 60 re-renders/sec, unusable | Never for live data |
| Direct `fetch()` to WLED without queue | Simple, no abstraction needed | Parallel requests corrupt WLED state | Never |
| Open a new WebSocket per feature/plugin | Each plugin "owns" its connection | Hits 4-client limit immediately | Never |
| Mock WebGL in tests with empty stubs | Tests "pass" without real rendering | Geometry disposal and GPU bugs go undetected | Acceptable in unit tests for non-rendering logic |
| Skip `dispose()` on Three.js objects | Simpler lifecycle code | GPU memory leak, eventual crash | Never |
| AudioContext created at module load | No lazy-init complexity | Suspended state, silent audio failure | Never |
| Hardcode WLED IP in config | Simple dev setup | Users can't change IP; breaks on network change | Never (first-launch wizard required) |
| Use HTTPS for Vercel deployment without planning HTTP fallback | Easy Vercel deploy | App broken for LAN WLED communication | Acceptable only if app explicitly documents HTTP-only mode |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| WLED JSON API | Fire requests in parallel | Serialize through a request queue; one in-flight at a time |
| WLED JSON API | Set individual LEDs in same request as power-on | Send brightness=on first, then LED colors in a follow-up |
| WLED JSON API | Send full 480-LED array in one request | Chunk into ≤256 LEDs; split into sequential requests |
| WLED WebSocket | Open multiple connections from different components | Singleton connection manager; internal pub/sub |
| WLED WebSocket | Request `{"lv":true}` from multiple components | One shared live stream subscription; fan-out internally |
| Three.js + React | Store mesh rotation/color in React state | Use refs; mutate directly in `useFrame` |
| Three.js | Create new geometry per render | `useMemo` geometries and materials; reuse `InstancedMesh` |
| AudioContext | Create at component mount | Create/resume on first user gesture event |
| Web MIDI | Assume it works everywhere | Feature-detect; degrade gracefully; warn on Safari/iOS |
| sACN/Art-Net | Plan UDP pixel streaming from browser | Use JSON API for pixel control; accept UDP is not browser-accessible |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| React state for LED colors | 60 re-renders/sec, UI jank | Zustand + direct Three.js buffer writes | Immediately at first live data |
| Creating `new Vector3()` every frame | GC pressure, frame rate drops | Reuse pre-allocated objects in refs | ~10 seconds of animation |
| Unmounting/remounting Three.js canvas | Scene rebuilds, RAM spike | Toggle visibility instead of unmounting | Every tab/mode switch |
| Video pixel processing on CPU main thread | UI thread blocks, drops frames | Use `OffscreenCanvas` or `requestVideoFrameCallback` + canvas 2D | When video source is active |
| `renderer.info` not monitored | Memory leaks go unnoticed | Log `renderer.info.memory` in dev mode | After ~10 minutes of use |
| No debounce on WLED API calls from paint brush | Floods WLED request queue | Throttle to max 20 updates/sec | With any drag painting gesture |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Exposing WLED device on port-forward for remote access | Direct internet exposure of unauthenticated HTTP device | Document: local LAN use only; warn in UI if IP appears non-local |
| Storing WiFi credentials or WLED AP password in browser localStorage | Credential exposure | Never store sensitive credentials; store only device IP |
| Using `eval()` or dynamic `import()` for plugin loading from user input | XSS / code injection | Plugins are static modules bundled at build time; no dynamic eval |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| No connection state indicator | User doesn't know if cube is live or disconnected | Persistent connection status in header; auto-reconnect with visual feedback |
| MIDI permission prompt appears with no context | User dismisses it, MIDI never works again | Explain what MIDI is and why permission is needed before triggering prompt |
| AudioContext blocked silently | Audio-reactive mode appears to work but LEDs don't respond | Show explicit "click to activate audio" button; check `audioContext.state` |
| Complex pro-tool UI crammed into mobile viewport | Controls are unusable, overlapping | Design a separate mobile layout: minimal, touch-friendly, primary controls only |
| First-launch setup requires knowing device IP | New users confused, give up | First-launch wizard with IP discovery attempt + manual fallback |
| Brightness 0 causing silent LED write failures | User sets color, nothing happens | Validate brightness > 0 before any LED write; show warning |
| Rapid slider movement floods WLED API queue | Cube lags 5-10 seconds behind UI | Throttle slider callbacks to 100ms minimum; show queue depth indicator |

---

## "Looks Done But Isn't" Checklist

- [ ] **WebSocket connection:** Appears connected but live LED stream exclusive lock has been claimed by another tab — verify only one `{"lv":true}` subscriber exists at a time
- [ ] **Audio-reactive:** Analyser returns data in Chrome dev but shows all zeros in Firefox — verify `audioContext.state === 'running'` before processing
- [ ] **MIDI input:** Works in Chrome, silently broken in Safari — verify feature-detection and graceful fallback are in place
- [ ] **LED painting:** Colors appear in mock/emulator but not on physical cube — verify request queue serialization and chunk sizes against real hardware
- [ ] **Disposal:** Three.js memory counters look fine in a single session — verify they stay flat after switching visualization modes 10+ times
- [ ] **Reconnect:** WebSocket reconnects after sleep/wake — verify exponential backoff reconnect fires on `close` event, not just `error`
- [ ] **HTTPS mode:** App works locally on `http://localhost` — verify behavior and user warning when deployed to HTTPS with HTTP WLED device
- [ ] **Mobile layout:** Responsive CSS renders fine in desktop emulation — verify on actual iOS Safari with touch interactions

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Mixed content HTTPS/HTTP blocking | MEDIUM | Add HTTP-mode detection + user warning + document local-use workflow |
| React re-render storm from live state in Context | HIGH | Migrate to Zustand; refactor all live-state consumers to use selectors |
| Three.js memory leak discovered late | MEDIUM | Add disposal to all component cleanup functions; monitor with `renderer.info` |
| Multiple WebSocket connections hitting 4-client limit | MEDIUM | Refactor to singleton connection manager with internal event bus |
| WLED API corrupted from parallel requests | LOW | Add request queue wrapper around all WLED calls |
| AudioContext suspended after page load | LOW | Add `audioContext.resume()` call behind user gesture; add state check |
| sACN/Art-Net UDP requirement discovered mid-build | HIGH | Pivot pixel streaming to JSON API chunked writes; defer full pixel streaming to v2 with local proxy |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| HTTPS/HTTP mixed content | Foundation / Connection setup | Deploy to Vercel; attempt connection to local WLED; observe correct warning shown |
| WLED 4-client WebSocket limit | Core WebSocket layer | Open 2 browser tabs simultaneously; verify only one connection created per origin |
| sACN/Art-Net UDP impossible in browser | Architecture / Protocol decisions | Architecture doc explicitly states sACN is out of scope for browser; no UDP code exists |
| React re-renders killing 60fps | State architecture | React DevTools Profiler shows <5 commits/sec during live LED updates |
| Three.js memory leaks | 3D visualization phase | `renderer.info.memory.geometries` stays flat after 50 mode switches |
| WLED sequential-only API + buffer limits | Communication layer | Integration test: paint 480 LEDs via chunked sequential writes on real hardware |
| AudioContext suspended | Audio plugin phase | Test passes: audio analyser returns non-zero data in Firefox after user gesture |
| Web MIDI Safari/iOS dead zone | MIDI plugin phase | Tested on Safari: graceful "not supported" message shown, no errors thrown |
| React Context for high-frequency state | State architecture | `why-did-you-render` shows zero context-triggered re-renders during LED stream |
| WLED firmware version differences (hs-1.6) | Foundation / Virtual cube mock | Mock built from observed API behavior; `/json/info` probed at startup |

---

## Sources

- [WLED WebSocket Documentation](https://kno.wled.ge/interfaces/websocket/) — 4-client limit, live stream exclusivity
- [WLED JSON API Documentation](https://kno.wled.ge/interfaces/json-api/) — buffer limits, parallel request warning, LED write gotchas
- [WLED DDP Protocol](https://kno.wled.ge/interfaces/ddp/) — UDP-only, port 4048
- [WLED WebSocket Issue #3855](https://github.com/Aircoookie/WLED/issues/3855) — WebSocket breakage after 0.14.1
- [React Three Fiber Performance Pitfalls](https://r3f.docs.pmnd.rs/advanced/pitfalls) — official R3F docs on setState in loops, object creation
- [MDN: Web MIDI API](https://developer.mozilla.org/en-US/docs/Web/API/Web_MIDI_API) — browser support table
- [Chrome Web MIDI Permission Prompt](https://developer.chrome.com/blog/web-midi-permission-prompt) — 2024 permission gate
- [Can I Use: Web MIDI](https://caniuse.com/midi) — Safari = unsupported, iOS = blocked
- [MDN: AudioContext](https://developer.mozilla.org/en-US/docs/Web/API/AudioContext) — suspended state, user gesture requirement
- [MDN: Web Audio Best Practices](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Best_practices) — autoplay policy
- [WebAudio Autoplay Issue #1551](https://github.com/WebAudio/web-audio-api/issues/1551) — cross-browser state differences
- [Three.js Tips and Tricks — Discover Three.js](https://discoverthreejs.com/tips-and-tricks/) — disposal, performance
- [React Context Performance Pitfalls — Steve Kinney](https://stevekinney.com/courses/react-performance/context-api-performance-pitfalls) — re-render storm
- [WLED CORS Issue #99](https://github.com/Aircoookie/WLED/issues/99) — historical CORS problems
- [PWA + ESP32 Communication Discussion](https://github.com/espressif/arduino-esp32/discussions/7912) — mixed content workaround
- [WLED Security Documentation](https://kno.wled.ge/advanced/security/) — HTTP-only, no TLS on ESP32
- [Three.js WebGL Memory Management](https://discourse.threejs.org/t/webgl-memory-management-puzzlers/24583) — disposal patterns
- [Robust WebSocket Reconnection](https://dev.to/hexshift/robust-websocket-reconnection-strategies-in-javascript-with-exponential-backoff-40n1) — exponential backoff

---
*Pitfalls research for: HyperCube Control — real-time LED controller web app*
*Researched: 2026-04-09*
