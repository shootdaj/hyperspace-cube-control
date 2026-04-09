# Phase 1: Foundation & WLED Communication - Research

**Researched:** 2026-04-09
**Domain:** WLED WebSocket/REST API, React 19 + Vite + Tailwind v4 + shadcn/ui scaffold, plugin interface contracts, MSW v2 WebSocket mocking, Zustand + Valtio state architecture, WebSocket reconnection
**Confidence:** HIGH (core stack + WLED API verified via official docs; MSW API verified via official docs)

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| CONN-01 | App discovers or accepts manual entry of HyperCube IP address | Setup wizard pattern; IP stored in Zustand `connectionStore`; `/json/info` probe validates IP |
| CONN-02 | App connects to WLED via WebSocket singleton (shared across all components) | `WLEDWebSocketService` singleton with internal pub/sub; `ws://[IP]/ws` endpoint |
| CONN-03 | App displays real-time connection health indicator (connected/reconnecting/disconnected) | WebSocket `readyState` + custom enum; wired to Zustand `connectionStore.status` |
| CONN-04 | App auto-reconnects on WebSocket disconnect with exponential backoff | Exponential backoff with jitter pattern; listen on `onclose` not `onerror`; cap at 30s |
| CONN-05 | App serializes WLED API requests to avoid overloading ESP32 | `WLEDRestClient` with async queue; sequential Promise chain; never parallel fetches |
| CONN-06 | App detects HTTP/HTTPS mismatch and warns user with clear instructions | `window.isSecureContext` check; detect when IP is `ws://` but origin is HTTPS |
| CONN-07 | App reads cube state via JSON API | `/json/state`, `/json/info`, `/json/eff`, `/json/pal` — documented endpoints |
| PLUG-01 | `InputPlugin` interface defined | TypeScript interface with `id`, `name`, `initialize()`, `tick()`, `destroy()` |
| PLUG-02 | `MappingStrategy` interface defined | TypeScript interface with `id`, `map(frame, ledCount): Uint8Array` |
| PLUG-03 | `OutputPlugin` interface defined | TypeScript interface with `id`, `send(leds, brightness)`, `destroy()` |
| PLUG-06 | Each plugin independently testable with mocked pipeline context | Vitest + MSW virtual cube; `MockPluginContext` fixture in `test/mocks/` |
| PLUG-07 | Plugin registry allows dynamic registration and enumeration | `PluginRegistry` factory with `Map<string, PluginFactory>`; `register()` + `create()` + `list()` |
| DEP-01 | App builds as static site deployable to Vercel | `vercel.json` with SPA rewrite; `vite build` output is `/dist` |
| DEP-02 | App works on localhost for local development | `npm run dev` via Vite dev server; no special config needed |
| DEP-03 | Environment-appropriate warnings for HTTPS/HTTP mixed content | `window.isSecureContext` detection at connection time; warning component in UI |
| SETUP-01 | First-launch wizard guides user through connecting | Multi-step React wizard component; controlled by `wizardStore` |
| SETUP-02 | Wizard prompts for IP with validation | Fetch `/json/info` to validate; show device name + LED count on success |
| SETUP-03 | Wizard confirms successful connection with live cube state | Display parsed `/json/state` (brightness, effect name, on/off) after successful connection |
| SETUP-04 | Wizard offers brief tour of main features | Step-based wizard; feature highlights with shadcn/ui `Dialog` or multi-step component |
| SETUP-05 | User can skip wizard | "Skip" button present at each step; clears wizard and stores completion flag |
| SETUP-06 | Wizard state persists (doesn't show again after completion) | `localStorage` key `wizardCompleted=true`; check on app mount |
| TEST-01 | Virtual cube mock simulating WLED API | MSW v2 `setupServer` with `ws.link('ws://*/ws')` handler + HTTP handlers for `/json/*` |
| TEST-02 | Unit tests for each plugin interface contract | Vitest tests in `src/core/pipeline/__tests__/`; verify `InputPlugin`, `MappingStrategy`, `OutputPlugin` shapes |
</phase_requirements>

---

## Summary

Phase 1 establishes the foundational layer the entire project depends on. The three load-bearing concerns are: (1) a robust WLED communication layer with a WebSocket singleton, serialized REST client, and exponential-backoff reconnection; (2) TypeScript interface contracts for the plugin architecture that every subsequent phase implements against; and (3) a development infrastructure (scaffold, stores, MSW virtual cube mock) that makes all future testing possible without physical hardware.

The WLED API is well-documented and officially specifies WebSocket at `ws://[IP]/ws`, live LED stream via `{"lv":true}` (exclusive — only one subscriber at a time), and REST at `/json/state`, `/json/info`, `/json/eff`, `/json/pal`. The ESP32 hard cap is 24KB per request and sequential-only (no parallel calls). The `/json/live` response returns `{"leds":["FF0000","00FF00",...],"n":1}` — hex strings per LED. This is what the virtual cube mock must reproduce.

The React 19 + Vite 6 + Tailwind v4 + shadcn/ui scaffold has a well-established setup path as of 2025: `@tailwindcss/vite` plugin (not PostCSS), CSS-first config (`@import "tailwindcss"` in index.css), and `npx shadcn@latest init` supports React 19 natively. Zustand 5 handles UI/config state; Valtio 2 handles the high-frequency LED data plane. The state architecture split is critical: React components must never subscribe to 60fps-updating LED state.

**Primary recommendation:** Build in plan order — scaffold → plugin contracts → stores → virtual cube mock → WebSocket service → REST client → health UI → setup wizard → Vercel config. Each plan depends on the previous. The plugin interfaces in plan 01-02 are the most consequential to get right — all eight subsequent phases build on them.

---

## Standard Stack

### Core (locked decisions from PROJECT.md and STACK.md)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | 19.x | UI component tree | Locked decision; pairs with R3F v9 |
| TypeScript | 5.x | Type safety for plugin contracts | Locked decision; critical for interface definitions |
| Vite | 6.x | Build tooling + HMR | Locked decision; native ESM, fastest DX |
| Tailwind CSS | 4.x | Utility-first styling | Locked decision; CSS-first config (no tailwind.config.js) |
| shadcn/ui | latest | Headless component primitives | Components copied into repo; Tailwind v4 + React 19 compatible |
| Zustand | 5.0.x | UI/config/connection state | Low overhead, no Provider, per-slice selectors |
| Valtio | 2.3.x | High-frequency LED data proxy | Direct mutation pattern for 60fps data; zero re-render overhead for non-subscribers |

### Communication (no libraries — native APIs only)

| Approach | Version | Purpose | Why |
|---------|---------|---------|-----|
| Native `WebSocket` | Browser built-in | WLED real-time communication at `/ws` | No library needed; WLED WS is plain JSON; library would add 0 value over thin wrapper class |
| Native `fetch` | Browser built-in | WLED JSON REST API (`/json/state`, `/json/info`, etc.) | REST calls are infrequent; native fetch is sufficient |

### Testing

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Vitest | 3.x | Test runner | Native Vite integration; Jest-compatible API; no transpilation overhead |
| @testing-library/react | 16.x | React component testing | Tests behavior not implementation; standard for React |
| @testing-library/jest-dom | 6.x | DOM matchers | `toBeInTheDocument()`, `toHaveTextContent()`, etc. |
| msw | 2.x | WebSocket + HTTP mocking | First-class WebSocket support in v2; `ws.link()` + `setupServer` for Vitest |

### Installation

```bash
# 1. Create Vite project
npm create vite@latest hyperspace-cube-control -- --template react-ts

# 2. Add Tailwind v4 (CSS-first, no tailwind.config.js)
npm install tailwindcss @tailwindcss/vite

# 3. Add state management
npm install zustand valtio

# 4. Add testing
npm install -D vitest @testing-library/react @testing-library/jest-dom msw @types/node

# 5. Init shadcn/ui (copies components into repo)
npx shadcn@latest init

# 6. Add initial shadcn components needed for Phase 1
npx shadcn@latest add button input label dialog card badge
```

---

## Architecture Patterns

### Recommended Project Structure

```
src/
├── core/
│   ├── pipeline/
│   │   ├── types.ts             # InputPlugin, MappingStrategy, OutputPlugin, FrameData interfaces
│   │   └── PluginRegistry.ts    # factory Map, register(), create(), list()
│   ├── store/
│   │   ├── connectionStore.ts   # Zustand: IP, connection status, reconnect state
│   │   ├── cubeStateStore.ts    # Zustand: on/off, brightness, effect, palette, colors
│   │   ├── uiStore.ts           # Zustand: active plugin ID, wizard state, panel state
│   │   └── ledStateProxy.ts     # Valtio: 480×3 Uint8Array live LED colors (NOT Zustand)
│   └── wled/
│       ├── WLEDWebSocketService.ts  # singleton, pub/sub, reconnect, {"lv":true} guard
│       ├── WLEDRestClient.ts        # serialized queue, chunked LED writes
│       └── types.ts                 # WLEDState, WLEDInfo, WLEDEffect, WLEDPalette TypeScript types
├── plugins/
│   ├── inputs/                  # (empty in Phase 1 — interfaces only)
│   ├── outputs/                 # (empty in Phase 1 — interfaces only)
│   └── mapping/                 # (empty in Phase 1 — interfaces only)
├── setup/
│   └── SetupWizard.tsx          # multi-step wizard; IP entry + validation + tour + localStorage flag
├── ui/
│   ├── ConnectionStatus.tsx     # connected/reconnecting/disconnected indicator
│   └── MixedContentWarning.tsx  # shown when isSecureContext=true but WLED is HTTP
├── App.tsx
├── main.tsx
└── index.css                    # @import "tailwindcss";
test/
├── integration/                 # WLEDWebSocketService tests with virtual cube
│   └── wled-connection.test.ts
├── scenarios/                   # full workflow tests (wizard flow, connection lifecycle)
│   └── setup-wizard.test.ts
└── mocks/
    ├── virtualCube.ts           # MSW handlers for /ws, /json/state, /json/info, /json/eff, /json/pal
    └── mockPlugins.ts           # stub InputPlugin, MappingStrategy, OutputPlugin for tests
```

### Pattern 1: WLEDWebSocketService Singleton

**What:** A class (not a hook) that holds the single `WebSocket` instance. Implements internal pub/sub so many app components can subscribe to state updates without each opening a connection.

**When to use:** All WLED real-time communication. Never instantiate `new WebSocket()` outside this class.

**Key behavior:**
- Constructor is private; access via `WLEDWebSocketService.getInstance()`
- Tracks `{"lv":true}` exclusive lock — only calls `{"lv":true}` once; subsequent requests for live stream subscribe to the existing stream internally
- Reconnects on `close` event (NOT only on `error`) with exponential backoff + jitter
- On connect: sends `{"v":true}` to request full state immediately

```typescript
// src/core/wled/WLEDWebSocketService.ts
type WLEDMessage = Record<string, unknown>;
type Subscriber = (msg: WLEDMessage) => void;

export class WLEDWebSocketService {
  private static instance: WLEDWebSocketService | null = null;
  private ws: WebSocket | null = null;
  private subscribers = new Set<Subscriber>();
  private liveStreamActive = false;
  private reconnectAttempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly BASE_DELAY_MS = 500;
  private readonly MAX_DELAY_MS = 30_000;

  private constructor() {}

  static getInstance(): WLEDWebSocketService {
    if (!WLEDWebSocketService.instance) {
      WLEDWebSocketService.instance = new WLEDWebSocketService();
    }
    return WLEDWebSocketService.instance;
  }

  connect(ip: string): void {
    if (this.ws?.readyState === WebSocket.OPEN) return;
    this.ws = new WebSocket(`ws://${ip}/ws`);
    this.ws.onopen = () => {
      this.reconnectAttempt = 0;
      this.ws!.send(JSON.stringify({ v: true })); // request full state
      connectionStore.getState().setStatus('connected');
    };
    this.ws.onmessage = (e) => {
      const msg = JSON.parse(e.data) as WLEDMessage;
      this.subscribers.forEach(fn => fn(msg));
    };
    this.ws.onclose = () => {
      connectionStore.getState().setStatus('reconnecting');
      this.scheduleReconnect(ip);
    };
  }

  private scheduleReconnect(ip: string): void {
    const delay = Math.min(
      this.BASE_DELAY_MS * Math.pow(2, this.reconnectAttempt) + Math.random() * 1000,
      this.MAX_DELAY_MS
    );
    this.reconnectAttempt++;
    this.reconnectTimer = setTimeout(() => this.connect(ip), delay);
  }

  requestLiveStream(): void {
    if (!this.liveStreamActive && this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ lv: true }));
      this.liveStreamActive = true;
    }
  }

  subscribe(fn: Subscriber): () => void {
    this.subscribers.add(fn);
    return () => this.subscribers.delete(fn);
  }

  send(payload: WLEDMessage): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(payload));
    }
  }

  disconnect(): void {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.ws?.close();
    this.ws = null;
    this.liveStreamActive = false;
  }
}
```

### Pattern 2: Serialized REST Client with Queue

**What:** Wraps all `fetch` calls to WLED in a Promise queue that processes one request at a time. WLED firmware explicitly prohibits parallel requests.

**When to use:** Every WLED REST call. No exceptions.

```typescript
// src/core/wled/WLEDRestClient.ts
export class WLEDRestClient {
  private queue: (() => Promise<void>)[] = [];
  private processing = false;

  constructor(private readonly ip: string) {}

  private async process(): Promise<void> {
    if (this.processing || this.queue.length === 0) return;
    this.processing = true;
    const task = this.queue.shift()!;
    try { await task(); } finally {
      this.processing = false;
      this.process();
    }
  }

  private enqueue<T>(task: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try { resolve(await task()); } catch (e) { reject(e); }
      });
      this.process();
    });
  }

  setState(partial: Record<string, unknown>): Promise<void> {
    return this.enqueue(() =>
      fetch(`http://${this.ip}/json/state`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(partial),
      }).then(r => { if (!r.ok) throw new Error(`WLED error ${r.status}`); })
    );
  }

  getInfo(): Promise<WLEDInfo> {
    return this.enqueue(() =>
      fetch(`http://${this.ip}/json/info`).then(r => r.json())
    );
  }

  getEffects(): Promise<string[]> {
    return this.enqueue(() =>
      fetch(`http://${this.ip}/json/eff`).then(r => r.json())
    );
  }

  getPalettes(): Promise<string[]> {
    return this.enqueue(() =>
      fetch(`http://${this.ip}/json/pal`).then(r => r.json())
    );
  }
}
```

### Pattern 3: Zustand Store for Connection State

**What:** Zustand 5 with TypeScript double-paren syntax. Separate stores for different concerns — connection, cube config, UI state.

**When to use:** Any state that React components display. Never for 60fps LED data.

```typescript
// src/core/store/connectionStore.ts
import { create } from 'zustand';

type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'reconnecting';

interface ConnectionStore {
  ip: string;
  status: ConnectionStatus;
  setIp: (ip: string) => void;
  setStatus: (status: ConnectionStatus) => void;
}

export const connectionStore = create<ConnectionStore>()((set) => ({
  ip: '',
  status: 'disconnected',
  setIp: (ip) => set({ ip }),
  setStatus: (status) => set({ status }),
}));

// Usage in component (selector prevents unnecessary re-renders):
// const status = connectionStore(s => s.status);
```

### Pattern 4: Valtio Proxy for High-Frequency LED Data

**What:** 480×3 byte array for live LED colors held in a Valtio proxy. Pipeline writes directly; Three.js reads from it via `useFrame`. React components that need to display LED data use `useSnapshot()`.

**When to use:** Any data updating faster than ~10Hz. LED colors, audio spectrum, MIDI values in later phases.

```typescript
// src/core/store/ledStateProxy.ts
import { proxy } from 'valtio';

export const ledStateProxy = proxy({
  colors: new Uint8Array(480 * 3), // 480 LEDs × RGB
  lastUpdated: 0,
});

// To write (from WS handler, pipeline, etc. — no React state involved):
// ledStateProxy.colors.set(newColorBuffer);
// ledStateProxy.lastUpdated = performance.now();

// To read in React component (only re-renders on actual changes):
// const { lastUpdated } = useSnapshot(ledStateProxy);

// To read in Three.js useFrame (no subscription, zero re-renders):
// useFrame(() => { mesh.current?.instanceColor?.array.set(ledStateProxy.colors); })
```

### Pattern 5: Plugin Interface Contracts

**What:** Three TypeScript interfaces that define the plugin protocol. Every input plugin, mapping strategy, and output plugin in all future phases implements exactly these.

**When to use:** Defined once in Phase 1. Never change the interface shape without updating all implementations.

```typescript
// src/core/pipeline/types.ts

export interface FrameData {
  type: 'direct' | 'video' | 'audio' | 'midi';
  leds?: Uint8Array;           // 'direct': 480×3 RGB bytes
  canvas?: OffscreenCanvas;    // 'video': caller owns canvas
  spectrum?: Float32Array;     // 'audio': FFT frequency bins
  midiCC?: Map<number, number>; // 'midi': CC number → value (0-127)
}

export interface PluginContext {
  ledCount: number;          // 480 for HyperCube 15-SE
  frameRate: number;         // target fps
  cubeStore: typeof import('../store/cubeStateStore').cubeStateStore;
}

export interface InputPlugin {
  readonly id: string;
  readonly name: string;
  initialize(context: PluginContext): Promise<void>;
  tick(deltaMs: number): FrameData | null;
  destroy(): void;
}

export interface MappingStrategy {
  readonly id: string;
  map(frame: FrameData, ledCount: number): Uint8Array; // returns 480×3 RGB
}

export interface OutputPlugin {
  readonly id: string;
  send(leds: Uint8Array, brightness: number): void;
  destroy(): void;
}

export type PluginFactory<T> = () => T;
```

### Pattern 6: PluginRegistry Factory

**What:** A `Map`-based factory that maps plugin IDs to factory functions. Lets the pipeline create plugin instances by ID without importing concrete classes.

```typescript
// src/core/pipeline/PluginRegistry.ts
import type { InputPlugin, MappingStrategy, OutputPlugin, PluginFactory } from './types';

export class PluginRegistry {
  private inputs = new Map<string, PluginFactory<InputPlugin>>();
  private mappings = new Map<string, PluginFactory<MappingStrategy>>();
  private outputs = new Map<string, PluginFactory<OutputPlugin>>();

  registerInput(id: string, factory: PluginFactory<InputPlugin>): void {
    this.inputs.set(id, factory);
  }
  registerMapping(id: string, factory: PluginFactory<MappingStrategy>): void {
    this.mappings.set(id, factory);
  }
  registerOutput(id: string, factory: PluginFactory<OutputPlugin>): void {
    this.outputs.set(id, factory);
  }

  createInput(id: string): InputPlugin {
    const factory = this.inputs.get(id);
    if (!factory) throw new Error(`Unknown input plugin: ${id}`);
    return factory();
  }

  listInputs(): string[] { return Array.from(this.inputs.keys()); }
  listMappings(): string[] { return Array.from(this.mappings.keys()); }
  listOutputs(): string[] { return Array.from(this.outputs.keys()); }
}

export const pluginRegistry = new PluginRegistry();
```

### Pattern 7: MSW v2 Virtual Cube Mock

**What:** MSW v2 `setupServer` with both WebSocket handlers (for `/ws`) and HTTP handlers (for `/json/*` endpoints). The WebSocket handler broadcasts simulated state on connection.

**When to use:** All tests. Never test against a real device.

```typescript
// test/mocks/virtualCube.ts
import { ws } from 'msw';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';

const wledWs = ws.link('ws://*/ws');

const MOCK_INFO = {
  ver: 'hs-1.6',
  vid: 2406290,
  leds: { count: 480, pwr: 0, fps: 0, maxpwr: 850, maxseg: 32 },
  name: 'HyperCube',
  udpport: 21324,
  live: false,
  fxcount: 118,
  palcount: 71,
  wifi: { bssid: '', rssi: -60, signal: 80, channel: 6 },
};

const MOCK_STATE = {
  on: true,
  bri: 128,
  transition: 7,
  ps: -1,
  pl: -1,
  nl: { on: false, dur: 60, fade: true, tbri: 0 },
  udpn: { send: false, recv: false },
  seg: [{ id: 0, start: 0, stop: 480, len: 480, col: [[255, 160, 0, 0]], fx: 0, sx: 128, ix: 128, pal: 0, on: true, bri: 255 }],
};

export const virtualCubeHandlers = [
  wledWs.addEventListener('connection', ({ client }) => {
    // Send initial state on connect (WLED does this automatically)
    client.send(JSON.stringify({ state: MOCK_STATE, info: MOCK_INFO }));

    client.addEventListener('message', (event) => {
      const msg = JSON.parse(event.data as string);
      // Handle {"v": true} — resend state
      if (msg.v) {
        client.send(JSON.stringify({ state: MOCK_STATE, info: MOCK_INFO }));
      }
      // Handle {"lv": true} — start sending LED colors
      if (msg.lv) {
        const mockLeds = Array.from({ length: 480 }, () => 'FF8800');
        client.send(JSON.stringify({ leds: mockLeds, n: 1 }));
      }
    });
  }),

  http.get('http://*/json/info', () => HttpResponse.json(MOCK_INFO)),
  http.get('http://*/json/state', () => HttpResponse.json(MOCK_STATE)),
  http.post('http://*/json/state', () => HttpResponse.json({ success: true })),
  http.get('http://*/json/eff', () => HttpResponse.json(['Solid', 'Blink', 'Breathe', 'Wipe'])),
  http.get('http://*/json/pal', () => HttpResponse.json(['Default', 'Random Cycle', 'Primary Color'])),
];

export const server = setupServer(...virtualCubeHandlers);
```

### Pattern 8: HTTPS/HTTP Mixed Content Detection

**What:** Check `window.isSecureContext` and compare against the target WLED device URL. Show a persistent warning if mixed content will block the connection.

```typescript
// src/core/wled/detectMixedContent.ts
export function detectMixedContent(deviceIp: string): boolean {
  // Mixed content occurs when page is served over HTTPS but device is HTTP
  return window.isSecureContext && deviceIp.length > 0;
  // Note: localhost and 127.0.0.1 are secure contexts even on http://
  // But ws:// connections from https:// pages are always blocked
}

// Component:
// if (detectMixedContent(ip)) show <MixedContentWarning />;
```

### Anti-Patterns to Avoid

- **Multiple WebSocket connections:** Never call `new WebSocket()` outside `WLEDWebSocketService`. Multiple connections hit the 4-client limit.
- **Parallel fetch calls:** Never call `fetch('/json/state')` directly from components. All calls go through `WLEDRestClient` queue.
- **React state for LED colors:** Never `setState({ leds: ... })` — use `ledStateProxy` from Valtio. 60 re-renders/sec = unusable UI.
- **Listening for reconnect on `onerror` only:** WLED closes silently; the `onclose` event fires but `onerror` may not. Always reconnect on `onclose`.
- **Creating `new WebSocket()` before user sets IP:** Service must only connect after IP is confirmed valid via `/json/info` probe.
- **Hardcoded IP:** Never. IP must come from `connectionStore`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Component primitives (buttons, inputs, dialogs) | Custom styled components | shadcn/ui | Radix primitives handle accessibility, focus, keyboard nav; copying into repo gives full control |
| Test runner with Vite | Configure Jest manually | Vitest | Native Vite integration; no transpilation; Jest-compatible API |
| WebSocket mock in tests | `ws://` test server + manual message routing | MSW v2 `ws.link()` | Intercepts at network level; no server process; first-class WHATWG WebSocket standard support |
| CSS variable theming system | Custom CSS-in-JS | Tailwind v4 + CSS variables in `@layer base` | shadcn/ui components already wired to CSS vars; consistent theming in Phase 8 |
| Request serialization utilities | Custom mutex/semaphore | Simple async queue (10 lines) | The problem is so domain-specific that a tiny hand-rolled queue is cleaner than a generic library |

**Key insight:** For WLED communication, no third-party library (wled-js, wled-client) has sufficient community traction. The WLED API is simple enough (4 REST endpoints + 1 WebSocket) that a typed wrapper is 200 lines of stable code.

---

## Common Pitfalls

### Pitfall 1: WLED 4-Client WebSocket Limit + `{"lv":true}` Exclusivity

**What goes wrong:** If any component opens a second WebSocket connection, a random existing client gets kicked. If two code paths call `{"lv":true}`, the live LED stream switches exclusively to the newest subscriber — the visualization stops updating.

**Why it happens:** Developers add WebSocket calls inside React hooks without checking for an existing connection.

**How to avoid:** `WLEDWebSocketService` is a singleton accessed via `getInstance()`. The `requestLiveStream()` method tracks whether `{"lv":true}` has been sent and prevents duplicates. Internal pub/sub distributes the stream to all app subscribers without opening new connections.

**Warning signs:** LED visualization stops updating after a few seconds; another tab opening WLED UI breaks the app.

### Pitfall 2: HTTPS/Mixed Content Blocking All WLED Communication

**What goes wrong:** App deployed to Vercel (HTTPS) cannot connect to WLED (HTTP/WS) — browser hard-blocks mixed active content.

**Why it happens:** Works perfectly on `http://localhost:5173` during development; breaks on `https://yourapp.vercel.app`.

**How to avoid:** Detect with `window.isSecureContext` at connect time. Show `<MixedContentWarning>` component explaining the user must either: (a) use the app from `http://localhost` (normal case), or (b) access Vercel deployment only for demo/sharing without live cube control. Document this prominently in setup wizard.

**Warning signs:** Console shows "Mixed Content: The page at 'https://...' was loaded over HTTPS, but attempted to connect to the insecure WebSocket endpoint 'ws://...'"

### Pitfall 3: Reconnecting on `onerror` Instead of `onclose`

**What goes wrong:** WLED can close the WebSocket silently (clean close) without triggering `onerror`. If the reconnect logic only watches `onerror`, the app never recovers from a clean disconnect (network switch, device sleep/wake).

**How to avoid:** Always attach reconnect logic to `onclose`. Both `onerror` and `onclose` trigger on unclean close; only `onclose` triggers on clean close.

### Pitfall 4: Parallel WLED REST Calls

**What goes wrong:** Two `fetch` calls to `/json/state` fire concurrently. ESP32 receives them simultaneously, drops one or corrupts state. 200 OK is returned but LED state doesn't match what was sent.

**Why it happens:** Multiple UI components each calling WLED directly, or async effects firing without coordination.

**How to avoid:** Every WLED REST call goes through `WLEDRestClient.enqueue()`. No exceptions. This is enforced by never exporting a raw `fetch` helper for WLED calls.

**Warning signs:** Color/effect changes work intermittently on real hardware but always work in tests (mock accepts parallel requests).

### Pitfall 5: WLED ESP32 Buffer Limit (24KB)

**What goes wrong:** Attempting to set all 480 LED colors in a single JSON POST exceeds the 24KB ESP32 buffer. The device silently drops the request.

**How to avoid:** In `WLEDRestClient`, chunk individual LED writes to ≤256 LEDs per request. Send as sequential calls through the queue. This is relevant starting in Phase 4 (painting) — but the chunking must be designed into the client in Phase 1.

### Pitfall 6: `{"lv":true}` vs `/json/live` — Recent Behavior Change

**What goes wrong:** In some WLED builds, `/json/live` (HTTP polling) is disabled when WebSockets are enabled. The only reliable live LED stream path from a browser is `{"lv":true}` over the WebSocket connection.

**How to avoid:** Always use `{"lv":true}` via WebSocket, not HTTP `/json/live`. This is the correct pattern for real-time use.

**Source:** WLED changelog notes `/json/live` is only enabled when WebSockets are disabled in recent builds.

### Pitfall 7: hs-1.6 Firmware — API Divergence from Upstream

**What goes wrong:** The HyperCube runs a custom WLED fork (`hs-1.6`). Features added after the fork's base version may not exist. The virtual cube mock must reflect observed `hs-1.6` behavior, not assumed upstream docs.

**How to avoid:** Probe `/json/info` at startup — it returns `ver` field. Build the mock using observed behavior (the `MOCK_INFO` above uses `"ver": "hs-1.6"`). Log a warning if the connected device reports an unexpected version. Use the abstraction in `WLEDRestClient` to patch version-specific differences in one place.

### Pitfall 8: Zustand Store Accessed Before React Mounts

**What goes wrong:** `WLEDWebSocketService` needs to call `connectionStore.getState().setStatus(...)`. If the store is imported and used before React tree mounts, it still works (Zustand stores are module-level singletons), but the `useStore` hook can't be called outside React — always use `.getState()` for non-component access.

**How to avoid:** Import the store module directly; use `store.getState().action()` for imperative calls outside React. Use `useStore(s => s.slice)` only inside React components.

---

## Code Examples

### Vitest Configuration

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test-setup.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
```

```typescript
// src/test-setup.ts
import '@testing-library/jest-dom';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

afterEach(() => {
  cleanup();
});
```

### Vite Config with Tailwind v4

```typescript
// vite.config.ts
import path from 'path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
```

```css
/* src/index.css */
@import "tailwindcss";
/* shadcn/ui CSS variables will be added here by `npx shadcn@latest init` */
```

### Vercel Deployment Config (SPA rewrite)

```json
// vercel.json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```

### /json/live WebSocket Response Format

The WLED live LED stream (`{"lv":true}`) returns:
```json
{"leds":["FF0000","00FF00","0000FF","000000",...], "n": 1}
```

- `leds`: Array of hex color strings, one per LED (up to 256 per frame; if more than 256 LEDs, `n` > 1 indicates sampling interval)
- `n`: Sampling interval — every nth LED is included. For 480 LEDs this may be `n: 2` (every other LED) or `n: 1` with multiple messages

**Parsing in WLEDWebSocketService:**
```typescript
if ('leds' in msg && Array.isArray(msg.leds)) {
  const hexColors = msg.leds as string[];
  hexColors.forEach((hex, i) => {
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    ledStateProxy.colors[i * 3]     = r;
    ledStateProxy.colors[i * 3 + 1] = g;
    ledStateProxy.colors[i * 3 + 2] = b;
  });
  ledStateProxy.lastUpdated = performance.now();
}
```

### Plugin Contract Unit Test Pattern

```typescript
// src/core/pipeline/__tests__/pluginContracts.test.ts
import { describe, it, expect, vi } from 'vitest';
import type { InputPlugin, MappingStrategy, OutputPlugin, FrameData, PluginContext } from '../types';

describe('TestInputPlugin_ContractShape', () => {
  it('requires id, name, initialize, tick, and destroy', () => {
    const plugin: InputPlugin = {
      id: 'test-input',
      name: 'Test Input',
      initialize: vi.fn().mockResolvedValue(undefined),
      tick: vi.fn().mockReturnValue(null),
      destroy: vi.fn(),
    };
    expect(plugin.id).toBe('test-input');
    expect(typeof plugin.initialize).toBe('function');
    expect(typeof plugin.tick).toBe('function');
    expect(typeof plugin.destroy).toBe('function');
  });
});

describe('TestMappingStrategy_ContractShape', () => {
  it('map() returns Uint8Array of length ledCount×3', () => {
    const strategy: MappingStrategy = {
      id: 'test-mapping',
      map: (_frame: FrameData, ledCount: number) => new Uint8Array(ledCount * 3),
    };
    const result = strategy.map({ type: 'direct' }, 480);
    expect(result).toBeInstanceOf(Uint8Array);
    expect(result.length).toBe(480 * 3);
  });
});

describe('TestOutputPlugin_ContractShape', () => {
  it('requires id, send, and destroy', () => {
    const output: OutputPlugin = {
      id: 'test-output',
      send: vi.fn(),
      destroy: vi.fn(),
    };
    expect(typeof output.send).toBe('function');
    expect(typeof output.destroy).toBe('function');
  });
});
```

### Zustand TypeScript Pattern (v5)

```typescript
// Double-paren syntax required for TypeScript middleware compatibility
export const connectionStore = create<ConnectionStore>()((set) => ({
  ip: '',
  status: 'disconnected' as ConnectionStatus,
  setIp: (ip) => set({ ip }),
  setStatus: (status) => set({ status }),
}));

// With devtools (position last in middleware chain):
import { devtools } from 'zustand/middleware';
export const connectionStore = create<ConnectionStore>()(
  devtools((set) => ({
    ip: '',
    status: 'disconnected' as ConnectionStatus,
    setIp: (ip) => set({ ip }, false, 'setIp'),
    setStatus: (status) => set({ status }, false, 'setStatus'),
  }), { name: 'ConnectionStore' })
);
```

---

## WLED API Reference

### Verified Endpoints (HIGH confidence — official docs)

| Endpoint | Method | Purpose | Notes |
|----------|--------|---------|-------|
| `ws://[IP]/ws` | WebSocket | Real-time bidirectional state | Max 4 clients; sends state on connect |
| `/json/state` | GET | Read current state | `on`, `bri`, `seg[]`, `fx`, `pal`, `col` |
| `/json/state` | POST | Write state | Sequential only; ≤24KB on ESP32 |
| `/json/info` | GET | Device info (read-only) | `ver`, `leds.count`, `fxcount`, `palcount` |
| `/json/eff` | GET | Array of effect names | Returns `["Solid","Blink",...]` |
| `/json/pal` | GET | Array of palette names | Returns `["Default","Random Cycle",...]` |

### WebSocket Message Protocol

| Client → WLED | Purpose |
|--------------|---------|
| `{"v":true}` | Request full state broadcast |
| `{"lv":true}` | Start live LED stream (exclusive; kicks previous subscriber) |
| `{"on":true,"bri":200}` | Set any state property directly |

| WLED → Client | Purpose |
|--------------|---------|
| `{"state":{...},"info":{...}}` | State + info on connect and any state change |
| `{"leds":["FF0000",...],"n":1}` | Live LED colors (hex string per LED) when `lv:true` active |

### Individual LED Write Format

```json
POST /json/state
{"seg":{"i":[0,"FF0000", 1,"00FF00", 2,"0000FF"]}}
```

Or using RGB arrays (less efficient):
```json
{"seg":{"i":[[255,0,0],[0,255,0],[0,0,255]]}}
```

**Critical constraint:** Requests must be chunked at ≤256 LEDs and sent sequentially. For all 480 LEDs: 2 sequential requests of 240 each.

**Additional constraint:** Brightness must be > 0 before individual LED colors have any effect. Set `{"on":true,"bri":128}` in a prior request if needed.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `tailwind.config.js` | `@import "tailwindcss"` in CSS (no config file) | Tailwind v4 (2025) | No config file; OKLCH colors; `@tailwindcss/vite` plugin replaces PostCSS |
| `npx shadcn-ui@latest` | `npx shadcn@latest` | shadcn CLI rebrand (2025) | Same components; shorter command; `npx shadcn@latest init -t vite` for Vite projects |
| `/json/live` HTTP polling | `{"lv":true}` via WebSocket | Recent WLED builds | `/json/live` disabled when WebSocket is enabled; WS path is correct |
| React Context for state | Zustand + Valtio split | Community consensus 2024 | Context causes full subtree re-renders on every value change; unusable at >10Hz update rate |
| Jest for Vite projects | Vitest | Vitest v1+ | No transpilation overhead; native Vite plugin resolution; Jest API compatibility |

**Deprecated/outdated:**
- `wled-js` / `wled-client` libraries: Under 50 stars each; do not use
- `vitest-websocket-mock` (akiomik): 100+ stars but superseded by MSW v2 for most use cases; MSW is preferred
- PostCSS-based Tailwind: Not compatible with Tailwind v4; use `@tailwindcss/vite` plugin

---

## Open Questions

1. **`/json/live` behavior on hs-1.6 specifically**
   - What we know: Official WLED docs say `{"lv":true}` via WebSocket returns same format as `/json/live`. Recent WLED builds disable `/json/live` HTTP when WebSocket is enabled.
   - What's unclear: Whether hs-1.6 fork enables or disables `/json/live` HTTP, and whether the live stream includes all 480 LEDs or samples them
   - Recommendation: Build virtual cube mock to return all 480 LEDs in `{"leds":[...]}` format. Probe real device in Phase 2 to observe actual sampling behavior.

2. **hs-1.6 fork feature set vs. upstream WLED**
   - What we know: Custom fork by Hyperspace Lighting Company. Reports `ver: "hs-1.6"`. May diverge from upstream 0.14+ features.
   - What's unclear: Which upstream version hs-1.6 is based on; whether `/json/fxdata` (added 0.14) exists; whether per-segment individual LED addressing works identically
   - Recommendation: Probe `/json/info` on first connection and log the full response. Build virtual cube mock conservatively (only features verified against mock, not assumed from upstream docs).

3. **Node.js version for WebSocket polyfill in Vitest**
   - What we know: MSW v2 WebSocket interception requires a global `WebSocket` class. Node.js v22+ has native WebSocket; older versions need `undici` or `isomorphic-ws` polyfill.
   - What's unclear: Which Node.js version the project CI will use
   - Recommendation: Add to `vitest.config.ts`: check Node version; if `< 22`, add `global.WebSocket = require('undici').WebSocket` in `src/test-setup.ts`.

---

## Sources

### Primary (HIGH confidence)

- [WLED WebSocket Documentation](https://kno.wled.ge/interfaces/websocket/) — WS endpoint, `{"lv":true}`, `{"v":true}`, 4-client limit, exclusive live stream behavior
- [WLED JSON API Documentation](https://kno.wled.ge/interfaces/json-api/) — `/json/state`, `/json/info`, `/json/eff`, `/json/pal` structure; sequential-only warning; 24KB ESP32 buffer limit; individual LED `i[]` array format
- [WLED source code (json.cpp)](https://github.com/wled/WLED/blob/main/wled00/json.cpp) — `/json/live` response format confirmed: `{"leds":["RRGGBB",...],"n":N}` hex string array
- [MSW WebSocket docs](https://mswjs.io/docs/websocket/) — `ws.link()`, connection handler, `client.send()`, `api.broadcast()`
- [MSW ws API reference](https://mswjs.io/docs/api/ws/) — complete `ws` namespace API for handlers
- [shadcn/ui Vite installation](https://ui.shadcn.com/docs/installation/vite) — exact setup steps for Vite + Tailwind v4 + React 19
- [Valtio getting started](https://valtio.dev/docs/introduction/getting-started) — `proxy()`, `useSnapshot()`, subscribe pattern
- [Zustand TypeScript guide](https://zustand.docs.pmnd.rs/learn/guides/beginner-typescript) — double-paren syntax, middleware composition, devtools

### Secondary (MEDIUM confidence)

- [MSW Node.js integration](https://mswjs.io/docs/integrations/node/) — `setupServer` for Vitest; Node.js WebSocket polyfill requirement
- [MDN: Window.isSecureContext](https://developer.mozilla.org/en-US/docs/Web/API/Window/isSecureContext) — mixed content detection API
- [Vercel SPA rewrite config](https://vercel.com/docs/project-configuration/vercel-json) — `rewrites` for Vite SPA

### Tertiary (LOW confidence — needs validation on real hardware)

- WLED hs-1.6 firmware behavior: No direct documentation found; behavior assumed consistent with upstream WLED 0.13-0.14 based on forum reports. Must be validated against physical device in Phase 2.
- Live LED stream sampling behavior for 480+ LEDs: Source code analysis suggests `n > 1` sampling when LED count exceeds buffer; exact threshold not confirmed.

---

## Metadata

**Confidence breakdown:**
- Standard stack (scaffold): HIGH — official docs for all tools verified
- WLED API: HIGH — official WLED docs + source code
- MSW v2 WebSocket API: HIGH — official MSW docs
- Architecture patterns: HIGH — derived from verified library APIs
- hs-1.6 behavior: LOW — no direct documentation; probe real device in Phase 2
- `/json/live` sampling for 480 LEDs: MEDIUM — source code analysis, not tested against real device

**Research date:** 2026-04-09
**Valid until:** 2026-05-09 (Tailwind v4 + shadcn still evolving; check if shadcn canary vs latest changes before executing)
