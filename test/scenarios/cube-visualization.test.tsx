import 'vitest-webgl-canvas-mock';
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { server } from '../mocks/virtualCube';
import { WLEDWebSocketService } from '@/core/wled/WLEDWebSocketService';
import { connectionStore } from '@/core/store/connectionStore';
import { ledStateProxy } from '@/core/store/ledStateProxy';
import App from '@/App';

beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }));
afterEach(() => {
  WLEDWebSocketService._resetForTest();
  connectionStore.setState({ ip: '', status: 'disconnected' });
  ledStateProxy.colors.fill(0);
  ledStateProxy.lastUpdated = 0;
  server.resetHandlers();
});
afterAll(() => server.close());

describe('Cube Visualization Scenarios', () => {
  it('TestCubeVisualization_Renders_AfterWizardComplete', () => {
    // Simulate wizard already completed
    localStorage.setItem('wizardCompleted', 'true');

    const { container } = render(<App />);

    // CubeScene should render a canvas
    expect(container.querySelector('canvas')).toBeInTheDocument();
  });

  it('TestCubeVisualization_LiveSync_UpdatesProxy', async () => {
    // Simulate wizard complete and trigger connection
    localStorage.setItem('wizardCompleted', 'true');

    render(<App />);

    // Connect to virtual cube — set IP in store so App.tsx effects run
    connectionStore.getState().setIp('192.168.1.100');
    const ws = WLEDWebSocketService.getInstance();
    ws.connect('192.168.1.100');

    // Wait for connection
    await waitFor(() => {
      expect(connectionStore.getState().status).toBe('connected');
    }, { timeout: 3000 });

    // Wait for live stream data from virtual cube (FF8800)
    await waitFor(() => {
      expect(ledStateProxy.colors[0]).toBe(0xFF);
    }, { timeout: 3000 });

    // Verify RGB values from the mock FF8800
    expect(ledStateProxy.colors[1]).toBe(0x88);
    expect(ledStateProxy.colors[2]).toBe(0x00);
    expect(ledStateProxy.lastUpdated).toBeGreaterThan(0);
  });

  it('TestCubeVisualization_SceneGraph_HasCanvas', () => {
    localStorage.setItem('wizardCompleted', 'true');

    const { container } = render(<App />);

    // R3F Canvas creates a canvas element with display:block style
    const canvas = container.querySelector('canvas');
    expect(canvas).toBeInTheDocument();
    expect(canvas).toBeTruthy();
  });
});
