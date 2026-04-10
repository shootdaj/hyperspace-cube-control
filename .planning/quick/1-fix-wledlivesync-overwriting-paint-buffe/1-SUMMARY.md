---
phase: quick-1
plan: 1
subsystem: pipeline
tags: [paint-mode, wled-live-sync, guard, bug-fix]
dependency_graph:
  requires: [paintStore, WLEDWebSocketService, ledStateProxy]
  provides: [isPaintMode guard in WLEDLiveSync subscriber]
  affects: [src/core/pipeline/WLEDLiveSync.ts]
tech_stack:
  added: []
  patterns: [Zustand getState() read in non-React context]
key_files:
  created: []
  modified:
    - src/core/pipeline/WLEDLiveSync.ts
    - src/core/pipeline/__tests__/WLEDLiveSync.test.ts
decisions:
  - "Read paintStore via getState() directly (no subscription) since guard runs in every WebSocket callback frame at ~15fps; subscription overhead unnecessary"
metrics:
  duration: "~5 minutes"
  completed: "2026-04-10"
  tasks_completed: 1
  files_modified: 2
---

# Quick-1 Plan 1: Fix WLEDLiveSync Overwriting Paint Buffer Summary

**One-liner:** isPaintMode guard added to ws.subscribe() callback — WLED live frames at 15fps no longer stomp ledStateProxy.colors when paint mode is active.

## What Was Done

Paint mode writes LED colors directly into `ledStateProxy.colors`. The WLED live stream subscriber was running unconditionally at ~15fps and overwriting those painted values before `useFrame` could render them, making paint strokes invisible.

**Fix:** Added a single early-return guard as the second check in the `ws.subscribe()` callback:

```typescript
if (paintStore.getState().isPaintMode) return;
```

Import added: `import { paintStore } from '@/stores/paintStore';`

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add isPaintMode guard to WLEDLiveSync subscriber | 158ed34 | WLEDLiveSync.ts, WLEDLiveSync.test.ts |

## Test Results

- Tests before fix: 7 passed, 1 failed (RED — `TestWLEDLiveSync_SkipsUpdate_WhenPaintModeActive`)
- Tests after fix: 8 passed (GREEN)
- Full suite: 607 tests pass, 0 failures, 0 regressions

### New Tests Added

1. `TestWLEDLiveSync_SkipsUpdate_WhenPaintModeActive` — sets `isPaintMode: true`, emits live frame, asserts `ledStateProxy.colors[0]` stays 0 and `lastUpdated` stays 0
2. `TestWLEDLiveSync_UpdatesColors_WhenPaintModeInactive` — sets `isPaintMode: false`, emits live frame, asserts colors update normally (existing path verified with guard present)

## Deviations from Plan

None — the test file already contained the two new tests (written ahead of implementation). The guard implementation proceeded directly to GREEN phase after confirming the RED state.

## Self-Check: PASSED

- [x] `src/core/pipeline/WLEDLiveSync.ts` exists and contains `paintStore.getState().isPaintMode` guard
- [x] `src/core/pipeline/__tests__/WLEDLiveSync.test.ts` contains both new test cases
- [x] Commit 158ed34 exists
- [x] 607 total tests pass with no regressions
