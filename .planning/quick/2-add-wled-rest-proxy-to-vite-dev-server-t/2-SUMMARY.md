---
phase: quick-2
plan: 2
subsystem: wled-rest
tags: [proxy, vite, chrome-pna, cors, dev-tooling]
dependency_graph:
  requires: []
  provides: [wled-rest-proxy, dev-proxy-middleware]
  affects: [WLEDRestClient, sacn-bridge-plugin]
tech_stack:
  added: []
  patterns: [node-http-proxy, import.meta.env.DEV conditional, exported-utility-for-testability]
key_files:
  created:
    - src/core/wled/__tests__/WLEDRestClient.test.ts
  modified:
    - vite-plugins/sacn-bridge.ts
    - src/core/wled/WLEDRestClient.ts
decisions:
  - "Use import.meta.env.TEST guard in WLEDRestClient.buildUrl() so integration tests continue to use direct IP URLs (MSW-interceptable), while real browser dev uses the proxy"
  - "Export buildWledUrl() as a pure function for testability rather than testing through WLEDRestClient instance (which is affected by TEST env guard)"
  - "Proxy middleware added to sacn-bridge.ts configureServer before sACN setup using Node built-in http.request — no external packages"
metrics:
  duration: 280s
  completed: "2026-04-09"
  tasks_completed: 2
  files_changed: 3
---

# Quick Task 2: Add WLED REST Proxy to Vite Dev Server Summary

**One-liner:** Same-origin `/api/wled-proxy` middleware in Vite dev server routes WLED REST calls through `sacn-bridge.ts` to bypass Chrome Private Network Access blocks, with `buildWledUrl()` exported from `WLEDRestClient` for clean testability.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add WLED proxy middleware to sacn-bridge plugin | d87b22f | vite-plugins/sacn-bridge.ts |
| 2 | Update WLEDRestClient to use proxy in dev mode | 1b7cafa | src/core/wled/WLEDRestClient.ts, src/core/wled/__tests__/WLEDRestClient.test.ts |

## What Was Built

### Task 1: Vite Dev Proxy Middleware (`vite-plugins/sacn-bridge.ts`)

Added imports for `node:http` and `node:url` at the top of the file. In `configureServer`, before the sACN sender and WebSocket setup, registered an HTTP middleware at `/api/wled-proxy` using `server.middlewares.use`.

The middleware:
- Parses `?target=` and `?path=` query params from the request URL
- Returns HTTP 400 if either param is missing
- Forwards GET/POST requests to `http://{target}{path}` using Node's built-in `http.request`
- For POST requests: pipes request body and sets `Content-Type: application/json`
- Pipes the upstream response (status code + body) back to the Vite response
- Returns HTTP 502 with JSON error body on upstream connection failure
- Logs startup line with the proxy URL in the startup banner

### Task 2: WLEDRestClient URL Routing (`src/core/wled/WLEDRestClient.ts`)

Exported `buildWledUrl(ip, path, devMode)` as a standalone pure function for testability. Added `private buildUrl(path)` method to `WLEDRestClient` that calls `buildWledUrl(this.ip, path, import.meta.env.DEV && !import.meta.env.TEST)`.

The `!import.meta.env.TEST` guard ensures integration/scenario tests continue to generate `http://192.168.1.100/json/...` URLs that MSW can intercept — without it, `import.meta.env.DEV` is `true` in vitest (mode=test) and relative proxy URLs would be generated that Node's `fetch` cannot handle.

All five fetch methods updated: `getInfo()`, `getState()`, `setState()`, `getEffects()`, `getPalettes()`. `setLEDs()` delegates to `setState()` and picks up the change automatically.

## Tests

4 new unit tests in `src/core/wled/__tests__/WLEDRestClient.test.ts`:
- `TestWLEDRestClient_BuildUrl_ReturnsProxyUrl_WhenDevTrue` — `buildWledUrl(ip, path, true)` returns proxy URL
- `TestWLEDRestClient_BuildUrl_ReturnsDirectUrl_WhenDevFalse` — `buildWledUrl(ip, path, false)` returns direct IP URL
- `TestWLEDRestClient_BuildUrl_EncodesPathCorrectly_WhenDevTrue` — `/json/eff` is percent-encoded in proxy URL
- `TestWLEDRestClient_BuildUrl_PostUsesProxyUrl_WhenDevTrue` — POST path `/json/state` generates correct proxy URL

**Total test count after this task: 611 (all passing)**

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] jsdom `import.meta.env.DEV` is true in vitest, breaking integration tests**

- **Found during:** Task 2 GREEN phase — all 7 integration tests in `test/integration/wled-rest-client.test.ts` failed with `fetch failed` or MSW unmatched request warnings
- **Issue:** Vitest sets `import.meta.env.DEV=true` (mode=test is a dev mode). Without a guard, `WLEDRestClient.buildUrl()` would generate `/api/wled-proxy?...` relative URLs in all tests. Node's `fetch` cannot resolve relative URLs (no base), and MSW handlers are registered for `http://*/json/...` pattern — not the proxy path.
- **Fix:** Added `!import.meta.env.TEST` guard: `buildWledUrl(this.ip, path, import.meta.env.DEV && !import.meta.env.TEST)`. Vitest sets `import.meta.env.TEST=true`, so integration/scenario tests use direct IP URLs as before. Browser dev mode uses proxy (TEST is not set by Vite).
- **Files modified:** `src/core/wled/WLEDRestClient.ts`
- **Commit:** 1b7cafa

**2. [Rule 1 - Bug] Dynamic import in test caused module caching issue with vi.stubEnv**

- **Found during:** Task 2 RED phase — initial test design used `vi.stubEnv('DEV', 'true')` with dynamic `import('../WLEDRestClient')` to control `import.meta.env.DEV`, but this couldn't work because `import.meta.env.DEV` is resolved at Vite transform time, not runtime.
- **Fix:** Restructured tests to use exported `buildWledUrl()` pure function (3 tests) and directly verified POST URL construction via `buildWledUrl()` (1 test). Removed dynamic imports from tests entirely.
- **Files modified:** `src/core/wled/__tests__/WLEDRestClient.test.ts`
- **Commit:** 1b7cafa (same commit as implementation)

## Self-Check: PASSED

### Files Exist
- FOUND: vite-plugins/sacn-bridge.ts
- FOUND: src/core/wled/WLEDRestClient.ts
- FOUND: src/core/wled/__tests__/WLEDRestClient.test.ts

### Commits Exist
- FOUND: d87b22f (feat(quick-2): add WLED REST proxy middleware to sacn-bridge plugin)
- FOUND: 1b7cafa (feat(quick-2): update WLEDRestClient to use proxy in dev mode)
