import { describe, it, expect, beforeEach } from 'vitest';
import { PluginRegistry } from '../PluginRegistry';
import { MockInputPlugin, MockMappingStrategy, MockOutputPlugin } from '../../../../test/mocks/mockPlugins';

describe('PluginRegistry', () => {
  let registry: PluginRegistry;

  beforeEach(() => {
    registry = new PluginRegistry();
  });

  describe('Input plugins', () => {
    it('TestPluginRegistry_RegisterInput_ListsTheId', () => {
      registry.registerInput('mock-input', () => new MockInputPlugin());
      expect(registry.listInputs()).toContain('mock-input');
    });

    it('TestPluginRegistry_CreateInput_ReturnsNewInstance', () => {
      registry.registerInput('mock-input', () => new MockInputPlugin());
      const plugin = registry.createInput('mock-input');
      expect(plugin.id).toBe('mock-input');
      expect(plugin.name).toBe('Mock Input');
    });

    it('TestPluginRegistry_CreateInput_ThrowsForUnknownId', () => {
      expect(() => registry.createInput('nonexistent')).toThrow('Unknown input plugin: nonexistent');
    });

    it('TestPluginRegistry_CreateInput_ReturnsNewInstanceEachCall', () => {
      registry.registerInput('mock-input', () => new MockInputPlugin());
      const a = registry.createInput('mock-input');
      const b = registry.createInput('mock-input');
      expect(a).not.toBe(b);
    });
  });

  describe('Mapping strategies', () => {
    it('TestPluginRegistry_RegisterMapping_ListsTheId', () => {
      registry.registerMapping('mock-mapping', () => new MockMappingStrategy());
      expect(registry.listMappings()).toContain('mock-mapping');
    });

    it('TestPluginRegistry_CreateMapping_ThrowsForUnknownId', () => {
      expect(() => registry.createMapping('nonexistent')).toThrow('Unknown mapping strategy: nonexistent');
    });
  });

  describe('Output plugins', () => {
    it('TestPluginRegistry_RegisterOutput_ListsTheId', () => {
      registry.registerOutput('mock-output', () => new MockOutputPlugin());
      expect(registry.listOutputs()).toContain('mock-output');
    });

    it('TestPluginRegistry_CreateOutput_ThrowsForUnknownId', () => {
      expect(() => registry.createOutput('nonexistent')).toThrow('Unknown output plugin: nonexistent');
    });
  });

  describe('Multiple registrations', () => {
    it('TestPluginRegistry_ListInputs_ReturnsAllRegisteredIds', () => {
      registry.registerInput('plugin-a', () => new MockInputPlugin());
      registry.registerInput('plugin-b', () => new MockInputPlugin());
      const list = registry.listInputs();
      expect(list).toContain('plugin-a');
      expect(list).toContain('plugin-b');
      expect(list).toHaveLength(2);
    });
  });
});
