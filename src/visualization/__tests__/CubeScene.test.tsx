import 'vitest-webgl-canvas-mock';
import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { CubeScene } from '../CubeScene';

describe('CubeScene', () => {
  it('TestCubeScene_Renders_WithoutCrashing', () => {
    const { container } = render(<CubeScene />);
    expect(container.querySelector('canvas')).toBeInTheDocument();
  });
});
