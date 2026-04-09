import { pluginRegistry } from '@/core/pipeline/PluginRegistry';
import { MIDIPlugin } from './MIDIPlugin';
import { MIDICCMappingStrategy } from '@/plugins/mappings/MIDICCMappingStrategy';

/**
 * Register MIDI plugins in the global PluginRegistry.
 * Call once at app startup.
 */
export function registerMIDIPlugins(): void {
  pluginRegistry.registerInput('midi-controller', () => new MIDIPlugin());
  pluginRegistry.registerMapping('midi-cc', () => new MIDICCMappingStrategy());
}
