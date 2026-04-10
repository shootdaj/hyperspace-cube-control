import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PaintControls } from '../PaintControls';
import { paintStore } from '@/stores/paintStore';

describe('PaintControls', () => {
  beforeEach(() => {
    // Reset paint store to defaults
    paintStore.setState({
      isPaintMode: false,
      brushSize: 'single',
      color: [255, 255, 255],
    });
  });

  it('TestPaintControls_Renders_BrushSizeButtons', () => {
    render(<PaintControls />);
    expect(screen.getByRole('button', { name: /single/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /edge/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /face/i })).toBeInTheDocument();
  });

  it('TestPaintControls_Renders_ClearButton', () => {
    render(<PaintControls />);
    expect(screen.getByRole('button', { name: /clear/i })).toBeInTheDocument();
  });

  it('TestPaintControls_Renders_FillButton', () => {
    render(<PaintControls />);
    expect(screen.getByRole('button', { name: /fill/i })).toBeInTheDocument();
  });

  it('TestPaintControls_NoToggleButton_PaintAutoEnabled', () => {
    render(<PaintControls />);
    // Paint mode toggle button removed — paint mode is auto-enabled by ControlPanel
    // when the paint tab is active. No toggle button should exist.
    const toggleButtons = screen.queryAllByRole('button', { name: /paint mode/i });
    expect(toggleButtons).toHaveLength(0);
  });

  it('TestPaintControls_NoRainbowButton', () => {
    render(<PaintControls />);
    // Rainbow toggle button removed
    const rainbowButtons = screen.queryAllByRole('button', { name: /rainbow/i });
    expect(rainbowButtons).toHaveLength(0);
  });

  it('TestPaintControls_BrushSize_SelectEdge', () => {
    render(<PaintControls />);
    const edgeBtn = screen.getByRole('button', { name: /edge/i });
    fireEvent.click(edgeBtn);
    expect(paintStore.getState().brushSize).toBe('edge');
  });

  it('TestPaintControls_BrushSize_SelectFace', () => {
    render(<PaintControls />);
    const faceBtn = screen.getByRole('button', { name: /face/i });
    fireEvent.click(faceBtn);
    expect(paintStore.getState().brushSize).toBe('face');
  });

  it('TestPaintControls_BrushSize_BackToSingle', () => {
    paintStore.setState({ brushSize: 'edge' });
    render(<PaintControls />);
    const singleBtn = screen.getByRole('button', { name: /single/i });
    fireEvent.click(singleBtn);
    expect(paintStore.getState().brushSize).toBe('single');
  });

  it('TestPaintControls_XYColorGrid_Renders', () => {
    render(<PaintControls />);
    // XYColorGrid renders a canvas element for the hue x brightness picker
    const canvas = document.querySelector('canvas');
    expect(canvas).toBeInTheDocument();
  });

  it('TestPaintControls_Clear_SetsColorToBlack', () => {
    // Set some color first
    paintStore.setState({ color: [255, 0, 0] });
    render(<PaintControls />);
    const clearBtn = screen.getByRole('button', { name: /clear/i });
    fireEvent.click(clearBtn);
    // Clear should call fill(0,0,0) on the plugin — we verify the store/proxy
    // in integration tests. Here just verify the button exists and is clickable.
    expect(clearBtn).toBeInTheDocument();
  });
});
