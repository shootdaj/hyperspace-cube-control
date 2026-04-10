import type { WLEDInfo } from './types';

/** Result of a successful WLED device probe */
export interface DiscoveredDevice {
  ip: string;
  name: string;
  ledCount: number;
  brand: string;
}

/** Probe timeout in milliseconds */
const PROBE_TIMEOUT_MS = 800;

/** How many IPs to probe in parallel */
const CONCURRENCY = 20;

/**
 * Probe a single IP for a WLED device by fetching /json/info.
 * Returns null if the IP doesn't respond or isn't WLED.
 */
async function probeIp(ip: string): Promise<DiscoveredDevice | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);

  try {
    const res = await fetch(`http://${ip}/json/info`, {
      signal: controller.signal,
    });
    if (!res.ok) return null;

    const info = (await res.json()) as WLEDInfo;
    // Validate that it looks like a real WLED response
    if (!info.ver || !info.leds) return null;

    return {
      ip,
      name: info.name || info.product || 'WLED Device',
      ledCount: info.leds.count,
      brand: info.brand || info.product || 'WLED',
    };
  } catch {
    // Network error, timeout, non-JSON response — all expected for non-WLED IPs
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Scan a subnet for WLED devices, probing IPs 1-254 with batched concurrency.
 *
 * @param baseIp - First three octets, e.g. "192.168.1"
 * @param onFound - Optional callback invoked each time a device is found (for progressive UI updates)
 * @returns Array of discovered devices
 */
export async function scanSubnet(
  baseIp: string,
  onFound?: (device: DiscoveredDevice) => void,
): Promise<DiscoveredDevice[]> {
  const devices: DiscoveredDevice[] = [];
  const ips = Array.from({ length: 254 }, (_, i) => `${baseIp}.${i + 1}`);

  // Process in batches of CONCURRENCY
  for (let i = 0; i < ips.length; i += CONCURRENCY) {
    const batch = ips.slice(i, i + CONCURRENCY);
    const results = await Promise.all(batch.map(probeIp));

    for (const result of results) {
      if (result) {
        devices.push(result);
        onFound?.(result);
      }
    }
  }

  return devices;
}

/**
 * Attempt to guess the user's local subnet from WebRTC.
 * Falls back to "192.168.1" if detection fails.
 *
 * Note: This uses RTCPeerConnection which works in both regular browsers
 * and Capacitor WebView. It does NOT require any server interaction.
 */
export async function detectSubnet(): Promise<string> {
  try {
    const pc = new RTCPeerConnection({ iceServers: [] });
    pc.createDataChannel('');
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    return new Promise<string>((resolve) => {
      const timeout = setTimeout(() => {
        pc.close();
        resolve('192.168.1');
      }, 1500);

      pc.onicecandidate = (event) => {
        if (!event.candidate?.candidate) return;
        const match = event.candidate.candidate.match(
          /(\d{1,3}\.\d{1,3}\.\d{1,3})\.\d{1,3}/,
        );
        if (match && !match[1].startsWith('0.') && match[1] !== '127.0.0') {
          clearTimeout(timeout);
          pc.close();
          resolve(match[1]);
        }
      };
    });
  } catch {
    return '192.168.1';
  }
}

/**
 * High-level convenience function: detect subnet and scan for WLED devices.
 *
 * @param onFound - Optional progressive callback as devices are discovered
 * @returns Array of all discovered devices
 */
export async function scanForDevices(
  onFound?: (device: DiscoveredDevice) => void,
): Promise<DiscoveredDevice[]> {
  const subnet = await detectSubnet();
  return scanSubnet(subnet, onFound);
}
