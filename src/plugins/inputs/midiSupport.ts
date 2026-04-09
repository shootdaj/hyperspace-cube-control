/**
 * MIDI feature detection utilities.
 *
 * Checks for Web MIDI API availability BEFORE attempting to use WEBMIDI.js.
 * This allows showing a graceful degradation message on Safari/iOS
 * without triggering errors.
 */

/**
 * Returns true if the browser supports the Web MIDI API.
 * Safari and all iOS browsers return false.
 */
export function isMIDISupported(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    typeof navigator.requestMIDIAccess === 'function'
  );
}

/**
 * Returns a user-friendly message explaining why MIDI is not available.
 */
export function getMIDIUnsupportedMessage(): string {
  const isIOS =
    typeof navigator !== 'undefined' &&
    /iPad|iPhone|iPod/.test(navigator.userAgent);

  const isSafari =
    typeof navigator !== 'undefined' &&
    /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

  if (isIOS) {
    return 'MIDI is not supported on iOS devices. The Web MIDI API is unavailable in all iOS browsers due to platform restrictions. For MIDI control, use a desktop browser like Chrome, Edge, or Firefox.';
  }

  if (isSafari) {
    return 'MIDI is not supported in Safari. Apple has not implemented the Web MIDI API. Please use Chrome, Edge, or Firefox for MIDI controller support.';
  }

  return 'MIDI is not supported in this browser. Please use Chrome, Edge, or Firefox for MIDI controller support.';
}
