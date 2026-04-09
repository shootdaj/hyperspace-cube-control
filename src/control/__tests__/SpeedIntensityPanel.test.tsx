import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SpeedIntensityPanel } from '../SpeedIntensityPanel';
import { cubeStateStore } from '@/core/store/cubeStateStore';
import { connectionStore } from '@/core/store/connectionStore';

vi.mock('@/core/wled/WLEDControlService', () => ({
  WLEDControlService: {
    getInstance: () => ({
      setSpeed: vi.fn().mockResolvedValue(undefined),
      setIntensity: vi.fn().mockResolvedValue(undefined),
    }),
  },
}));

describe('SpeedIntensityPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    connectionStore.setState({ ip: '10.0.0.1' });
    cubeStateStore.setState({ speed: 128, intensity: 128 });
  });

  it('renders speed slider with current value', () => {
    cubeStateStore.setState({ speed: 200 });
    render(<SpeedIntensityPanel />);
    const sliders = screen.getAllByRole('slider', { hidden: true });
    // First slider is speed
    expect(sliders[0]).toHaveAttribute('aria-valuenow', '200');
  });

  it('renders intensity slider with current value', () => {
    cubeStateStore.setState({ intensity: 150 });
    render(<SpeedIntensityPanel />);
    const sliders = screen.getAllByRole('slider', { hidden: true });
    // Second slider is intensity
    expect(sliders[1]).toHaveAttribute('aria-valuenow', '150');
  });

  it('renders speed numeric label', () => {
    cubeStateStore.setState({ speed: 200 });
    render(<SpeedIntensityPanel />);
    expect(screen.getByText('200')).toBeInTheDocument();
  });

  it('renders intensity numeric label', () => {
    cubeStateStore.setState({ intensity: 150 });
    render(<SpeedIntensityPanel />);
    expect(screen.getByText('150')).toBeInTheDocument();
  });

  it('renders Speed label', () => {
    render(<SpeedIntensityPanel />);
    expect(screen.getByText('Speed')).toBeInTheDocument();
  });

  it('renders Intensity label', () => {
    render(<SpeedIntensityPanel />);
    expect(screen.getByText('Intensity')).toBeInTheDocument();
  });
});
