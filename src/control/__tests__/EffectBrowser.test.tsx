import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EffectBrowser } from '../EffectBrowser';
import { effectPaletteStore } from '@/core/store/effectPaletteStore';
import { cubeStateStore } from '@/core/store/cubeStateStore';
import { connectionStore } from '@/core/store/connectionStore';

const mockSetEffect = vi.fn().mockResolvedValue(undefined);

vi.mock('@/core/wled/WLEDControlService', () => ({
  WLEDControlService: {
    getInstance: () => ({
      setEffect: mockSetEffect,
    }),
  },
}));

const TEST_EFFECTS = ['Solid', 'Blink', 'Breathe', 'Wipe', 'Rainbow', 'RSVD', '-'];

describe('EffectBrowser', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    connectionStore.setState({ ip: '10.0.0.1' });
    effectPaletteStore.setState({ effects: TEST_EFFECTS });
    cubeStateStore.setState({ effectIndex: 0 });
  });

  it('renders list of effect names from store (filters reserved)', () => {
    render(<EffectBrowser />);
    expect(screen.getByText('Solid')).toBeInTheDocument();
    expect(screen.getByText('Blink')).toBeInTheDocument();
    expect(screen.getByText('Rainbow')).toBeInTheDocument();
    // Reserved effects should be filtered out
    expect(screen.queryByText('RSVD')).not.toBeInTheDocument();
  });

  it('active effect is visually highlighted', () => {
    cubeStateStore.setState({ effectIndex: 0 });
    render(<EffectBrowser />);
    const solidItem = screen.getByText('Solid').closest('[data-effect-item]');
    expect(solidItem).toHaveAttribute('data-active', 'true');
  });

  it('clicking an effect calls WLEDControlService.setEffect', async () => {
    const user = userEvent.setup();
    render(<EffectBrowser />);
    await user.click(screen.getByText('Blink'));
    expect(mockSetEffect).toHaveBeenCalledWith(1);
  });

  it('search input filters effect list by name', async () => {
    const user = userEvent.setup();
    render(<EffectBrowser />);
    const searchInput = screen.getByPlaceholderText(/search/i);
    await user.type(searchInput, 'rain');
    expect(screen.getByText('Rainbow')).toBeInTheDocument();
    expect(screen.queryByText('Solid')).not.toBeInTheDocument();
  });

  it('each effect item has min 44px touch target', () => {
    render(<EffectBrowser />);
    const solidItem = screen.getByText('Solid').closest('[data-effect-item]');
    expect(solidItem).toHaveClass('min-h-11');
  });
});
