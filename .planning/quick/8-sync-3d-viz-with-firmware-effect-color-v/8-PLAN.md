---
id: quick-8
type: quick
description: Sync 3D viz with firmware effect color via REST polling
---

## Task 1: Add ledStateProxy population to WLEDStatePoller

**Files:** src/core/wled/WLEDStatePoller.ts (modify)
**Action:**
1. Read the current WLEDStatePoller.ts
2. The poller already skips when sACN is active (our earlier fix). When sACN is NOT active (firmware effects running), it polls /json/state and updates cubeStateStore.
3. ADD: after updating cubeStateStore, also populate ledStateProxy with the segment's primary color:
   - Read seg[0].col[0] -> [r, g, b]
   - Read bri -> brightness factor = bri / 255
   - Fill ALL 224 LEDs in ledStateProxy.colors with Math.round(r * factor), etc.
   - Set ledStateProxy.lastUpdated = performance.now()
4. Import ledStateProxy and DEFAULT_LED_COUNT
5. This means: when browsing effects, the 3D viz will show the effect's primary color. Not a perfect simulation, but shows the right color.

**Verify:** When selecting an effect in the Effects tab, the 3D viz shows the effect's primary color
**Done:** 3D viz syncs with firmware effects
