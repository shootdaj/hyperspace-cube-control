---
status: awaiting_human_verify
trigger: "The HyperCube Control app is not connecting to the physical HyperCube 15-SE"
created: 2026-04-09T00:00:00Z
updated: 2026-04-09T00:00:00Z
---

## Current Focus

hypothesis: CONFIRMED - IP address is not persisted, so page reload loses the connection target
test: Traced full flow: wizard sets IP in Zustand store (memory-only), on reload store resets to ip='' and no reconnect code runs
expecting: Fix by persisting IP to localStorage and auto-reconnecting on mount
next_action: Implement fix in connectionStore and App.tsx

## Symptoms

expected: App should connect to HyperCube via WLED WebSocket/REST API and show live LED state in 3D view
actual: App shows UI but does not connect. User sees the 3D cube with black LEDs, control panel, but no actual connection to the physical device.
errors: Unknown — need to investigate
reproduction: Open http://localhost:5173, the app loads but doesn't connect to the cube
started: First time trying to connect after building the app from scratch

## Eliminated

## Evidence

- timestamp: 2026-04-09T00:01:00Z
  checked: connectionStore.ts - Zustand store for IP and status
  found: Plain Zustand store with no persistence. ip defaults to '' on every page load.
  implication: IP is lost on refresh — must persist to localStorage

- timestamp: 2026-04-09T00:01:30Z
  checked: App.tsx - wizard completion and reconnection logic
  found: handleWizardComplete sets IP in store and calls WebSocket.connect(ip). But on page reload, wizardDone=true (from localStorage) skips wizard, and NO code reads a saved IP or calls connect().
  implication: After first wizard completion, every page reload results in no connection attempt

- timestamp: 2026-04-09T00:02:00Z
  checked: Full codebase grep for localStorage and persist
  found: No code anywhere persists the WLED device IP. Only wizardCompleted boolean, theme, presets, and MIDI mappings are saved.
  implication: Root cause confirmed — IP never survives a page reload

- timestamp: 2026-04-09T00:02:30Z
  checked: SetupWizard.tsx handleSkip
  found: Skip calls onComplete(ip) where ip may be empty. handleWizardComplete guards with if(wizardIp) so it won't try to connect with empty IP. But wizardDone is still set to true.
  implication: Secondary issue — if user skips wizard, they can't get back to it. But this is a separate UX issue, not the main bug.

## Resolution

root_cause: The WLED device IP address is stored only in Zustand (in-memory) — not persisted to localStorage. On page reload, the wizard is skipped (wizardCompleted=true in localStorage) but the IP is lost (resets to '') and no reconnection code runs. The app shows the UI but never attempts a WebSocket connection.
fix: 1) connectionStore now persists IP to localStorage via 'hypercube-device-ip' key (load on init, save on setIp). 2) App.tsx adds a mount-time useEffect that auto-reconnects WebSocket when a saved IP exists but status is 'disconnected'.
verification: All 96 core tests pass, 20 UI tests pass (including 2 new persistence tests), Vite production build succeeds.
files_changed:
  - src/core/store/connectionStore.ts
  - src/App.tsx
  - src/core/store/__tests__/connectionStore.test.ts
