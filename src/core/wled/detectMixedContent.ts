/**
 * Detect if connecting to the WLED device will be blocked by HTTPS mixed content policy.
 *
 * Mixed content is blocked when:
 * - The app is served over HTTPS (window.isSecureContext === true), AND
 * - The device IP is not localhost/127.0.0.1 (which are allowed as secure origins)
 *
 * When mixed content is detected, show MixedContentWarning component explaining
 * the user must access the app over HTTP, not HTTPS.
 *
 * @param deviceIp - The WLED device IP address (from connectionStore.ip)
 * @returns true if mixed content will block the connection
 */
export function detectMixedContent(deviceIp: string): boolean {
  if (!deviceIp) return false;

  // localhost and 127.0.0.1 are treated as secure origins by browsers
  // even when the page is on HTTPS -- WebSocket to these always works
  if (deviceIp === 'localhost' || deviceIp === '127.0.0.1') return false;

  // Mixed content blocked when page is HTTPS but device is HTTP
  return typeof window !== 'undefined' && window.isSecureContext;
}
