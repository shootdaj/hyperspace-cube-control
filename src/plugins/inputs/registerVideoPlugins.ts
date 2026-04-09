import { pluginRegistry } from '@/core/pipeline/PluginRegistry';
import { VideoPlugin } from './VideoPlugin';
import { CameraPlugin } from './CameraPlugin';
import { EdgeSamplingStrategy } from '@/plugins/mappings/EdgeSamplingStrategy';
import { FaceExtractionStrategy } from '@/plugins/mappings/FaceExtractionStrategy';

/**
 * Register video and camera plugins in the global PluginRegistry.
 * Call once at app startup.
 */
export function registerVideoPlugins(): void {
  pluginRegistry.registerInput('video-input', () => new VideoPlugin());
  pluginRegistry.registerInput('camera-input', () => new CameraPlugin());
  pluginRegistry.registerMapping('edge-sampling', () => new EdgeSamplingStrategy());
  pluginRegistry.registerMapping('face-extraction', () => new FaceExtractionStrategy());
}
