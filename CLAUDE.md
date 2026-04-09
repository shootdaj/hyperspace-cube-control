# HyperCube Control

## Project
Web-based creative control toolkit for HyperCube 15-SE (480 LED infinity mirror cube, WLED firmware).

## Stack
React 19 + TypeScript + Vite + Three.js (R3F v9) + Tailwind v4 + Zustand/Valtio + shadcn/ui

## Commands
- `npm run dev` — Start dev server
- `npm run build` — Production build
- `npm run lint` — ESLint
- `npx vitest run --dir src` — Unit tests
- `npx vitest run --dir test/integration` — Integration tests
- `npx vitest run --dir test/scenarios` — Scenario tests

# Testing Requirements (AX)

Every feature implementation MUST include tests at all three tiers:

## Test Tiers
1. **Unit tests** — Test individual functions/methods in isolation. Mock external dependencies.
2. **Integration tests** — Test component interactions with real services via mock WLED server.
3. **Scenario tests** — Test full user workflows end-to-end.

## Test Naming
Use semantic names: `Test<Component>_<Behavior>[_<Condition>]`
- Good: `TestWLEDClient_ReconnectsOnDisconnect`, `TestPipelineEngine_SwapsInputAtRuntime`
- Bad: `TestShouldWork`, `Test1`, `TestGivenUserWhenLoginThenSuccess`

## Reference
- See `TEST_GUIDE.md` for requirement-to-test mapping
- Every requirement in ROADMAP.md must map to at least one scenario test
