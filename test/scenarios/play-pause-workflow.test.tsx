import { describe, it, expect, beforeEach, beforeAll, afterAll, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { server } from '../mocks/virtualCube';
import { connectionStore } from '@/core/store/connectionStore';
import { uiStore } from '@/core/store/uiStore';
import { WLEDWebSocketService } from '@/core/wled/WLEDWebSocketService';
import App from '@/App';

beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }));

beforeEach(() => {
  localStorage.clear();
  connectionStore.setState({ ip: '', status: 'disconnected' });
  uiStore.setState({
    wizardCompleted: false,
    activePluginId: null,
    activePanel: 'control',
    pipelinePaused: false,
  });
  WLEDWebSocketService._resetForTest();
});

afterEach(() => {
  WLEDWebSocketService._resetForTest();
  server.resetHandlers();
});

afterAll(() => server.close());

describe('Play/Pause Workflow Scenarios', () => {
  it('TestPlayPause_ButtonVisibleWhenConnected', async () => {
    // Setup as returning user with completed wizard
    localStorage.setItem('wizardCompleted', 'true');
    localStorage.setItem('hypercube-device-ip', '192.168.1.100');
    connectionStore.setState({ ip: '192.168.1.100', status: 'connected' });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Pause pipeline' })).toBeInTheDocument();
    });
  });

  it('TestPlayPause_ButtonHiddenWhenDisconnected', () => {
    // Setup as returning user but disconnected
    localStorage.setItem('wizardCompleted', 'true');
    localStorage.setItem('hypercube-device-ip', '192.168.1.100');
    connectionStore.setState({ ip: '192.168.1.100', status: 'disconnected' });

    render(<App />);

    expect(screen.queryByRole('button', { name: 'Pause pipeline' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Resume pipeline' })).not.toBeInTheDocument();
  });

  it('TestPlayPause_TogglesPipelineOnClick', async () => {
    const user = userEvent.setup();

    // Setup as connected returning user
    localStorage.setItem('wizardCompleted', 'true');
    localStorage.setItem('hypercube-device-ip', '192.168.1.100');
    connectionStore.setState({ ip: '192.168.1.100', status: 'connected' });

    render(<App />);

    // Initially showing pause button (pipeline is playing)
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Pause pipeline' })).toBeInTheDocument();
    });
    expect(uiStore.getState().pipelinePaused).toBe(false);

    // Click to pause
    await user.click(screen.getByRole('button', { name: 'Pause pipeline' }));
    expect(uiStore.getState().pipelinePaused).toBe(true);

    // Button should now show play icon
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Resume pipeline' })).toBeInTheDocument();
    });

    // Click to resume
    await user.click(screen.getByRole('button', { name: 'Resume pipeline' }));
    expect(uiStore.getState().pipelinePaused).toBe(false);

    // Button should show pause icon again
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Pause pipeline' })).toBeInTheDocument();
    });
  });
});
