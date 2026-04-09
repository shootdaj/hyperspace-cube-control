import 'vitest-webgl-canvas-mock';
import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { Canvas } from '@react-three/fiber';
import { LedBloom } from '../postprocessing/LedBloom';

describe('LedBloom', () => {
  it('TestLedBloom_Renders_WithoutCrashing', () => {
    const { container } = render(
      <Canvas gl={{ antialias: true, toneMapping: 0 }}>
        <LedBloom />
      </Canvas>,
    );
    expect(container.querySelector('canvas')).toBeInTheDocument();
  });

  it('TestLedBloom_ExportsNamedComponent', () => {
    expect(typeof LedBloom).toBe('function');
    expect(LedBloom.name).toBe('LedBloom');
  });

  it('TestLedBloom_InsideCubeScene_CanvasStillPresent', () => {
    // Verify EffectComposer doesn't break the Canvas
    const { container } = render(
      <Canvas gl={{ antialias: true, toneMapping: 0 }}>
        <mesh>
          <boxGeometry />
          <meshBasicMaterial />
        </mesh>
        <LedBloom />
      </Canvas>,
    );
    expect(container.querySelector('canvas')).toBeInTheDocument();
  });
});
