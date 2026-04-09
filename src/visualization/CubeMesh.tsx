import { useRef, useMemo, useEffect, useCallback } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { ledStateProxy } from '@/core/store/ledStateProxy';
import { computeLEDPositions } from './cubeGeometry';
import { paintPlugin, paintOutput } from '@/plugins/inputs/paintSingleton';
import { paintStore } from '@/stores/paintStore';
import { getEdgeIndex, getEdgeFaces } from '@/plugins/inputs/cubeTopology';

// Pre-allocate ONE Color instance outside component — NEVER allocate inside useFrame
const _color = new THREE.Color();

/**
 * Apply paint to the ManualPaintPlugin buffer and sync to ledStateProxy.
 * Called from pointer event handlers — must be fast, no React state.
 */
function applyPaint(ledIndex: number): void {
  const { color, brushSize } = paintStore.getState();
  const [r, g, b] = color;

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

  // Optimistic local update: copy entire paint buffer to ledStateProxy
  // for instant visual feedback (next useFrame will render it)
  ledStateProxy.colors.set(paintPlugin.getBuffer());
  ledStateProxy.lastUpdated = performance.now();

  // Async send to physical cube — diff-based, throttled to 30fps
  paintOutput.sendPaint(paintPlugin.getBuffer());
}

/**
 * CubeMesh — renders all 480 HyperCube LEDs as InstancedMesh spheres.
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
  const geometry = useMemo(() => new THREE.SphereGeometry(0.012, 6, 6), []);
  const material = useMemo(
    () => new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }),
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
    for (let i = 0; i < 480; i++) {
      // Scale to 0-1.5 range so bright LEDs (near 255) produce HDR values > 1.0
      // Bloom luminanceThreshold=0.5 will pick up LEDs with normalized value > 0.5
      const scale = 1.5 / 255; // maps 255 -> 1.5 (above bloom threshold)
      _color.setRGB(
        buf[i * 3] * scale,
        buf[i * 3 + 1] * scale,
        buf[i * 3 + 2] * scale,
      );
      mesh.setColorAt(i, _color);
    }
    mesh.instanceColor.needsUpdate = true;
  });

  const handlePointerDown = useCallback((e: ThreeEvent<PointerEvent>) => {
    if (!paintStore.getState().isPaintMode) return;
    if (e.instanceId === undefined) return;
    e.stopPropagation();
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
      args={[geometry, material, 480]}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
    />
  );
}
