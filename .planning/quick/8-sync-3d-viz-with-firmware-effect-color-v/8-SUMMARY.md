---
phase: quick
plan: 8
subsystem: visualization/wled
tags: [3d-viz, firmware-effects, rest-polling, ledStateProxy]
key-files:
  modified:
    - src/core/wled/WLEDStatePoller.ts
decisions:
  - Guard ledStateProxy writes behind wsAvailable check to avoid overwriting WebSocket live sync data
  - Use brightness factor (bri/255) to match actual device light output
metrics:
  duration: 211s
  completed: 2026-04-10T08:33:16Z
  tasks: 1/1
  files-modified: 1
---

# Quick 8: Sync 3D Viz with Firmware Effect Color Summary

REST poller now populates ledStateProxy with segment primary color (brightness-adjusted) when WebSocket live sync is unavailable, giving 3D visualization color feedback during firmware effect browsing.

## What Changed

**WLEDStatePoller.ts** -- After updating cubeStateStore from /json/state, the poller now also fills all 224 LEDs in ledStateProxy with the first segment's primary color, applying the global brightness factor (bri/255). This means when a user browses firmware effects in the Effects tab, the 3D cube visualization reflects the effect's primary color.

Three guards prevent unwanted overwrites:
1. **sACN active** -- poller skips entirely (existing guard)
2. **WebSocket live sync available** -- live sync provides higher-fidelity per-LED colors, so poller defers
3. **Paint mode active** -- user's painted colors take priority

## Commits

| Task | Description | Commit | Files |
|------|-------------|--------|-------|
| 1 | Add ledStateProxy population to WLEDStatePoller | c3febfb | src/core/wled/WLEDStatePoller.ts |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Added WebSocket availability guard**
- **Found during:** Task 1 verification
- **Issue:** Without a WS guard, the REST poller would overwrite WebSocket live sync data (which provides per-LED colors) with a uniform primary color, degrading visualization quality when WS is active
- **Fix:** Added `WLEDWebSocketService.getInstance().isWsAvailable() === true` check to skip ledStateProxy writes when live sync handles it
- **Files modified:** src/core/wled/WLEDStatePoller.ts
- **Commit:** c3febfb

## Pre-existing Issues Noted

The scenario test `TestCubeVisualization_LiveSync_UpdatesProxy` in `test/scenarios/cube-visualization.test.tsx` was already failing before this change. The App.tsx connection handler applies brightness adjustment to ledStateProxy (line 142-144) which conflicts with the WebSocket live sync's raw hex colors. This is unrelated to the poller change.

## Self-Check: PASSED
