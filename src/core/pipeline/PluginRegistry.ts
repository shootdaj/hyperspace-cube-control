import type { InputPlugin, MappingStrategy, OutputPlugin, PluginFactory } from './types';

export class PluginRegistry {
  private inputs = new Map<string, PluginFactory<InputPlugin>>();
  private mappings = new Map<string, PluginFactory<MappingStrategy>>();
  private outputs = new Map<string, PluginFactory<OutputPlugin>>();

  registerInput(id: string, factory: PluginFactory<InputPlugin>): void {
    this.inputs.set(id, factory);
  }

  registerMapping(id: string, factory: PluginFactory<MappingStrategy>): void {
    this.mappings.set(id, factory);
  }

  registerOutput(id: string, factory: PluginFactory<OutputPlugin>): void {
    this.outputs.set(id, factory);
  }

  createInput(id: string): InputPlugin {
    const factory = this.inputs.get(id);
    if (!factory) throw new Error(`Unknown input plugin: ${id}`);
    return factory();
  }

  createMapping(id: string): MappingStrategy {
    const factory = this.mappings.get(id);
    if (!factory) throw new Error(`Unknown mapping strategy: ${id}`);
    return factory();
  }

  createOutput(id: string): OutputPlugin {
    const factory = this.outputs.get(id);
    if (!factory) throw new Error(`Unknown output plugin: ${id}`);
    return factory();
  }

  listInputs(): string[] {
    return Array.from(this.inputs.keys());
  }

  listMappings(): string[] {
    return Array.from(this.mappings.keys());
  }

  listOutputs(): string[] {
    return Array.from(this.outputs.keys());
  }
}

/** Module-level singleton. Import this in tests and app code alike. */
export const pluginRegistry = new PluginRegistry();
