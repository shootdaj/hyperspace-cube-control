import { describe, it, expect, vi, afterEach } from 'vitest';
import { detectMixedContent } from '../detectMixedContent';

// Helper to mock window.location.protocol (the function reads protocol, not isSecureContext)
function mockLocationProtocol(protocol: string): void {
  vi.stubGlobal('location', { ...window.location, protocol });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('detectMixedContent', () => {
  it('TestDetectMixedContent_EmptyIp_ReturnsFalse', () => {
    mockLocationProtocol('https:');
    expect(detectMixedContent('')).toBe(false);
  });

  it('TestDetectMixedContent_HttpPage_ReturnsFalse', () => {
    mockLocationProtocol('http:');
    expect(detectMixedContent('192.168.1.100')).toBe(false);
  });

  it('TestDetectMixedContent_HttpsPage_WithDeviceIp_ReturnsTrue', () => {
    mockLocationProtocol('https:');
    expect(detectMixedContent('192.168.1.100')).toBe(true);
  });

  it('TestDetectMixedContent_HttpsPage_WithLocalhost_ReturnsFalse', () => {
    mockLocationProtocol('https:');
    expect(detectMixedContent('localhost')).toBe(false);
  });

  it('TestDetectMixedContent_HttpsPage_WithLoopback_ReturnsFalse', () => {
    mockLocationProtocol('https:');
    expect(detectMixedContent('127.0.0.1')).toBe(false);
  });
});
