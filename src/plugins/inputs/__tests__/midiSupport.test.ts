import { describe, it, expect, vi, afterEach } from 'vitest';
import { isMIDISupported, getMIDIUnsupportedMessage } from '../midiSupport';

describe('midiSupport', () => {
  const originalNavigator = globalThis.navigator;

  afterEach(() => {
    // Restore original navigator
    Object.defineProperty(globalThis, 'navigator', {
      value: originalNavigator,
      writable: true,
      configurable: true,
    });
  });

  describe('isMIDISupported', () => {
    it('TestMIDISupport_ReturnsTrueWhenRequestMIDIAccessExists', () => {
      Object.defineProperty(globalThis, 'navigator', {
        value: {
          ...originalNavigator,
          requestMIDIAccess: vi.fn(),
        },
        writable: true,
        configurable: true,
      });
      expect(isMIDISupported()).toBe(true);
    });

    it('TestMIDISupport_ReturnsFalseWhenRequestMIDIAccessMissing', () => {
      Object.defineProperty(globalThis, 'navigator', {
        value: {
          userAgent: originalNavigator?.userAgent ?? '',
        },
        writable: true,
        configurable: true,
      });
      expect(isMIDISupported()).toBe(false);
    });

    it('TestMIDISupport_ReturnsFalseWhenNavigatorUndefined', () => {
      Object.defineProperty(globalThis, 'navigator', {
        value: undefined,
        writable: true,
        configurable: true,
      });
      expect(isMIDISupported()).toBe(false);
    });
  });

  describe('getMIDIUnsupportedMessage', () => {
    it('TestMIDIUnsupported_ReturnsIOSMessageForIPhone', () => {
      Object.defineProperty(globalThis, 'navigator', {
        value: {
          userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)',
        },
        writable: true,
        configurable: true,
      });
      const message = getMIDIUnsupportedMessage();
      expect(message).toContain('iOS');
      expect(message).toContain('Chrome');
    });

    it('TestMIDIUnsupported_ReturnsSafariMessageForSafari', () => {
      Object.defineProperty(globalThis, 'navigator', {
        value: {
          userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Safari/605.1.15',
        },
        writable: true,
        configurable: true,
      });
      const message = getMIDIUnsupportedMessage();
      expect(message).toContain('Safari');
      expect(message).toContain('Chrome');
    });

    it('TestMIDIUnsupported_ReturnsGenericMessageForOtherBrowsers', () => {
      Object.defineProperty(globalThis, 'navigator', {
        value: {
          userAgent: 'Mozilla/5.0 SomeBrowser/1.0',
        },
        writable: true,
        configurable: true,
      });
      const message = getMIDIUnsupportedMessage();
      expect(message).toContain('not supported');
      expect(message).toContain('Chrome');
    });
  });
});
