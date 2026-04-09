---
phase: 02-3d-visualization-pipeline-engine
plan: "06"
subsystem: pipeline
tags: [raf, game-loop, pipeline, valtio, requestAnimationFrame]

requires:
  - phase: 01-foundation-wled-communication
    provides: Plugin type interfaces, ledStateProxy, mock plugins
provides:
  - PipelineEngine RAF loop with 30fps delta-time throttling
  - runPipelineTick exported for direct testing
  - usePipelineEngine hook with plugin setters
affects: [02-07-WLEDWebSocketOutput, 02-08-integration-tests]

tech-stack:
  added: []
  patterns: ["RAF loop with extracted tick function for testability", "Ref-based plugin hot-swap without effect restart"]

key-files:
  created: [src/core/pipeline/PipelineEngine.ts, src/core/pipeline/__tests__/PipelineEngine.test.ts]
  modified: []

key-decisions:
  - "Extracted runPipelineTick as pure function for direct unit testing without RAF"
  - "useEffect dependency array is [] — loop never restarts due to plugin changes"
  - "Delta-time throttling (not setTimeout) for smooth frame rate control"

patterns-established:
  - "Pipeline tick: input.tick(delta) -> mapping.map(frame, 480) -> ledStateProxy.colors.set(leds) -> output.send(leds, 255)"
  - "Plugin replacement: destroy old, assign new to ref — no loop restart needed"

requirements-completed: [PLUG-04]

duration: 3min
completed: 2026-04-09
---

# Phase 2 Plan 06: PipelineEngine RAF Loop Summary

**30fps RAF game loop with extracted tick logic, ref-based plugin hot-swap, and delta-time throttling**

## Performance

- **Duration:** 3 min
- **Started:** 2026-04-09T13:32:00Z
- **Completed:** 2026-04-09T13:35:00Z
- **Tasks:** 1 (TDD)
- **Files modified:** 2

## Accomplishments
- Implemented runPipelineTick: input -> mapping -> ledStateProxy -> output pipeline
- 30fps target via delta-time throttling (FRAME_INTERVAL_MS ~33.33ms)
- usePipelineEngine hook with setInputPlugin, setMappingStrategy, setOutputPlugin
- 10 passing unit tests covering all tick conditions and edge cases

## Task Commits

Each task was committed atomically:

1. **Task 1: Implement PipelineEngine hook (TDD)** - `25ca457` (test: RED), `53cfc46` (feat: GREEN)

## Files Created/Modified
- `src/core/pipeline/PipelineEngine.ts` - RAF loop, runPipelineTick, usePipelineEngine hook
- `src/core/pipeline/__tests__/PipelineEngine.test.ts` - 10 unit tests for tick logic

## Decisions Made
- Extracted runPipelineTick as testable pure function — tests don't need RAF mocking
- useEffect deps array is [] — confirmed in code, loop never restarts

## Deviations from Plan
None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- PipelineEngine ready for WLEDWebSocketOutput (02-07) plugin swap tests
- Ready for integration tests in 02-08

---
*Phase: 02-3d-visualization-pipeline-engine*
*Completed: 2026-04-09*
