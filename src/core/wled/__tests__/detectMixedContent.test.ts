import { describe, it, expect, vi, afterEach } from 'vitest';
import { detectMixedContent } from '../detectMixedContent';

// Helper to mock window.isSecureContext
function mockIsSecureContext(value: boolean): void {
  vi.stubGlobal('window', { ...window, isSecureContext: value });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('detectMixedContent', () => {
  it('TestDetectMixedContent_EmptyIp_ReturnsFalse', () => {
    mockIsSecureContext(true);
    expect(detectMixedContent('')).toBe(false);
  });

  it('TestDetectMixedContent_HttpPage_ReturnsFalse', () => {
    mockIsSecureContext(false);
    expect(detectMixedContent('192.168.1.100')).toBe(false);
  });

  it('TestDetectMixedContent_HttpsPage_WithDeviceIp_ReturnsTrue', () => {
    mockIsSecureContext(true);
    expect(detectMixedContent('192.168.1.100')).toBe(true);
  });

  it('TestDetectMixedContent_HttpsPage_WithLocalhost_ReturnsFalse', () => {
    mockIsSecureContext(true);
    expect(detectMixedContent('localhost')).toBe(false);
  });

  it('TestDetectMixedContent_HttpsPage_WithLoopback_ReturnsFalse', () => {
    mockIsSecureContext(true);
    expect(detectMixedContent('127.0.0.1')).toBe(false);
  });
});
