---
phase: 02-3d-visualization-pipeline-engine
plan: "02"
subsystem: visualization
tags: [three.js, instanced-mesh, webgl, valtio, led-geometry]

requires:
  - phase: 02-3d-visualization-pipeline-engine
    provides: CubeScene Canvas shell (02-01), ledStateProxy (Phase 1)
provides:
  - 480 LED positions computed analytically for 12-edge cube
  - CubeMesh InstancedMesh with useFrame hot path reading ledStateProxy
  - Visual centerpiece of 3D visualization
affects: [02-03-WLEDLiveSync, 02-05-Bloom, 02-08-scenario-tests]

tech-stack:
  added: []
  patterns: ["InstancedMesh with pre-allocated Color", "Module-level _color for zero-allocation useFrame", "useMemo for geometry/material lifecycle"]

key-files:
  created: [src/visualization/cubeGeometry.ts, src/visualization/CubeMesh.tsx, src/visualization/__tests__/cubeGeometry.test.ts, src/visualization/__tests__/CubeMesh.test.tsx]
  modified: [src/visualization/CubeScene.tsx]

key-decisions:
  - "LEDS_PER_EDGE=40 (not 20 as in research doc) to match 480 total LEDs (12x40=480)"
  - "MeshBasicMaterial with toneMapped:false — HDR colors > 1.0 feed Bloom postprocessing"
  - "Color scale 1.5/255 maps LED byte 255 to 1.5 — above Bloom luminanceThreshold=0.5"

patterns-established:
  - "Module-level pre-allocated THREE.Color for zero-allocation useFrame loops"
  - "instanceColor pre-allocation: setColorAt for all instances at mount before useFrame runs"

requirements-completed: [VIZ-01, VIZ-04, VIZ-05]

duration: 5min
completed: 2026-04-09
---

# Phase 2 Plan 02: CubeMesh InstancedMesh Summary

**480-LED InstancedMesh with analytical edge positions, zero-allocation useFrame hot path reading ledStateProxy directly**

## Performance

- **Duration:** 5 min
- **Started:** 2026-04-09T13:35:00Z
- **Completed:** 2026-04-09T13:38:00Z
- **Tasks:** 2 (both TDD)
- **Files modified:** 5

## Accomplishments
- computeLEDPositions() returns 480 unique Vector3 positions on 12 cube edges
- CubeMesh InstancedMesh with MeshBasicMaterial + toneMapped:false for HDR bloom
- useFrame hot path: zero React re-renders, pre-allocated Color, direct ledStateProxy read
- 9 new tests (6 geometry + 3 mesh)

## Task Commits

1. **Task 1: cubeGeometry (TDD)** - `30ad591` (test: RED), `58b0f4c` (feat: GREEN)
2. **Task 2: CubeMesh (TDD)** - `376eaad` (test: RED), `d8af784` (feat: GREEN)

## Files Created/Modified
- `src/visualization/cubeGeometry.ts` - 480 LED position computation
- `src/visualization/CubeMesh.tsx` - InstancedMesh with useFrame hot path
- `src/visualization/CubeScene.tsx` - Added CubeMesh import and JSX
- `src/visualization/__tests__/cubeGeometry.test.ts` - 6 geometry tests
- `src/visualization/__tests__/CubeMesh.test.tsx` - 3 mesh tests

## Decisions Made
- LEDS_PER_EDGE=40 instead of 20 (research doc error: 12x20=240, not 480)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] LEDS_PER_EDGE corrected from 20 to 40**
- **Found during:** Task 1 (cubeGeometry implementation)
- **Issue:** Research doc and plan said 20 LEDs/edge but 12x20=240, not 480. HyperCube 15-SE has 480 LEDs.
- **Fix:** Set LEDS_PER_EDGE=40 so 12x40=480 matches system expectations
- **Files modified:** src/visualization/cubeGeometry.ts
- **Verification:** computeLEDPositions() returns exactly 480 positions

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Essential fix. 240 positions would leave half the LEDs unmapped.

## Issues Encountered
None

## User Setup Required
None

## Next Phase Readiness
- CubeMesh ready for Bloom postprocessing (02-05)
- 480 positions match ledStateProxy layout for WLEDLiveSync (02-03)

---
*Phase: 02-3d-visualization-pipeline-engine*
*Completed: 2026-04-09*
