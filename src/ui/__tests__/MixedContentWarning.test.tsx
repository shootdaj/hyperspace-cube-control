import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { connectionStore } from '@/core/store/connectionStore';
import { MixedContentWarning } from '../MixedContentWarning';

beforeEach(() => {
  connectionStore.setState({ ip: '', status: 'disconnected' });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// The source uses window.location.protocol, not window.isSecureContext
function mockLocationProtocol(protocol: string): void {
  vi.stubGlobal('location', { ...window.location, protocol });
}

describe('MixedContentWarning', () => {
  it('TestMixedContentWarning_NoIp_RendersNothing', () => {
    mockLocationProtocol('https:');
    connectionStore.setState({ ip: '' });
    const { container } = render(<MixedContentWarning />);
    expect(container.innerHTML).toBe('');
  });

  it('TestMixedContentWarning_HttpPage_RendersNothing', () => {
    mockLocationProtocol('http:');
    connectionStore.setState({ ip: '192.168.1.100' });
    const { container } = render(<MixedContentWarning />);
    expect(container.innerHTML).toBe('');
  });

  it('TestMixedContentWarning_HttpsPageWithIp_RendersBanner', () => {
    mockLocationProtocol('https:');
    connectionStore.setState({ ip: '192.168.1.100' });
    render(<MixedContentWarning />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText(/HTTPS\/HTTP Connection Issue/)).toBeInTheDocument();
  });

  it('TestMixedContentWarning_Banner_ContainsLocalhostUrl', () => {
    mockLocationProtocol('https:');
    connectionStore.setState({ ip: '192.168.1.100' });
    render(<MixedContentWarning />);
    expect(screen.getByText('http://localhost:5173')).toBeInTheDocument();
  });

  it('TestMixedContentWarning_Banner_HasAlertRole', () => {
    mockLocationProtocol('https:');
    connectionStore.setState({ ip: '192.168.1.100' });
    render(<MixedContentWarning />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });
});
