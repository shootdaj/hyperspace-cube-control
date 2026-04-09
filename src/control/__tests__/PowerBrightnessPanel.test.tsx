import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PowerBrightnessPanel } from '../PowerBrightnessPanel';
import { cubeStateStore } from '@/core/store/cubeStateStore';
import { connectionStore } from '@/core/store/connectionStore';

// Polyfill PointerEvent for jsdom (required by base-ui Switch)
if (typeof globalThis.PointerEvent === 'undefined') {
  class PointerEventPolyfill extends MouseEvent {
    readonly pointerId: number;
    readonly pointerType: string;
    constructor(type: string, params: PointerEventInit = {}) {
      super(type, params);
      this.pointerId = params.pointerId ?? 0;
      this.pointerType = params.pointerType ?? '';
    }
  }
  globalThis.PointerEvent = PointerEventPolyfill as unknown as typeof PointerEvent;
}

// Mock WLEDControlService
const mockSetPower = vi.fn().mockResolvedValue(undefined);
const mockSetBrightness = vi.fn().mockResolvedValue(undefined);

vi.mock('@/core/wled/WLEDControlService', () => ({
  WLEDControlService: {
    getInstance: () => ({
      setPower: mockSetPower,
      setBrightness: mockSetBrightness,
    }),
  },
}));

describe('PowerBrightnessPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    connectionStore.setState({ ip: '10.0.0.1' });
    cubeStateStore.setState({
      on: true,
      brightness: 128,
    });
  });

  it('renders power toggle switch reflecting store state', () => {
    render(<PowerBrightnessPanel />);
    const toggle = screen.getByRole('switch');
    expect(toggle).toBeInTheDocument();
    expect(toggle).toHaveAttribute('aria-checked', 'true');
  });

  it('clicking toggle calls WLEDControlService.setPower with toggled value', async () => {
    cubeStateStore.setState({ on: true });
    render(<PowerBrightnessPanel />);
    const user = userEvent.setup();
    const toggle = screen.getByRole('switch');
    await user.click(toggle);
    expect(mockSetPower).toHaveBeenCalledWith(false);
  });

  it('renders brightness slider with current value', () => {
    cubeStateStore.setState({ brightness: 200 });
    render(<PowerBrightnessPanel />);
    // base-ui slider renders a hidden input[type=range] with aria-valuenow
    const slider = screen.getByRole('slider', { hidden: true });
    expect(slider).toBeInTheDocument();
    expect(slider).toHaveAttribute('aria-valuenow', '200');
  });

  it('renders brightness numeric label', () => {
    cubeStateStore.setState({ brightness: 200 });
    render(<PowerBrightnessPanel />);
    expect(screen.getByText('200')).toBeInTheDocument();
  });

  it('renders power label', () => {
    render(<PowerBrightnessPanel />);
    expect(screen.getByText('Power')).toBeInTheDocument();
  });

  it('renders brightness label', () => {
    render(<PowerBrightnessPanel />);
    expect(screen.getByText('Brightness')).toBeInTheDocument();
  });
});
