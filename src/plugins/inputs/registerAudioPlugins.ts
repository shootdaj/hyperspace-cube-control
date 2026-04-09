import { pluginRegistry } from '@/core/pipeline/PluginRegistry';
import { AudioPlugin } from './AudioPlugin';
import { AudioSpectrumMappingStrategy } from '@/plugins/mappings/AudioSpectrumMappingStrategy';

/**
 * Register audio-reactive plugins in the global PluginRegistry.
 * Call once at app startup.
 */
export function registerAudioPlugins(): void {
  pluginRegistry.registerInput('audio-reactive', () => new AudioPlugin());
  pluginRegistry.registerMapping('audio-spectrum', () => new AudioSpectrumMappingStrategy());
}
