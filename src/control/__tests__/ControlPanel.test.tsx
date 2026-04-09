import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ControlPanel } from '../ControlPanel';
import { cubeStateStore } from '@/core/store/cubeStateStore';
import { connectionStore } from '@/core/store/connectionStore';
import { effectPaletteStore } from '@/core/store/effectPaletteStore';
import { presetStore } from '@/core/store/presetStore';

// Mock WLEDControlService
vi.mock('@/core/wled/WLEDControlService', () => ({
  WLEDControlService: {
    getInstance: () => ({
      setPower: vi.fn().mockResolvedValue(undefined),
      setBrightness: vi.fn().mockResolvedValue(undefined),
      setEffect: vi.fn().mockResolvedValue(undefined),
      setPalette: vi.fn().mockResolvedValue(undefined),
      setSpeed: vi.fn().mockResolvedValue(undefined),
      setIntensity: vi.fn().mockResolvedValue(undefined),
      setColors: vi.fn().mockResolvedValue(undefined),
      batchUpdate: vi.fn().mockResolvedValue(undefined),
    }),
  },
}));

describe('ControlPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    connectionStore.setState({ ip: '10.0.0.1' });
    cubeStateStore.setState({
      on: true, brightness: 128, effectIndex: 0, paletteIndex: 0,
      speed: 128, intensity: 128, colors: [[255, 160, 0], [0, 0, 0], [0, 0, 0]],
    });
    effectPaletteStore.setState({
      effects: ['Solid', 'Blink', 'Breathe'],
      palettes: ['Default', 'Party', 'Cloud'],
    });
    presetStore.setState({ presets: [] });
  });

  it('renders all control sections', () => {
    render(<ControlPanel />);
    // Should have power toggle
    expect(screen.getByText('Power')).toBeInTheDocument();
    // Should have brightness
    expect(screen.getByText('Brightness')).toBeInTheDocument();
  });

  it('renders tabs for panel switching', () => {
    render(<ControlPanel />);
    expect(screen.getByRole('tab', { name: /controls/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /effects/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /palettes/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /presets/i })).toBeInTheDocument();
  });

  it('tab switching shows correct panel content', async () => {
    const user = userEvent.setup();
    render(<ControlPanel />);

    // Effects tab shows effect list
    await user.click(screen.getByRole('tab', { name: /effects/i }));
    expect(screen.getByText('Solid')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/search effects/i)).toBeInTheDocument();

    // Palettes tab shows palette list
    await user.click(screen.getByRole('tab', { name: /palettes/i }));
    expect(screen.getByText('Default')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/search palettes/i)).toBeInTheDocument();

    // Presets tab shows preset panel
    await user.click(screen.getByRole('tab', { name: /presets/i }));
    expect(screen.getByText(/no presets/i)).toBeInTheDocument();
  });

  it('Controls tab shows power, brightness, speed, intensity, colors', async () => {
    const user = userEvent.setup();
    render(<ControlPanel />);
    await user.click(screen.getByRole('tab', { name: /controls/i }));
    expect(screen.getByText('Power')).toBeInTheDocument();
    expect(screen.getByText('Brightness')).toBeInTheDocument();
    expect(screen.getByText('Speed')).toBeInTheDocument();
    expect(screen.getByText('Intensity')).toBeInTheDocument();
    expect(screen.getByText('Colors')).toBeInTheDocument();
  });
});
