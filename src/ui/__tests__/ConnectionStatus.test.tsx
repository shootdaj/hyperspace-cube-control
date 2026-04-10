import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { connectionStore } from '@/core/store/connectionStore';
import { ConnectionStatus } from '../ConnectionStatus';

beforeEach(() => {
  connectionStore.setState({ status: 'disconnected', ip: '' });
});

describe('ConnectionStatus', () => {
  it('TestConnectionStatus_Connected_ShowsGreenLabel', () => {
    connectionStore.setState({ status: 'connected' });
    render(<ConnectionStatus />);
    expect(screen.getByText('Connected')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveAttribute('aria-label', 'Connection: Connected');
  });

  it('TestConnectionStatus_Reconnecting_ShowsAmberLabel', () => {
    connectionStore.setState({ status: 'reconnecting' });
    render(<ConnectionStatus />);
    expect(screen.getByText('Reconnecting...')).toBeInTheDocument();
  });

  it('TestConnectionStatus_Connecting_ShowsBlueLabel', () => {
    connectionStore.setState({ status: 'connecting' });
    render(<ConnectionStatus />);
    expect(screen.getByText('Connecting...')).toBeInTheDocument();
  });

  it('TestConnectionStatus_Disconnected_ShowsDisconnectedLabel', () => {
    connectionStore.setState({ status: 'disconnected' });
    render(<ConnectionStatus />);
    expect(screen.getByText('Offline')).toBeInTheDocument();
  });

  it('TestConnectionStatus_DataStatus_MatchesStoreStatus', () => {
    connectionStore.setState({ status: 'connected' });
    render(<ConnectionStatus />);
    const dot = document.querySelector('[data-status]');
    expect(dot).toHaveAttribute('data-status', 'connected');
  });

  it('TestConnectionStatus_StatusChange_CausesRerender', () => {
    connectionStore.setState({ status: 'disconnected' });
    const { rerender } = render(<ConnectionStatus />);
    expect(screen.getByText('Offline')).toBeInTheDocument();

    connectionStore.setState({ status: 'connected' });
    rerender(<ConnectionStatus />);
    expect(screen.getByText('Connected')).toBeInTheDocument();
  });
});
