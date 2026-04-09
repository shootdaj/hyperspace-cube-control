import type { InputPlugin, FrameData, PluginContext } from '@/core/pipeline/types';
import { isMIDISupported } from './midiSupport';
import { midiStore, type MIDIDeviceInfo } from '@/stores/midiStore';
import { handleCCMessage, handleNoteOnMessage } from './MIDIMappingEngine';

// Dynamically import webmidi to avoid errors on unsupported browsers
let WebMidiModule: typeof import('webmidi') | null = null;

/**
 * MIDIPlugin — InputPlugin for MIDI controller input.
 *
 * Wraps WEBMIDI.js v3 event stream. Maintains a map of current CC values
 * that tick() returns as FrameData. CC and note-on events are processed
 * by MIDIMappingEngine for parameter control and action triggering.
 *
 * Does NOT create WebMidi connection on construction — call enable()
 * from a user gesture handler to initialize.
 */
export class MIDIPlugin implements InputPlugin {
  readonly id = 'midi-controller';
  readonly name = 'MIDI Controller';

  /** Current CC values: cc number -> raw value 0-127 */
  private ccValues = new Map<number, number>();
  /** Whether the plugin has been enabled */
  private enabled = false;
  /** Listener cleanup functions */
  private cleanupFns: Array<() => void> = [];

  async initialize(_ctx: PluginContext): Promise<void> {
    // Check support and update store
    midiStore.getState().setIsSupported(isMIDISupported());
  }

  /**
   * Returns current CC state as FrameData each tick.
   * Returns null if MIDI is not enabled or no CC data exists.
   */
  tick(_deltaMs: number): FrameData | null {
    if (!this.enabled || this.ccValues.size === 0) return null;
    return { type: 'midi', midiCC: new Map(this.ccValues) };
  }

  /**
   * Enable WEBMIDI.js and start listening for devices.
   * MUST be called from a user gesture handler (Chrome requires it).
   */
  async enable(): Promise<void> {
    if (!isMIDISupported()) {
      midiStore.getState().setError('Web MIDI API is not supported in this browser.');
      midiStore.getState().setIsEnabled(false);
      return;
    }

    try {
      if (!WebMidiModule) {
        WebMidiModule = await import('webmidi');
      }
      const { WebMidi } = WebMidiModule;

      await WebMidi.enable();
      this.enabled = true;
      midiStore.getState().setIsEnabled(true);
      midiStore.getState().setError(null);

      // Enumerate existing devices
      this.updateDeviceList();

      // Listen for device connect/disconnect
      const onConnected = () => this.updateDeviceList();
      const onDisconnected = () => this.updateDeviceList();
      WebMidi.addListener('connected', onConnected);
      WebMidi.addListener('disconnected', onDisconnected);
      this.cleanupFns.push(() => {
        WebMidi.removeListener('connected', onConnected);
        WebMidi.removeListener('disconnected', onDisconnected);
      });

      // Add listeners to all current inputs
      this.attachInputListeners();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to enable MIDI';
      midiStore.getState().setError(message);
      midiStore.getState().setIsEnabled(false);
    }
  }

  /**
   * Update the device list in the store from WEBMIDI.js inputs.
   */
  private updateDeviceList(): void {
    if (!WebMidiModule) return;
    const { WebMidi } = WebMidiModule;
    const devices: MIDIDeviceInfo[] = WebMidi.inputs.map((input) => ({
      id: input.id,
      name: input.name || 'Unknown Device',
      manufacturer: input.manufacturer || 'Unknown',
    }));
    midiStore.getState().setDevices(devices);

    // Re-attach listeners when device list changes (for hot-plug)
    this.detachInputListeners();
    this.attachInputListeners();
  }

  /**
   * Attach CC and note-on listeners to all (or selected) MIDI inputs.
   */
  private attachInputListeners(): void {
    if (!WebMidiModule) return;
    const { WebMidi } = WebMidiModule;
    const selectedId = midiStore.getState().selectedDeviceId;

    const inputs = selectedId
      ? WebMidi.inputs.filter((i) => i.id === selectedId)
      : WebMidi.inputs;

    for (const input of inputs) {
      const onCC = (e: { controller: { number: number }; rawValue: number; message: { channel: number } }) => {
        const channel = e.message.channel;
        const cc = e.controller.number;
        const rawValue = e.rawValue;
        this.ccValues.set(cc, rawValue);
        handleCCMessage(channel, cc, rawValue);
      };

      const onNoteOn = (e: { note: { number: number }; rawVelocity: number; message: { channel: number } }) => {
        const channel = e.message.channel;
        const note = e.note.number;
        const velocity = e.rawVelocity;
        handleNoteOnMessage(channel, note, velocity);
      };

      input.addListener('controlchange', onCC as never);
      input.addListener('noteon', onNoteOn as never);

      this.cleanupFns.push(() => {
        try {
          input.removeListener('controlchange', onCC as never);
          input.removeListener('noteon', onNoteOn as never);
        } catch {
          // Input may have been disconnected
        }
      });
    }
  }

  /**
   * Remove all input-level listeners (not device connect/disconnect).
   */
  private detachInputListeners(): void {
    // We rebuild all cleanup fns in attachInputListeners, so just run them
    // But preserve device-level listeners added in enable()
    // Actually, just remove all and re-add in attachInputListeners
    if (!WebMidiModule) return;
    const { WebMidi } = WebMidiModule;
    for (const input of WebMidi.inputs) {
      try {
        input.removeListener('controlchange');
        input.removeListener('noteon');
      } catch {
        // Input may have been disconnected
      }
    }
  }

  /**
   * Disable MIDI and clean up all listeners.
   */
  disable(): void {
    for (const fn of this.cleanupFns) {
      try { fn(); } catch { /* ignore */ }
    }
    this.cleanupFns = [];
    this.ccValues.clear();
    this.enabled = false;
    midiStore.getState().setIsEnabled(false);

    if (WebMidiModule) {
      try {
        WebMidiModule.WebMidi.disable();
      } catch {
        // May already be disabled
      }
    }
  }

  /**
   * Get current CC values (for testing/display).
   */
  getCCValues(): Map<number, number> {
    return new Map(this.ccValues);
  }

  /**
   * Whether the plugin is currently enabled and receiving MIDI.
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  destroy(): void {
    this.disable();
  }
}
