import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PresetPanel } from '../PresetPanel';
import { presetStore } from '@/core/store/presetStore';
import { cubeStateStore } from '@/core/store/cubeStateStore';
import { connectionStore } from '@/core/store/connectionStore';

const mockBatchUpdate = vi.fn().mockResolvedValue(undefined);
vi.mock('@/core/wled/WLEDControlService', () => ({
  WLEDControlService: {
    getInstance: () => ({
      batchUpdate: mockBatchUpdate,
    }),
  },
}));

// Mock crypto.randomUUID
let uuidCounter = 100;
vi.stubGlobal('crypto', {
  randomUUID: () => `ui-uuid-${++uuidCounter}`,
});

describe('PresetPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    uuidCounter = 100;
    connectionStore.setState({ ip: '10.0.0.1' });
    cubeStateStore.setState({
      on: true, brightness: 128, effectIndex: 0, paletteIndex: 0,
      speed: 128, intensity: 128, colors: [[255, 160, 0], [0, 0, 0], [0, 0, 0]],
    });
    presetStore.setState({ presets: [] });
    localStorage.removeItem('hypercube-presets');
  });

  it('renders empty state message when no presets', () => {
    render(<PresetPanel />);
    expect(screen.getByText(/no presets/i)).toBeInTheDocument();
  });

  it('renders list of saved presets with names', () => {
    presetStore.setState({
      presets: [
        { id: 'p1', name: 'Sunset', createdAt: 1000, state: { on: true, bri: 128, fx: 0, pal: 0, sx: 128, ix: 128, col: [[255, 0, 0]] } },
        { id: 'p2', name: 'Ocean', createdAt: 2000, state: { on: true, bri: 200, fx: 5, pal: 9, sx: 100, ix: 150, col: [[0, 0, 255]] } },
      ],
    });
    render(<PresetPanel />);
    expect(screen.getByText('Sunset')).toBeInTheDocument();
    expect(screen.getByText('Ocean')).toBeInTheDocument();
  });

  it('"Save Preset" button is visible', () => {
    render(<PresetPanel />);
    expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument();
  });

  it('clicking "Save" opens dialog with name input', async () => {
    const user = userEvent.setup();
    render(<PresetPanel />);
    await user.click(screen.getByRole('button', { name: /save/i }));
    expect(screen.getByPlaceholderText(/preset name/i)).toBeInTheDocument();
  });

  it('submitting dialog saves preset and it appears in list', async () => {
    const user = userEvent.setup();
    render(<PresetPanel />);
    await user.click(screen.getByRole('button', { name: /save/i }));
    const input = screen.getByPlaceholderText(/preset name/i);
    await user.type(input, 'My Preset');
    await user.click(screen.getByRole('button', { name: /^save$/i }));
    expect(screen.getByText('My Preset')).toBeInTheDocument();
  });

  it('clicking a preset applies it', async () => {
    presetStore.setState({
      presets: [
        { id: 'p1', name: 'Apply Me', createdAt: 1000, state: { on: true, bri: 200, fx: 10, pal: 5, sx: 180, ix: 100, col: [[255, 0, 0]] } },
      ],
    });
    const user = userEvent.setup();
    render(<PresetPanel />);
    await user.click(screen.getByRole('button', { name: /apply/i }));
    expect(mockBatchUpdate).toHaveBeenCalled();
  });

  it('delete button removes preset from list', async () => {
    presetStore.setState({
      presets: [
        { id: 'p1', name: 'Delete Me', createdAt: 1000, state: { on: true, bri: 128, fx: 0, pal: 0, sx: 128, ix: 128, col: [[255, 0, 0]] } },
      ],
    });
    const user = userEvent.setup();
    render(<PresetPanel />);
    expect(screen.getByText('Delete Me')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /delete/i }));
    expect(screen.queryByText('Delete Me')).not.toBeInTheDocument();
  });
});
