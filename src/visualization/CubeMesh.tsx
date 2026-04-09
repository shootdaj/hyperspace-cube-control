import { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { ledStateProxy } from '@/core/store/ledStateProxy';
import { computeLEDPositions } from './cubeGeometry';

// Pre-allocate ONE Color instance outside component — NEVER allocate inside useFrame
const _color = new THREE.Color();

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
 */
export function CubeMesh() {
  const meshRef = useRef<THREE.InstancedMesh>(null);

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

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, material, 480]}
    />
  );
}
