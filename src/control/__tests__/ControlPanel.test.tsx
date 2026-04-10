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
    // Controls tab is active by default — should have Power & Brightness section
    expect(screen.getByText('Brightness')).toBeInTheDocument();
  });

  it('renders tabs for panel switching', () => {
    render(<ControlPanel />);
    // The nav uses buttons with aria-label, not role="tab"
    expect(screen.getAllByRole('button', { name: /controls/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: /effects/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: /palettes/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: /presets/i }).length).toBeGreaterThan(0);
  });

  it('tab switching shows correct panel content', async () => {
    const user = userEvent.setup();
    render(<ControlPanel />);

    // Effects tab shows effect list
    const effectBtns = screen.getAllByRole('button', { name: /effects/i });
    await user.click(effectBtns[0]);
    expect(screen.getByText('Solid')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/search effects/i)).toBeInTheDocument();

    // Palettes tab shows palette list
    const paletteBtns = screen.getAllByRole('button', { name: /palettes/i });
    await user.click(paletteBtns[0]);
    expect(screen.getByText('Default')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/search palettes/i)).toBeInTheDocument();

    // Presets tab shows preset panel
    const presetBtns = screen.getAllByRole('button', { name: /presets/i });
    await user.click(presetBtns[0]);
    expect(screen.getByText(/no presets/i)).toBeInTheDocument();
  });

  it('Controls tab shows power, brightness, speed, intensity, colors', async () => {
    const user = userEvent.setup();
    render(<ControlPanel />);
    const controlBtns = screen.getAllByRole('button', { name: /controls/i });
    await user.click(controlBtns[0]);
    expect(screen.getByText('Brightness')).toBeInTheDocument();
    expect(screen.getByText('Speed')).toBeInTheDocument();
    expect(screen.getByText('Intensity')).toBeInTheDocument();
    expect(screen.getByText('Colors')).toBeInTheDocument();
  });
});
