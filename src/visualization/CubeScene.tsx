import { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { CubeMesh } from './CubeMesh';

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
  return (
    <Canvas
      camera={{ position: [1.5, 1.5, 1.5], fov: 50, near: 0.01, far: 100 }}
      gl={{ antialias: true, toneMapping: 0 }}
      style={{ width: '100%', height: '100%' }}
    >
      <ambientLight intensity={0.05} />
      <OrbitControls
        enableDamping
        dampingFactor={0.05}
        minDistance={0.8}
        maxDistance={3.0}
        enablePan={false}
        enableZoom={true}
        enableRotate={true}
        rotateSpeed={0.8}
        zoomSpeed={0.8}
        touches={{
          ONE: THREE.TOUCH.ROTATE,
          TWO: THREE.TOUCH.DOLLY_PAN,
        }}
        makeDefault
      />
      <RendererMonitor />
      <CubeMesh />
      {/* EffectComposer + Bloom added in 02-05 */}
    </Canvas>
  );
}
