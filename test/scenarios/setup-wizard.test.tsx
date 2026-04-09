import { describe, it, expect, beforeAll, afterAll, afterEach, beforeEach } from 'vitest';
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
  uiStore.setState({ wizardCompleted: false, activePluginId: null, activePanel: 'control' });
  WLEDWebSocketService._resetForTest();
});

afterEach(() => {
  WLEDWebSocketService._resetForTest();
  server.resetHandlers();
});

afterAll(() => server.close());

describe('Setup Wizard Scenarios', () => {
  it('TestSetupWizard_FirstLaunch_FullFlow', async () => {
    const user = userEvent.setup();
    render(<App />);

    // Wizard should be visible
    expect(screen.getByText('Connect to HyperCube')).toBeInTheDocument();

    // Enter IP and connect
    await user.type(screen.getByLabelText(/IP Address/i), '192.168.1.100');
    await user.click(screen.getByRole('button', { name: /Connect/i }));

    // Wait for connection confirmation
    await waitFor(() => {
      expect(screen.getByText('Connected!')).toBeInTheDocument();
    });
    expect(screen.getByText('HyperCube')).toBeInTheDocument();
    expect(screen.getByText('480 LEDs')).toBeInTheDocument();

    // Advance to tour
    await user.click(screen.getByRole('button', { name: /Next/i }));
    expect(screen.getByText('What can you do?')).toBeInTheDocument();

    // Complete wizard
    await user.click(screen.getByRole('button', { name: /Get Started/i }));

    // Wizard should be gone, main UI visible
    await waitFor(() => {
      expect(screen.queryByText('Connect to HyperCube')).not.toBeInTheDocument();
    });

    // Check persistence
    expect(localStorage.getItem('wizardCompleted')).toBe('true');
    expect(connectionStore.getState().ip).toBe('192.168.1.100');
  });

  it('TestSetupWizard_Skip_DismissesAndPersists', async () => {
    const user = userEvent.setup();
    render(<App />);

    // Wizard should be visible
    expect(screen.getByText('Connect to HyperCube')).toBeInTheDocument();

    // Click skip
    await user.click(screen.getByLabelText(/Skip/i));

    // Wizard should be gone
    await waitFor(() => {
      expect(screen.queryByText('Connect to HyperCube')).not.toBeInTheDocument();
    });

    // Check persistence
    expect(localStorage.getItem('wizardCompleted')).toBe('true');
  });

  it('TestSetupWizard_ReturningUser_NoWizard', () => {
    localStorage.setItem('wizardCompleted', 'true');
    render(<App />);

    // Wizard should NOT appear
    expect(screen.queryByText('Connect to HyperCube')).not.toBeInTheDocument();

    // Main UI should be visible
    expect(screen.getByText('HyperCube Control')).toBeInTheDocument();
    // CubeScene renders a canvas element when wizard is complete
    expect(document.querySelector('canvas')).toBeInTheDocument();
  });

  it('TestSetupWizard_AfterCompletion_ConnectionStatusVisible', async () => {
    const user = userEvent.setup();
    render(<App />);

    // Skip wizard to get to main UI quickly
    await user.click(screen.getByLabelText(/Skip/i));

    await waitFor(() => {
      // ConnectionStatus should be in the header
      expect(screen.getByRole('status')).toBeInTheDocument();
    });
  });
});
