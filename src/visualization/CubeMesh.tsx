import { useRef, useMemo, useEffect, useCallback } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { ledStateProxy } from '@/core/store/ledStateProxy';
import { computeLEDPositions } from './cubeGeometry';
import { paintPlugin } from '@/plugins/inputs/paintSingleton';
import { paintStore } from '@/stores/paintStore';
import { getEdgeIndex, getEdgeFaces } from '@/plugins/inputs/cubeTopology';
import { hslToRgb } from '@/plugins/mappings/AudioSpectrumMappingStrategy';
import { SACNController } from '@/core/wled/SACNController';
import { connectionStore } from '@/core/store/connectionStore';
import { DEFAULT_LED_COUNT, DEFAULT_FRAME_SIZE, BYTES_PER_LED } from '@/core/constants';

// Pre-allocate ONE Color instance outside component — NEVER allocate inside useFrame
const _color = new THREE.Color();

// Pre-allocated buffer for sACN bridge — 224 LEDs x 3 bytes
// Written in useFrame, sent to SACNController. NEVER allocate in useFrame.
const _sacnFrame = new Uint8Array(DEFAULT_FRAME_SIZE);
let _lastSacnSendTime = 0;
const _SACN_SEND_INTERVAL_MS = 33; // ~30fps — matches keep-alive rate

// Flag checked by useFrame to force an immediate sACN send after paint.
// Set by applyPaint(), cleared by useFrame after sending.
let _paintDirty = false;

// REST fallback throttle for when sACN is unavailable
let _lastRestSendTime = 0;
const _REST_SEND_INTERVAL_MS = 33; // ~30fps

/**
 * Send the full LED buffer to the cube via REST API.
 *
 * Uses WLED's seg.i format with hex color strings.
 * This is the fallback path when sACN bridge is not active/connected.
 * Throttled to ~30fps to avoid overwhelming the ESP32.
 */
function sendPaintViaRest(buffer: Uint8Array): void {
  const now = performance.now();
  if (now - _lastRestSendTime < _REST_SEND_INTERVAL_MS) return;
  _lastRestSendTime = now;

  const ip = connectionStore.getState().ip;
  if (!ip) return;

  // Build seg.i payload: [startIndex, "hex1", "hex2", ...] for all 224 LEDs.
  // Sending the full buffer every time ensures the cube shows exactly what
  // the 3D viz shows, avoiding stale state from the firmware effect loop.
  const payload: (number | string)[] = [0]; // start at LED 0
  for (let i = 0; i < DEFAULT_LED_COUNT; i++) {
    const off = i * BYTES_PER_LED;
    const r = buffer[off];
    const g = buffer[off + 1];
    const b = buffer[off + 2];
    payload.push(
      (r < 16 ? '0' : '') + r.toString(16) +
      (g < 16 ? '0' : '') + g.toString(16) +
      (b < 16 ? '0' : '') + b.toString(16),
    );
  }

  fetch(`http://${ip}/json/state`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ seg: { i: payload } }),
  }).catch(() => {});
}

/**
 * Apply paint to the ManualPaintPlugin buffer and sync to ledStateProxy.
 * Called from pointer event handlers — must be fast, no React state.
 *
 * Output strategy:
 * - Primary: sACN bridge in useFrame reads ledStateProxy.colors and sends
 *   to the cube. _paintDirty flag forces immediate send (bypasses 33ms throttle).
 * - Fallback: When sACN is not active, sends full LED state via REST API.
 *   Uses seg.i with the complete buffer (not diff-based) because WLED's
 *   firmware effect can overwrite partial updates.
 */
function applyPaint(ledIndex: number): void {
  const state = paintStore.getState();
  const { brushSize } = state;

  let r: number, g: number, b: number;
  if (state.rainbowMode) {
    const hue = state.incrementRainbowHueCounter();
    [r, g, b] = hslToRgb(hue, 1.0, 0.5);
    state.setColor([r, g, b]);
  } else {
    [r, g, b] = state.color;
  }

  switch (brushSize) {
    case 'single':
      paintPlugin.setPixel(ledIndex, r, g, b);
      break;
    case 'edge':
      paintPlugin.setEdge(getEdgeIndex(ledIndex), r, g, b);
      break;
    case 'face': {
      const edgeIdx = getEdgeIndex(ledIndex);
      const faces = getEdgeFaces(edgeIdx);
      // Use first face (deterministic for now)
      paintPlugin.setFaceEdges(faces[0], r, g, b);
      break;
    }
  }

  // Copy entire paint buffer to ledStateProxy for instant visual feedback
  // (next useFrame will render it AND send via sACN)
  const buf = paintPlugin.getBuffer();
  ledStateProxy.colors.set(buf);
  ledStateProxy.lastUpdated = performance.now();

  // Signal useFrame to send immediately via sACN (bypass 33ms throttle)
  _paintDirty = true;

  // REST fallback: when sACN is not active, send directly via REST
  let sacnActive = false;
  try { sacnActive = SACNController.getInstance().isActive(); } catch { /* not init */ }
  if (!sacnActive) {
    sendPaintViaRest(buf);
  }
}

/**
 * CubeMesh — renders all 224 HyperCube LEDs as InstancedMesh spheres.
 *
 * Hot path: useFrame reads ledStateProxy.colors DIRECTLY (not useSnapshot).
 * useSnapshot would create React subscriptions -> 60 re-renders/sec -> performance collapse.
 *
 * Material: MeshBasicMaterial with vertexColors:true + toneMapped:false
 * Using MeshBasicMaterial (not MeshStandardMaterial) because:
 *   - emissive is not per-instance on MeshStandardMaterial
 *   - MeshBasicMaterial + toneMapped:false + colors>1.0 -> Bloom detects HDR values
 *   - Simpler (no lighting calculations)
 *
 * Paint interaction: When paintStore.isPaintMode is true, pointer events on the
 * InstancedMesh trigger paint operations via ManualPaintPlugin. pointerDown starts
 * painting, pointerMove continues it (drag paint), pointerUp stops.
 */
export function CubeMesh() {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const paintingRef = useRef(false);
  const lastPaintedRef = useRef(-1);

  const positions = useMemo(() => computeLEDPositions(), []);

  // useMemo — NEVER create geometry/material outside useMemo in R3F components.
  // Without memoization, new objects are created on every React re-render.
  const geometry = useMemo(() => new THREE.SphereGeometry(0.025, 8, 8), []);
  const material = useMemo(
    () => new THREE.MeshBasicMaterial({ toneMapped: false }),
    [],
  );

  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;

    const dummy = new THREE.Object3D();
    const black = new THREE.Color(0, 0, 0);

    positions.forEach((pos, i) => {
      dummy.position.copy(pos);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      // CRITICAL: Call setColorAt for ALL instances at mount to pre-allocate
      // instanceColor buffer. Without this, instanceColor is null and useFrame crashes.
      mesh.setColorAt(i, black);
    });

    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;

    // Cleanup: dispose GPU resources on unmount to prevent memory leaks
    return () => {
      geometry.dispose();
      material.dispose();
    };
  }, [positions, geometry, material]);

  // Hot path — runs every R3F frame (up to device refresh rate, typically 60fps)
  useFrame(() => {
    const mesh = meshRef.current;
    if (!mesh?.instanceColor) return;

    // Direct Valtio proxy read — no subscription, no re-render
    const buf = ledStateProxy.colors;
    const count = Math.min(positions.length, DEFAULT_LED_COUNT);
    for (let i = 0; i < count; i++) {
      const r = buf[i * 3];
      const g = buf[i * 3 + 1];
      const b = buf[i * 3 + 2];
      if (r === 0 && g === 0 && b === 0) {
        // Dim glow for off LEDs so cube shape stays visible
        _color.setRGB(0.06, 0.06, 0.08);
      } else {
        // Scale to 0-3.0 range so bright LEDs produce strong HDR values for bloom
        const scale = 3.0 / 255;
        _color.setRGB(r * scale, g * scale, b * scale);
      }
      mesh.setColorAt(i, _color);
    }
    mesh.instanceColor.needsUpdate = true;

    // Bridge ledStateProxy to sACN: when sACN is running, copy the first 224 LEDs
    // from ledStateProxy and send to the physical cube — for ALL input modes
    // (paint, audio, camera, video). Throttled to ~30fps.
    //
    // _paintDirty bypasses the throttle so paint clicks are sent immediately
    // (within one frame = ~16ms) instead of waiting up to 33ms.
    {
      const now = performance.now();
      const shouldSend = _paintDirty || (now - _lastSacnSendTime >= _SACN_SEND_INTERVAL_MS);
      if (shouldSend) {
        try {
          const sacn = SACNController.getInstance();
          if (sacn.isActive()) {
            // Copy first 672 bytes (224 LEDs x 3) from the proxy buffer
            _sacnFrame.set(buf.subarray(0, DEFAULT_FRAME_SIZE));
            sacn.sendFrame(_sacnFrame);
            _lastSacnSendTime = now;
          }
        } catch {
          // SACNController not initialized — ignore
        }
        _paintDirty = false;
      }
    }
  });

  const handlePointerDown = useCallback((e: ThreeEvent<PointerEvent>) => {
    if (!paintStore.getState().isPaintMode) return;
    if (e.instanceId === undefined) return;
    e.stopPropagation();
    if (paintStore.getState().rainbowMode) {
      paintStore.getState().resetRainbowHueCounter();
    }
    paintingRef.current = true;
    lastPaintedRef.current = e.instanceId;
    applyPaint(e.instanceId);
  }, []);

  const handlePointerMove = useCallback((e: ThreeEvent<PointerEvent>) => {
    if (!paintingRef.current) return;
    if (e.instanceId === undefined) return;
    if (e.instanceId === lastPaintedRef.current) return;
    e.stopPropagation();
    lastPaintedRef.current = e.instanceId;
    applyPaint(e.instanceId);
  }, []);

  const handlePointerUp = useCallback(() => {
    paintingRef.current = false;
    lastPaintedRef.current = -1;
  }, []);

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, material, DEFAULT_LED_COUNT]}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
    />
  );
}
