import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { uiStore } from '@/core/store/uiStore';
import { PlayPauseButton } from '../PlayPauseButton';

beforeEach(() => {
  uiStore.setState({ pipelinePaused: false });
});

describe('PlayPauseButton', () => {
  it('TestPlayPauseButton_ShowsPauseIcon_WhenNotPaused', () => {
    uiStore.setState({ pipelinePaused: false });
    render(<PlayPauseButton />);
    const button = screen.getByRole('button', { name: 'Pause pipeline' });
    expect(button).toBeInTheDocument();
    expect(button).toHaveAttribute('title', 'Pause pipeline');
  });

  it('TestPlayPauseButton_ShowsPlayIcon_WhenPaused', () => {
    uiStore.setState({ pipelinePaused: true });
    render(<PlayPauseButton />);
    const button = screen.getByRole('button', { name: 'Resume pipeline' });
    expect(button).toBeInTheDocument();
    expect(button).toHaveAttribute('title', 'Resume pipeline');
  });

  it('TestPlayPauseButton_TogglesState_OnClick', async () => {
    const user = userEvent.setup();
    uiStore.setState({ pipelinePaused: false });
    render(<PlayPauseButton />);

    // Initially showing Pause (playing state)
    expect(screen.getByRole('button', { name: 'Pause pipeline' })).toBeInTheDocument();

    // Click to pause
    await user.click(screen.getByRole('button', { name: 'Pause pipeline' }));
    expect(uiStore.getState().pipelinePaused).toBe(true);

    // Click to resume
    await user.click(screen.getByRole('button', { name: 'Resume pipeline' }));
    expect(uiStore.getState().pipelinePaused).toBe(false);
  });
});
