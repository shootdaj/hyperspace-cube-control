import type { FrameData, MappingStrategy } from '@/core/pipeline/types';
import { EDGE_COUNT, EDGE_LED_COUNTS, getEdgeStartIndex } from '@/core/constants';

/**
 * MIDICCMappingStrategy — converts MIDI CC state to a 224-LED color array.
 *
 * This is a simple visualization: the first mapped CC drives brightness
 * across all LEDs. The FrameData contains a midiCC Map from the MIDIPlugin.
 *
 * NOTE: The primary MIDI use case is parameter control (brightness, speed,
 * intensity, hue), which is handled by MIDIMappingEngine directly in the
 * event handlers. This mapping strategy provides a visual feedback mode
 * showing CC activity on the cube LEDs.
 */
export class MIDICCMappingStrategy implements MappingStrategy {
  readonly id = 'midi-cc';

  map(frame: FrameData, ledCount: number): Uint8Array {
    const result = new Uint8Array(ledCount * 3);

    if (frame.type !== 'midi' || !frame.midiCC) {
      return result;
    }

    // Find the highest CC value for visualization
    let maxValue = 0;
    for (const value of frame.midiCC.values()) {
      if (value > maxValue) maxValue = value;
    }

    // Normalize to 0-255
    const brightness = Math.round((maxValue / 127) * 255);

    // Use different CCs to drive different edge colors
    const ccEntries = Array.from(frame.midiCC.entries());

    for (let edge = 0; edge < EDGE_COUNT; edge++) {
      // Assign CCs round-robin to edges
      const ccEntry = ccEntries[edge % ccEntries.length];
      const ccValue = ccEntry ? ccEntry[1] : 0;
      const edgeBrightness = Math.round((ccValue / 127) * 255);

      // Hue based on edge index for visual variety
      const hue = (edge / EDGE_COUNT) * 360;
      const [r, g, b] = hslToRgb(hue, 1.0, 0.5);

      const ledsOnEdge = EDGE_LED_COUNTS[edge];
      const edgeStart = getEdgeStartIndex(edge);
      for (let led = 0; led < ledsOnEdge; led++) {
        const idx = (edgeStart + led) * 3;
        const scale = edgeBrightness / 255;
        result[idx] = Math.round(r * scale);
        result[idx + 1] = Math.round(g * scale);
        result[idx + 2] = Math.round(b * scale);
      }
    }

    // Apply overall brightness
    if (brightness < 255) {
      const scale = brightness / 255;
      for (let i = 0; i < result.length; i++) {
        result[i] = Math.round(result[i] * scale);
      }
    }

    return result;
  }
}

/** Simple HSL to RGB conversion */
function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;

  if (h < 60) { r = c; g = x; }
  else if (h < 120) { r = x; g = c; }
  else if (h < 180) { g = c; b = x; }
  else if (h < 240) { g = x; b = c; }
  else if (h < 300) { r = x; b = c; }
  else { r = c; b = x; }

  return [
    Math.round((r + m) * 255),
    Math.round((g + m) * 255),
    Math.round((b + m) * 255),
  ];
}
