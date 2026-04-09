import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PaletteBrowser } from '../PaletteBrowser';
import { effectPaletteStore } from '@/core/store/effectPaletteStore';
import { cubeStateStore } from '@/core/store/cubeStateStore';
import { connectionStore } from '@/core/store/connectionStore';

const mockSetPalette = vi.fn().mockResolvedValue(undefined);

vi.mock('@/core/wled/WLEDControlService', () => ({
  WLEDControlService: {
    getInstance: () => ({
      setPalette: mockSetPalette,
    }),
  },
}));

const TEST_PALETTES = ['Default', 'Random Cycle', 'Primary Color', 'Party', 'Cloud', 'Lava', 'Ocean'];

describe('PaletteBrowser', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    connectionStore.setState({ ip: '10.0.0.1' });
    effectPaletteStore.setState({ palettes: TEST_PALETTES });
    cubeStateStore.setState({ paletteIndex: 0 });
  });

  it('renders list of palette names from effectPaletteStore', () => {
    render(<PaletteBrowser />);
    expect(screen.getByText('Default')).toBeInTheDocument();
    expect(screen.getByText('Party')).toBeInTheDocument();
    expect(screen.getByText('Ocean')).toBeInTheDocument();
  });

  it('active palette is highlighted', () => {
    cubeStateStore.setState({ paletteIndex: 3 });
    render(<PaletteBrowser />);
    const partyItem = screen.getByText('Party').closest('[data-palette-item]');
    expect(partyItem).toHaveAttribute('data-active', 'true');
  });

  it('clicking a palette calls WLEDControlService.setPalette', async () => {
    const user = userEvent.setup();
    render(<PaletteBrowser />);
    await user.click(screen.getByText('Lava'));
    expect(mockSetPalette).toHaveBeenCalledWith(5);
  });

  it('search input filters palette list by name', async () => {
    const user = userEvent.setup();
    render(<PaletteBrowser />);
    const searchInput = screen.getByPlaceholderText(/search/i);
    await user.type(searchInput, 'cloud');
    expect(screen.getByText('Cloud')).toBeInTheDocument();
    expect(screen.queryByText('Party')).not.toBeInTheDocument();
  });

  it('each palette item has min 44px touch target', () => {
    render(<PaletteBrowser />);
    const item = screen.getByText('Default').closest('[data-palette-item]');
    expect(item).toHaveClass('min-h-11');
  });
});
