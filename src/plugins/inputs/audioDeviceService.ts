/**
 * Audio device enumeration service.
 *
 * Wraps navigator.mediaDevices to list available audio input devices.
 * BlackHole and other virtual audio devices appear as regular audioinput entries.
 */

/**
 * Enumerate all audio input devices currently known to the browser.
 * Note: device labels may be empty if getUserMedia permission has not been granted.
 */
export async function enumerateAudioInputs(): Promise<MediaDeviceInfo[]> {
  if (!navigator.mediaDevices?.enumerateDevices) {
    return [];
  }
  const devices = await navigator.mediaDevices.enumerateDevices();
  return devices.filter((d) => d.kind === 'audioinput');
}

/**
 * Request microphone permission (triggering the browser prompt), then enumerate
 * all audio input devices with full labels. The temporary stream is stopped
 * immediately after enumeration.
 */
export async function requestPermissionAndEnumerate(): Promise<MediaDeviceInfo[]> {
  if (!navigator.mediaDevices?.getUserMedia) {
    return [];
  }
  // Request permission — this triggers the browser prompt and populates labels
  const tempStream = await navigator.mediaDevices.getUserMedia({ audio: true });
  // Stop the temporary stream immediately
  for (const track of tempStream.getTracks()) {
    track.stop();
  }
  return enumerateAudioInputs();
}
