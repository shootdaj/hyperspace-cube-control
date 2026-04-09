import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ColorPickerPanel, hexToRgb, rgbToHex } from '../ColorPickerPanel';
import { cubeStateStore } from '@/core/store/cubeStateStore';
import { connectionStore } from '@/core/store/connectionStore';

const mockSetColors = vi.fn().mockResolvedValue(undefined);

vi.mock('@/core/wled/WLEDControlService', () => ({
  WLEDControlService: {
    getInstance: () => ({
      setColors: mockSetColors,
    }),
  },
}));

describe('ColorPickerPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    connectionStore.setState({ ip: '10.0.0.1' });
    cubeStateStore.setState({
      colors: [[255, 160, 0], [0, 0, 0], [0, 0, 0]],
    });
  });

  it('renders 3 color swatch buttons', () => {
    render(<ColorPickerPanel />);
    const swatches = screen.getAllByRole('button', { name: /color/i });
    expect(swatches).toHaveLength(3);
  });

  it('color swatches show current colors as background', () => {
    render(<ColorPickerPanel />);
    const swatches = screen.getAllByRole('button', { name: /color/i });
    // First swatch should have orange-ish background
    expect(swatches[0]).toHaveStyle({ backgroundColor: '#ffa000' });
  });

  it('clicking a swatch opens the color picker popover', async () => {
    const user = userEvent.setup();
    render(<ColorPickerPanel />);
    const swatches = screen.getAllByRole('button', { name: /color/i });
    await user.click(swatches[0]);
    // Popover should show hex input
    expect(screen.getByDisplayValue('#ffa000')).toBeInTheDocument();
  });

  it('color swatches are at least 44x44px', () => {
    render(<ColorPickerPanel />);
    const swatches = screen.getAllByRole('button', { name: /color/i });
    swatches.forEach((swatch) => {
      expect(swatch).toHaveClass('min-h-11');
      expect(swatch).toHaveClass('min-w-11');
    });
  });
});

describe('Color conversion utilities', () => {
  it('hexToRgb converts hex to RGB array', () => {
    expect(hexToRgb('#ff0000')).toEqual([255, 0, 0]);
    expect(hexToRgb('#00ff00')).toEqual([0, 255, 0]);
    expect(hexToRgb('#0000ff')).toEqual([0, 0, 255]);
    expect(hexToRgb('#ffa000')).toEqual([255, 160, 0]);
  });

  it('rgbToHex converts RGB array to hex', () => {
    expect(rgbToHex([255, 0, 0])).toBe('#ff0000');
    expect(rgbToHex([0, 255, 0])).toBe('#00ff00');
    expect(rgbToHex([0, 0, 255])).toBe('#0000ff');
    expect(rgbToHex([255, 160, 0])).toBe('#ffa000');
  });

  it('round-trip conversion is lossless', () => {
    const original: [number, number, number] = [128, 64, 192];
    expect(hexToRgb(rgbToHex(original))).toEqual(original);
  });
});
