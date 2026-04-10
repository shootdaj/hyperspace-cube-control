---
phase: quick-3
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/core/store/uiStore.ts
  - src/core/pipeline/InputPipelineRunner.tsx
  - src/App.tsx
  - src/ui/PlayPauseButton.tsx
  - src/core/store/__tests__/uiStore.test.ts
  - test/integration/play-pause-pipeline.test.ts
  - test/scenarios/play-pause-workflow.test.tsx
autonomous: true
requirements: []
must_haves:
  truths:
    - "Play/pause button is visible in the header when connected"
    - "Play/pause button is hidden when disconnected"
    - "Clicking pause stops InputPipelineRunner from generating new frames"
    - "Clicking play resumes InputPipelineRunner frame generation"
    - "While paused, keep-alive continues sending the last frame (cube stays lit)"
    - "Button icon toggles between Play and Pause"
  artifacts:
    - path: "src/ui/PlayPauseButton.tsx"
      provides: "Play/pause toggle button component"
    - path: "src/core/store/uiStore.ts"
      provides: "pipelinePaused state and setPipelinePaused action"
    - path: "src/core/pipeline/InputPipelineRunner.tsx"
      provides: "Paused RAF loop that skips plugin ticking when paused"
  key_links:
    - from: "src/ui/PlayPauseButton.tsx"
      to: "src/core/store/uiStore.ts"
      via: "uiStore.pipelinePaused + setPipelinePaused"
      pattern: "uiStore.*pipelinePaused"
    - from: "src/core/pipeline/InputPipelineRunner.tsx"
      to: "src/core/store/uiStore.ts"
      via: "reads pipelinePaused to skip tick"
      pattern: "uiStore\\.getState\\(\\)\\.pipelinePaused"
---

<objective>
Add a global play/pause toggle button to the header bar that controls whether the InputPipelineRunner generates new LED frames.

Purpose: Allow users to freeze the current frame on the cube without disconnecting or stopping sACN keep-alive. The cube stays lit with the last frame while paused.

Output: PlayPauseButton component in header, pipelinePaused state in uiStore, InputPipelineRunner respects paused state.
</objective>

<execution_context>
@/Users/anshul/.claude/get-shit-done/workflows/execute-plan.md
@/Users/anshul/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@src/core/store/uiStore.ts
@src/core/pipeline/InputPipelineRunner.tsx
@src/App.tsx
@src/ui/ConnectionStatus.tsx

<interfaces>
<!-- Key types and contracts the executor needs -->

From src/core/store/uiStore.ts:
```typescript
interface UIStore {
  activePluginId: string | null;
  activePanel: ActivePanel;
  wizardCompleted: boolean;
  setActivePluginId: (id: string | null) => void;
  setActivePanel: (panel: ActivePanel) => void;
  setWizardCompleted: (completed: boolean) => void;
}
export const uiStore = create<UIStore>()(...)
```

From src/core/store/connectionStore.ts:
```typescript
interface ConnectionStore {
  ip: string;
  status: ConnectionStatus; // 'connected' | 'reconnecting' | 'connecting' | 'disconnected'
  setIp: (ip: string) => void;
  setStatus: (status: ConnectionStatus) => void;
}
export const connectionStore = create<ConnectionStore>()(...)
```

From src/core/pipeline/InputPipelineRunner.tsx:
```typescript
// Headless React component, renders null
// RAF loop at 30fps that ticks active input plugins (audio/camera/video)
// Writes to ledStateProxy.colors and ledStateProxy.lastUpdated
// Priority: audio > camera > video
export function InputPipelineRunner()
```

Header layout in App.tsx (lines 163-174):
```tsx
<header className="flex items-center justify-between px-4 py-2.5 border-b border-border shrink-0 bg-background/80 backdrop-blur-sm z-10">
  <div className="flex items-center gap-2.5">
    <Box className="w-5 h-5 text-primary" strokeWidth={1.5} />
    <h1 ...>HyperCube</h1>
  </div>
  <div className="flex items-center gap-4">
    <ThemePickerCompact />
    <ConnectionStatus />
  </div>
</header>
```
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Add pipelinePaused state to uiStore and build PlayPauseButton component</name>
  <files>src/core/store/uiStore.ts, src/ui/PlayPauseButton.tsx, src/core/store/__tests__/uiStore.test.ts</files>
  <behavior>
    - TestUIStore_InitialPipelinePaused_IsFalse: pipelinePaused defaults to false
    - TestUIStore_SetPipelinePaused_TogglesToTrue: calling setPipelinePaused(true) sets pipelinePaused to true
    - TestUIStore_SetPipelinePaused_TogglesToFalse: calling setPipelinePaused(false) sets pipelinePaused back to false
    - TestPlayPauseButton_ShowsPauseIcon_WhenNotPaused: renders Pause icon when pipelinePaused is false (playing state)
    - TestPlayPauseButton_ShowsPlayIcon_WhenPaused: renders Play icon when pipelinePaused is true
    - TestPlayPauseButton_TogglesState_OnClick: clicking toggles pipelinePaused in uiStore
  </behavior>
  <action>
    1. Add `pipelinePaused: boolean` and `setPipelinePaused: (paused: boolean) => void` to UIStore interface in `src/core/store/uiStore.ts`. Initialize pipelinePaused to false. Add the setter action.

    2. Update `src/core/store/__tests__/uiStore.test.ts` — add pipelinePaused to the beforeEach reset state. Add the three unit tests from the behavior block above.

    3. Create `src/ui/PlayPauseButton.tsx`:
       - Import `Play` and `Pause` from `lucide-react`
       - Import `uiStore` from `@/core/store/uiStore`
       - Subscribe to `pipelinePaused` via `uiStore((s) => s.pipelinePaused)`
       - Render a button:
         - When not paused (playing): show `Pause` icon (clicking will pause)
         - When paused: show `Play` icon (clicking will resume)
         - On click: call `uiStore.getState().setPipelinePaused(!paused)`
         - Styling: match header aesthetics — use `text-muted-foreground hover:text-foreground transition-colors` on a ghost-style button
         - Size: icon `w-4 h-4`, button padding minimal to match header density
         - Add `aria-label` — "Pause pipeline" when playing, "Resume pipeline" when paused
         - Add `title` attribute matching the aria-label for tooltip
       - Export as named export `PlayPauseButton`
  </action>
  <verify>
    <automated>npx vitest run src/core/store/__tests__/uiStore.test.ts</automated>
  </verify>
  <done>uiStore has pipelinePaused state, PlayPauseButton renders correct icon based on state and toggles on click, all uiStore tests pass</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Wire InputPipelineRunner to respect paused state and mount button in header</name>
  <files>src/core/pipeline/InputPipelineRunner.tsx, src/App.tsx, test/integration/play-pause-pipeline.test.ts, test/scenarios/play-pause-workflow.test.tsx</files>
  <behavior>
    Integration tests (test/integration/play-pause-pipeline.test.ts):
    - TestPipelineRunner_StopsWritingFrames_WhenPaused: when pipelinePaused is true, ledStateProxy.lastUpdated should NOT advance even though RAF tick runs
    - TestPipelineRunner_ResumesWritingFrames_WhenUnpaused: after setting pipelinePaused back to false, ledStateProxy.lastUpdated advances again on tick

    Scenario tests (test/scenarios/play-pause-workflow.test.tsx):
    - TestPlayPause_ButtonVisibleWhenConnected: button appears in header when connection status is 'connected'
    - TestPlayPause_ButtonHiddenWhenDisconnected: button is NOT rendered when connection status is 'disconnected'
    - TestPlayPause_TogglesPipelineOnClick: clicking the button toggles pipelinePaused in store and changes icon
  </behavior>
  <action>
    1. Modify `src/core/pipeline/InputPipelineRunner.tsx`:
       - Import `uiStore` from `@/core/store/uiStore`
       - Inside the `tick()` function, after the frame interval check and before the plugin priority checks, add:
         ```
         const paused = uiStore.getState().pipelinePaused;
         if (paused) return;
         ```
       - This is a direct store read (not a React subscription) since tick() runs in RAF, not in React render. This is the correct pattern — Zustand getState() is synchronous and cheap.
       - The RAF loop itself keeps running (requestAnimationFrame still fires), only the plugin ticking is skipped. This means keep-alive in SACNController (which runs on its own setInterval) is NOT affected — it continues sending the last frame.

    2. Modify `src/App.tsx`:
       - Import `PlayPauseButton` from `@/ui/PlayPauseButton`
       - In the header's right-side div (`<div className="flex items-center gap-4">`), add `<PlayPauseButton />` between `<ThemePickerCompact />` and `<ConnectionStatus />`.
       - But the button should only render when connected. Wrap it conditionally: `{status === 'connected' && <PlayPauseButton />}`. The `status` variable is already available from `connectionStore((state) => state.status)` on line 55.

    3. Create `test/integration/play-pause-pipeline.test.ts`:
       - Import `uiStore`, `ledStateProxy`, and the pipeline tick function
       - Mock audio/camera/video plugins or use the existing MockInputPlugin pattern from test/mocks/mockPlugins
       - Test that when `uiStore.getState().setPipelinePaused(true)` is called, subsequent pipeline ticks do NOT update `ledStateProxy.lastUpdated`
       - Test that when `setPipelinePaused(false)` is called, ticks resume updating ledStateProxy

    4. Create `test/scenarios/play-pause-workflow.test.tsx`:
       - Import render utilities from @testing-library/react
       - Mock the necessary modules (WLEDWebSocketService, WLEDControlService, etc.) following the pattern in test/scenarios/setup-wizard.test.tsx
       - Render App or just the header area
       - Test visibility: set connectionStore status to 'connected' and verify button appears; set to 'disconnected' and verify it disappears
       - Test toggle: click the button, verify uiStore.pipelinePaused changes and icon swaps
  </action>
  <verify>
    <automated>npx vitest run test/integration/play-pause-pipeline.test.ts test/scenarios/play-pause-workflow.test.tsx</automated>
  </verify>
  <done>InputPipelineRunner skips ticking when paused, PlayPauseButton appears in header only when connected, all integration and scenario tests pass, npm run build succeeds with no type errors</done>
</task>

</tasks>

<verification>
1. `npx vitest run src/core/store/__tests__/uiStore.test.ts` — all uiStore unit tests pass
2. `npx vitest run test/integration/play-pause-pipeline.test.ts` — pipeline pausing integration tests pass
3. `npx vitest run test/scenarios/play-pause-workflow.test.tsx` — scenario tests pass
4. `npm run build` — no TypeScript errors, production build succeeds
5. `npm run lint` — no linting errors
</verification>

<success_criteria>
- Play/pause button visible in header bar between theme picker and connection status when connected
- Button hidden when disconnected
- Clicking pause stops InputPipelineRunner from writing new frames to ledStateProxy
- Clicking play resumes frame generation
- sACN keep-alive is unaffected (runs on its own setInterval, not the RAF loop)
- Button shows Pause icon when playing, Play icon when paused
- All three test tiers pass (unit, integration, scenario)
- Build and lint succeed
</success_criteria>

<output>
After completion, create `.planning/quick/3-add-global-play-pause-toggle-button-to-h/3-SUMMARY.md`
</output>
