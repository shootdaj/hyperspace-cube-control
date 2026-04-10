---
phase: quick-1
plan: 1
type: execute
wave: 1
depends_on: []
files_modified:
  - src/core/pipeline/WLEDLiveSync.ts
  - src/core/pipeline/__tests__/WLEDLiveSync.test.ts
autonomous: true
requirements: []

must_haves:
  truths:
    - "When paint mode is active, incoming WLED live frames do NOT overwrite ledStateProxy.colors"
    - "When paint mode is inactive, WLED live frames continue to update ledStateProxy.colors normally"
  artifacts:
    - path: "src/core/pipeline/WLEDLiveSync.ts"
      provides: "isPaintMode guard in ws.subscribe() callback"
      contains: "paintStore.getState().isPaintMode"
  key_links:
    - from: "src/core/pipeline/WLEDLiveSync.ts"
      to: "src/stores/paintStore.ts"
      via: "paintStore.getState().isPaintMode"
      pattern: "paintStore\\.getState\\(\\)\\.isPaintMode"
---

<objective>
Guard the WLEDLiveSync subscriber so it skips overwriting ledStateProxy.colors when paint mode is active.

Purpose: Paint mode writes LED colors into ledStateProxy directly. The WLED live stream runs at ~15fps and unconditionally stomps those colors before useFrame can render them, making paint strokes invisible.

Output: One-line guard at top of the ws.subscribe() callback + two new unit tests covering the guarded/unguarded cases.
</objective>

<execution_context>
@/Users/anshul/.claude/get-shit-done/workflows/execute-plan.md
@/Users/anshul/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/PROJECT.md

<interfaces>
<!-- From src/stores/paintStore.ts -->
```typescript
export const paintStore = create<PaintState>((set) => ({
  isPaintMode: false,
  // ...
}));
// Usage: paintStore.getState().isPaintMode
```

<!-- From src/core/pipeline/WLEDLiveSync.ts — subscribe callback to modify (lines 37-51) -->
```typescript
const unsubscribe = ws.subscribe((msg: WLEDMessage) => {
  if (!isLiveStreamMessage(msg)) return;
  // ... writes to ledStateProxy.colors
});
```
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Add isPaintMode guard to WLEDLiveSync subscriber</name>
  <files>src/core/pipeline/WLEDLiveSync.ts, src/core/pipeline/__tests__/WLEDLiveSync.test.ts</files>
  <behavior>
    - Test: When paintStore.isPaintMode is true, emitting a live LED message does NOT update ledStateProxy.colors or ledStateProxy.lastUpdated
    - Test: When paintStore.isPaintMode is false (default), emitting a live LED message updates ledStateProxy.colors normally (existing behavior preserved)
  </behavior>
  <action>
**Tests first (RED):**

Add two tests to `src/core/pipeline/__tests__/WLEDLiveSync.test.ts`:

1. `TestWLEDLiveSync_SkipsUpdate_WhenPaintModeActive` — set `paintStore.setState({ isPaintMode: true })` before emitting a live message; assert `ledStateProxy.colors[0]` remains 0 and `ledStateProxy.lastUpdated` remains 0. Reset paint mode in `beforeEach` by adding `paintStore.setState({ isPaintMode: false })`.

2. `TestWLEDLiveSync_UpdatesColors_WhenPaintModeInactive` — set `paintStore.setState({ isPaintMode: false })` explicitly; emit a live message; assert colors are updated. (This verifies the existing path still works with the guard present.)

You do NOT need to mock paintStore — Vitest will use the real Zustand store. Import it: `import { paintStore } from '@/stores/paintStore';`

Run tests — both new tests should FAIL (RED).

**Implementation (GREEN):**

In `src/core/pipeline/WLEDLiveSync.ts`:

1. Add import at top (after existing imports):
   ```typescript
   import { paintStore } from '@/stores/paintStore';
   ```

2. Inside the `ws.subscribe()` callback, add the guard as the SECOND early-return check (after `isLiveStreamMessage`):
   ```typescript
   if (paintStore.getState().isPaintMode) return;
   ```

The final callback should read:
```typescript
const unsubscribe = ws.subscribe((msg: WLEDMessage) => {
  if (!isLiveStreamMessage(msg)) return;
  if (paintStore.getState().isPaintMode) return;

  const leds = msg.leds;
  // ... rest unchanged
});
```

Run all WLEDLiveSync tests — all must pass (GREEN). No existing tests should break.
  </action>
  <verify>
    <automated>npx vitest run --dir src/core/pipeline/__tests__/WLEDLiveSync.test.ts</automated>
  </verify>
  <done>All WLEDLiveSync tests pass (existing 6 + new 2 = 8 total). Guard is present in source. Paint buffer is no longer stomped by live sync.</done>
</task>

</tasks>

<verification>
Run the full unit test suite to confirm no regressions:

```
npx vitest run --dir src
```

All tests pass.
</verification>

<success_criteria>
- `paintStore.getState().isPaintMode` guard is present in WLEDLiveSync.ts subscriber callback
- 2 new tests: one verifying the guard blocks writes, one verifying normal writes still work
- All existing WLEDLiveSync tests continue to pass
- Full `npx vitest run --dir src` passes with no regressions
</success_criteria>

<output>
After completion, create `.planning/quick/1-fix-wledlivesync-overwriting-paint-buffe/1-SUMMARY.md`
</output>
