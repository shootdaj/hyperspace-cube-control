import { describe, it, expect, vi, beforeEach } from 'vitest';
import { pluginRegistry } from '@/core/pipeline/PluginRegistry';
import { registerVideoPlugins } from '../registerVideoPlugins';

// Mock Worker since it's needed by VideoPlugin and CameraPlugin
class MockWorker {
  onmessage: ((e: MessageEvent) => void) | null = null;
  onerror: ((e: ErrorEvent) => void) | null = null;
  postMessage = vi.fn();
  terminate = vi.fn();
}
vi.stubGlobal('Worker', vi.fn(() => new MockWorker()));

describe('registerVideoPlugins', () => {
  beforeEach(() => {
    registerVideoPlugins();
  });

  it('TestVideoPluginRegistration_RegistersVideoInput', () => {
    expect(pluginRegistry.listInputs()).toContain('video-input');
  });

  it('TestVideoPluginRegistration_RegistersCameraInput', () => {
    expect(pluginRegistry.listInputs()).toContain('camera-input');
  });

  it('TestVideoPluginRegistration_RegistersEdgeSamplingMapping', () => {
    expect(pluginRegistry.listMappings()).toContain('edge-sampling');
  });

  it('TestVideoPluginRegistration_RegistersFaceExtractionMapping', () => {
    expect(pluginRegistry.listMappings()).toContain('face-extraction');
  });

  it('TestVideoPluginRegistration_CreatesValidVideoPlugin', () => {
    const input = pluginRegistry.createInput('video-input');
    expect(input.id).toBe('video-input');
    expect(input.name).toBe('Video Input');
    input.destroy();
  });

  it('TestVideoPluginRegistration_CreatesValidCameraPlugin', () => {
    const input = pluginRegistry.createInput('camera-input');
    expect(input.id).toBe('camera-input');
    expect(input.name).toBe('Camera Input');
    input.destroy();
  });

  it('TestVideoPluginRegistration_CreatesValidEdgeSamplingStrategy', () => {
    const mapping = pluginRegistry.createMapping('edge-sampling');
    expect(mapping.id).toBe('edge-sampling');
  });

  it('TestVideoPluginRegistration_CreatesValidFaceExtractionStrategy', () => {
    const mapping = pluginRegistry.createMapping('face-extraction');
    expect(mapping.id).toBe('face-extraction');
  });
});
