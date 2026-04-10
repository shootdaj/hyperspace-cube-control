import { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Grid } from '@react-three/drei';
import * as THREE from 'three';
import { CubeMesh } from './CubeMesh';
import { LedBloom } from './postprocessing/LedBloom';
import { paintStore } from '@/stores/paintStore';

/**
 * RendererMonitor — reads renderer.info each frame in dev.
 * Does nothing in production. Lives inside Canvas so it has R3F context.
 */
function RendererMonitor() {
  const frameCount = useRef(0);
  useFrame(({ gl }) => {
    frameCount.current++;
    // Log every 300 frames (~5s at 60fps) in development only
    if (import.meta.env.DEV && frameCount.current % 300 === 0) {
      const info = gl.info;
      console.debug('[R3F] renderer.info', {
        geometries: info.memory.geometries,
        textures: info.memory.textures,
        calls: info.render.calls,
        triangles: info.render.triangles,
      });
    }
  });
  return null;
}

/**
 * PaintAwareControls — wraps OrbitControls and disables rotation when
 * paint mode is active so pointer events reach CubeMesh instead.
 * Zoom always stays enabled for navigation during painting.
 */
function PaintAwareControls() {
  const isPaintMode = paintStore((s) => s.isPaintMode);
  return (
    <OrbitControls
      enableDamping
      dampingFactor={0.05}
      minDistance={0.8}
      maxDistance={3.0}
      enablePan={false}
      enableZoom={true}
      enableRotate={!isPaintMode}
      rotateSpeed={0.8}
      zoomSpeed={0.8}
      touches={{
        ONE: isPaintMode ? (0 as THREE.TOUCH) : THREE.TOUCH.ROTATE,
        TWO: THREE.TOUCH.DOLLY_PAN,
      }}
      makeDefault
    />
  );
}

/**
 * GridFloor — faint grid plane under the cube for spatial grounding.
 * Uses drei's Grid component for clean infinite-grid look.
 */
function GridFloor() {
  const gridColor = useMemo(() => new THREE.Color(0.15, 0.18, 0.25), []);
  const cellColor = useMemo(() => new THREE.Color(0.08, 0.1, 0.15), []);
  return (
    <Grid
      position={[0, -0.52, 0]}
      args={[10, 10]}
      cellSize={0.1}
      cellThickness={0.4}
      cellColor={cellColor}
      sectionSize={0.5}
      sectionThickness={0.8}
      sectionColor={gridColor}
      fadeDistance={4}
      fadeStrength={1.5}
      followCamera={false}
      infiniteGrid
    />
  );
}

/**
 * CubeScene — R3F Canvas shell. Camera, ambient light, OrbitControls.
 *
 * IMPORTANT: Never unmount this component to hide it — use CSS display:none.
 * Unmounting destroys the WebGL context and causes expensive re-creation.
 *
 * Camera position [1.5, 1.5, 1.5] gives isometric-ish view of a 1.0-unit cube.
 * fov=50 keeps perspective distortion minimal for the cube shape.
 * toneMapping: 0 (NoToneMapping) required for HDR bloom colors to pass through.
 */
export function CubeScene() {
  const isPaintMode = paintStore((s) => s.isPaintMode);
  return (
    <Canvas
      camera={{ position: [1.5, 1.5, 1.5], fov: 50, near: 0.01, far: 100 }}
      gl={{ antialias: true, toneMapping: 0 }}
      style={{ width: '100%', height: '100%', cursor: isPaintMode ? 'crosshair' : 'grab' }}
    >
      {/* Dark gradient background — not pure black */}
      <color attach="background" args={['#06060f']} />
      <fog attach="fog" args={['#06060f', 3, 8]} />

      {/* Lighting — brighter ambient + subtle directional fill */}
      <ambientLight intensity={0.5} />
      <directionalLight position={[2, 3, 1]} intensity={0.15} color="#8888cc" />

      <PaintAwareControls />
      <RendererMonitor />

      {/* Grid floor for spatial grounding */}
      <GridFloor />

      <CubeMesh />
      <LedBloom />
    </Canvas>
  );
}
