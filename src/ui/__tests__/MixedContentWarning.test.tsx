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

describe('MixedContentWarning', () => {
  it('TestMixedContentWarning_NoIp_RendersNothing', () => {
    vi.stubGlobal('window', { ...window, isSecureContext: true });
    connectionStore.setState({ ip: '' });
    const { container } = render(<MixedContentWarning />);
    expect(container.innerHTML).toBe('');
  });

  it('TestMixedContentWarning_HttpPage_RendersNothing', () => {
    vi.stubGlobal('window', { ...window, isSecureContext: false });
    connectionStore.setState({ ip: '192.168.1.100' });
    const { container } = render(<MixedContentWarning />);
    expect(container.innerHTML).toBe('');
  });

  it('TestMixedContentWarning_HttpsPageWithIp_RendersBanner', () => {
    vi.stubGlobal('window', { ...window, isSecureContext: true });
    connectionStore.setState({ ip: '192.168.1.100' });
    render(<MixedContentWarning />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText(/HTTPS\/HTTP Connection Issue/)).toBeInTheDocument();
  });

  it('TestMixedContentWarning_Banner_ContainsLocalhostUrl', () => {
    vi.stubGlobal('window', { ...window, isSecureContext: true });
    connectionStore.setState({ ip: '192.168.1.100' });
    render(<MixedContentWarning />);
    expect(screen.getByText('http://localhost:5173')).toBeInTheDocument();
  });

  it('TestMixedContentWarning_Banner_HasAlertRole', () => {
    vi.stubGlobal('window', { ...window, isSecureContext: true });
    connectionStore.setState({ ip: '192.168.1.100' });
    render(<MixedContentWarning />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });
});
