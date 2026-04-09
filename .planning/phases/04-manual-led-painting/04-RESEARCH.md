# Phase 4 Research: Manual LED Painting

## 1. Three.js Raycasting on InstancedMesh

**Key finding:** Three.js Raycaster natively supports InstancedMesh. When `raycaster.intersectObject(instancedMesh)` is called, each intersection result includes an `instanceId` property identifying which specific instance was hit.

**R3F integration:** React Three Fiber wraps this in its event system. Pointer events on `<instancedMesh>` include `event.instanceId` directly:

```tsx
<instancedMesh
  onPointerDown={(e) => {
    e.stopPropagation();
    const ledIndex = e.instanceId; // 0-479
  }}
  onPointerMove={(e) => {
    const ledIndex = e.instanceId;
  }}
/>
```

**Source:** Three.js `webgl_instancing_raycast` example; R3F event docs at https://r3f.docs.pmnd.rs/api/events

## 2. R3F Pointer Events on InstancedMesh

R3F provides full pointer event support on InstancedMesh:
- `onPointerDown` - mouse/touch down
- `onPointerMove` - continuous movement (fires while hovering OR dragging)
- `onPointerUp` - mouse/touch release
- `onPointerOver` / `onPointerOut` - enter/leave

**Critical for drag painting:** `onPointerMove` fires continuously during pointer movement. Combined with a `painting` boolean ref (set on pointerDown, cleared on pointerUp), this enables drag painting.

**Pointer capture:** R3F supports `e.target.setPointerCapture(e.pointerId)` to force all subsequent pointer events to the captured target, even if the pointer moves off the mesh. This prevents dropped events during fast drags.

**Performance note:** R3F performs raycasting on every pointer move by default. For 480 small spheres in an InstancedMesh, this is efficient since InstancedMesh raycast tests all instances in one call with bounding sphere pre-check.

## 3. Drag Painting Pattern

**Architecture:**
```
pointerDown → set painting=true, paint current LED
pointerMove → if painting, paint LED under pointer
pointerUp   → set painting=false
```

**Key considerations:**
- Use `useRef` for the `painting` flag (NOT useState) to avoid re-renders
- `onPointerMove` on the InstancedMesh fires only when pointer is over an instance
- For continuous painting between instances, rely on R3F's built-in raycasting which checks all instances on each move
- Track `lastPaintedIndex` ref to avoid redundant writes when pointer stays on same LED
- `e.stopPropagation()` on pointerDown prevents OrbitControls from activating during paint

## 4. Edge and Face Determination

**Cube geometry mapping (from cubeGeometry.ts):**
- 12 edges, 40 LEDs per edge = 480 total
- LED index → edge index: `Math.floor(ledIndex / 40)`
- LED index → position on edge: `ledIndex % 40`

**Edge definitions (from EDGES array):**
```
Edge 0: [0,1] bottom front    Edge 4: [4,5] top front      Edge 8:  [0,4] left front
Edge 1: [1,2] bottom right    Edge 5: [5,6] top right      Edge 9:  [1,5] right front
Edge 2: [2,3] bottom back     Edge 6: [6,7] top back       Edge 10: [2,6] right back
Edge 3: [3,0] bottom left     Edge 7: [7,4] top left       Edge 11: [3,7] left back
```

**Brush sizes:**
1. **Single LED:** Just the clicked LED index
2. **Edge brush:** All 40 LEDs on the same edge: `[edgeIndex * 40, ..., edgeIndex * 40 + 39]`
3. **Face-adjacent brush:** All edges surrounding the face the clicked edge belongs to

**Face-to-edge mapping (6 faces, 4 edges each):**
```
Bottom face: edges 0, 1, 2, 3     (vertices 0-1-2-3)
Top face:    edges 4, 5, 6, 7     (vertices 4-5-6-7)
Front face:  edges 0, 4, 8, 9     (vertices 0-1-5-4)
Right face:  edges 1, 5, 9, 10    (vertices 1-2-6-5)
Back face:   edges 2, 6, 10, 11   (vertices 2-3-7-6)
Left face:   edges 3, 7, 8, 11    (vertices 3-0-4-7)
```

Each edge belongs to exactly 2 faces. For the face-adjacent brush, determine which face the user is painting "towards" (based on camera angle or just use first matching face) and select all 4 edges of that face.

## 5. WLED Latency for Individual LED Writes

**WebSocket JSON path (current architecture):**
- WLED accepts JSON payloads via WebSocket at `ws://[IP]/ws`
- Individual LED control: `{"seg":[{"i":[startIdx, R,G,B, R,G,B, ...]}]}`
- Max 256 LEDs per segment write → 480 LEDs requires 2 chunks

**Latency analysis for paint operations:**
- Single LED paint: tiny JSON payload `{"seg":[{"i":[idx, R,G,B]}]}` → <10ms expected
- Edge paint (40 LEDs): ~120 bytes → single chunk, <15ms expected
- Face paint (160 LEDs): ~480 bytes → single chunk, <20ms expected
- Full 480 LED write: requires 2 sequential chunks → 30-80ms range

**Optimization strategy (optimistic local update + async send):**
1. On paint action: immediately update `ledStateProxy.colors` (perceived latency = 0ms)
2. CubeMesh reads from ledStateProxy in useFrame → 3D visualization updates next frame (~16ms)
3. Asynchronously send to WLED via WebSocket (20-80ms for physical cube)
4. Perceived latency = visualization update time ≈ 16ms (well under 50ms)

**Why WebSocket over REST for painting:**
- WebSocket: no HTTP overhead, persistent connection, fire-and-forget
- REST (WLEDRestClient): serialized queue, request/response overhead
- For real-time painting, use `WLEDWebSocketService.send()` directly (existing method)
- Only send changed LEDs, not full 480 frame (minimize payload)

**Throttling for drag painting:**
- During drag, pointer events fire at 60Hz+
- Throttle WLED sends to ~30fps (every 33ms) to avoid overwhelming ESP32
- Local visualization updates at full frame rate (instant feedback)

## 6. Architecture Decision

**ManualPaintPlugin as InputPlugin:**
- Maintains internal `Uint8Array(480*3)` paint buffer
- `tick()` returns `{ type: 'direct', leds: this.buffer }` every frame
- External paint methods: `setPixel(index, r, g, b)`, `setEdge(edgeIndex, r, g, b)`, `setFace(faceIndex, r, g, b)`, `fill(r, g, b)`
- These mutate the buffer; next `tick()` returns updated state
- Pipeline writes buffer to ledStateProxy → CubeMesh renders it

**Direct WLED send for low-latency:**
- ManualPaintPlugin additionally calls `WLEDWebSocketService.send()` on paint operations
- This bypasses the pipeline's frame-rate throttle for immediate physical feedback
- The pipeline still runs to keep ledStateProxy in sync for visualization

**OrbitControls conflict resolution:**
- When painting mode is active, disable OrbitControls to prevent camera rotation
- Use a Zustand/ref flag: `isPainting` 
- CubeScene reads this flag to enable/disable OrbitControls
