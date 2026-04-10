---
phase: quick-2
plan: 2
type: execute
wave: 1
depends_on: []
files_modified:
  - vite-plugins/sacn-bridge.ts
  - src/core/wled/WLEDRestClient.ts
autonomous: true
requirements: []

must_haves:
  truths:
    - "WLEDRestClient fetches succeed in Chrome dev (no Private Network Access block)"
    - "In dev mode, REST calls route through localhost proxy not direct cube IP"
    - "In production builds, WLEDRestClient still calls the cube IP directly"
  artifacts:
    - path: "vite-plugins/sacn-bridge.ts"
      provides: "HTTP proxy middleware at /api/wled-proxy"
    - path: "src/core/wled/WLEDRestClient.ts"
      provides: "Dev-mode URL rewriting using proxy"
  key_links:
    - from: "src/core/wled/WLEDRestClient.ts"
      to: "/api/wled-proxy"
      via: "import.meta.env.DEV conditional in buildUrl()"
      pattern: "import\\.meta\\.env\\.DEV"
    - from: "vite-plugins/sacn-bridge.ts"
      to: "http://{target}{path}"
      via: "Node http.request in configureServer middleware"
      pattern: "wled-proxy"
---

<objective>
Fix Chrome Private Network Access (PNA) blocks on WLED REST calls by routing them through a same-origin Vite dev proxy.

Purpose: Chrome blocks requests from `http://localhost:5173` to `http://192.168.1.160` because WLED firmware does not return the `Access-Control-Allow-Private-Network: true` header. A same-origin proxy at `/api/wled-proxy` bypasses PNA entirely.
Output: Working WLED REST API in Chrome dev mode without CORS/PNA errors.
</objective>

<execution_context>
@/Users/anshul/.claude/get-shit-done/workflows/execute-plan.md
@/Users/anshul/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@vite-plugins/sacn-bridge.ts
@src/core/wled/WLEDRestClient.ts
@vite.config.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add WLED proxy middleware to sacn-bridge plugin</name>
  <files>vite-plugins/sacn-bridge.ts</files>
  <action>
    In the `configureServer` hook, register an HTTP middleware on Vite's dev server BEFORE the existing sACN/WebSocket setup. Use `server.middlewares.use` to handle `GET` and `POST` requests to `/api/wled-proxy`.

    Middleware logic:
    1. Parse the request URL to extract `target` and `path` query params. Example: `/api/wled-proxy?target=192.168.1.160&path=/json/state`
    2. Validate both params are present; return 400 if missing.
    3. Use Node's built-in `http` module (import at top of file) to forward the request:
       - Method: same as incoming (`req.method`)
       - URL: `http://${target}${path}`
       - For POST requests: pipe `req` body through to the outgoing request; set `Content-Type: application/json` header.
       - For GET requests: no body.
    4. On response: set `res.statusCode` to the upstream status code, set `Content-Type: application/json` on `res`, and pipe the upstream response directly to `res`.
    5. On upstream error: return 502 with JSON error body.

    Do NOT use `http-proxy` or `http-proxy-middleware` packages — use Node's built-in `http.request` only.

    Add import at top: `import http from 'node:http';` and `import { URL } from 'node:url';`

    Log startup line alongside existing logs:
    `console.log(\`  ${PREFIX} WLED Proxy : http://localhost:PORT/api/wled-proxy?target=CUBE_IP&path=/json/state\`);`
    Use `server.httpServer?.address()` to get the port, or fall back to 5173 if null.
  </action>
  <verify>
    <automated>npx tsc --noEmit 2>&1 | head -20</automated>
  </verify>
  <done>TypeScript compiles clean; middleware registered in configureServer before sACN setup.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Update WLEDRestClient to use proxy in dev mode</name>
  <files>src/core/wled/WLEDRestClient.ts, src/core/wled/WLEDRestClient.test.ts</files>
  <behavior>
    - Test 1: buildUrl('/json/state') returns '/api/wled-proxy?target=192.168.1.160&path=/json/state' when DEV=true
    - Test 2: buildUrl('/json/state') returns 'http://192.168.1.160/json/state' when DEV=false
    - Test 3: buildUrl('/json/eff') encodes path correctly in proxy URL when DEV=true
    - Test 4: POST to buildUrl('/json/state') with body works (same URL construction regardless of method)
  </behavior>
  <action>
    Write tests first in `src/core/wled/WLEDRestClient.test.ts`, then implement.

    Add a private `buildUrl(path: string): string` method to `WLEDRestClient`:
    ```typescript
    private buildUrl(path: string): string {
      if (import.meta.env.DEV) {
        return `/api/wled-proxy?target=${encodeURIComponent(this.ip)}&path=${encodeURIComponent(path)}`;
      }
      return `http://${this.ip}${path}`;
    }
    ```

    Replace all direct `fetch(\`http://${this.ip}/...\`)` calls with `fetch(this.buildUrl('/...'))`
    Specifically update: `getInfo()`, `getState()`, `setState()`, `getEffects()`, `getPalettes()`.
    The `setLEDs()` method delegates to `setState()` so it picks up the change automatically — no direct change needed there.

    For tests, mock `import.meta.env.DEV` using vitest's `vi.stubGlobal` or by importing `import.meta.env` from the test. Use this pattern:
    ```typescript
    import { beforeEach, describe, expect, it, vi } from 'vitest';
    // Mock import.meta.env via vi.stubEnv
    vi.stubEnv('DEV', 'true'); // for dev tests
    vi.stubEnv('DEV', 'false'); // for prod tests
    ```
    Or use `vi.mock` on the module to control the env. Check what vitest version is installed and use its recommended approach for mocking `import.meta.env`.
  </action>
  <verify>
    <automated>npx vitest run --dir src/core/wled 2>&1</automated>
  </verify>
  <done>All 4 behaviors pass. `WLEDRestClient` uses proxy URLs in dev mode and direct URLs in prod.</done>
</task>

</tasks>

<verification>
After both tasks complete:
1. `npx tsc --noEmit` — no errors
2. `npx vitest run --dir src` — all tests pass including new WLEDRestClient tests
3. `npm run build` — production build succeeds
4. Manual dev check: `npm run dev`, open Chrome DevTools Network tab, confirm WLED calls go to `/api/wled-proxy?target=...` not `http://192.168.1.160/...`
</verification>

<success_criteria>
- Chrome no longer shows Private Network Access errors for WLED REST calls during development
- WLEDRestClient test file exists with 4+ passing tests covering dev/prod URL construction
- TypeScript compiles clean with no new errors
- Production build unaffected (direct IP calls still used)
</success_criteria>

<output>
After completion, create `.planning/quick/2-add-wled-rest-proxy-to-vite-dev-server-t/2-SUMMARY.md`
</output>
