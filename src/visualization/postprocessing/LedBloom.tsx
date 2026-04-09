import { EffectComposer, Bloom } from '@react-three/postprocessing';
import { KernelSize } from 'postprocessing';

/**
 * LedBloom — EffectComposer with Bloom tuned for LED light sculpture aesthetic.
 *
 * Parameter rationale:
 * - intensity=1.5: Medium-strong bloom for visible glow without washing out dark areas
 * - luminanceThreshold=0.5: CubeMesh scales colors to 0-1.5 range.
 *   LEDs at raw value ~85+ (out of 255) will glow. Dark LEDs won't.
 * - luminanceSmoothing=0.025: Sharp threshold edge — glow appears distinctly on lit LEDs
 * - kernelSize=LARGE: Large blur radius for the characteristic "infinity mirror" soft halo
 * - mipmapBlur=true: Higher quality blur (uses mip pyramid instead of single pass)
 *
 * REQUIRED: Canvas must have gl={{ toneMapping: 0 }} (NoToneMapping).
 * Without this, HDR colors above 1.0 are clipped before reaching Bloom.
 */
export function LedBloom() {
  return (
    <EffectComposer>
      <Bloom
        intensity={1.5}
        luminanceThreshold={0.5}
        luminanceSmoothing={0.025}
        kernelSize={KernelSize.LARGE}
        mipmapBlur
      />
    </EffectComposer>
  );
}
