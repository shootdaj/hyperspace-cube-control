import { useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { midiStore, type CCMapping, type NoteMapping } from '@/stores/midiStore';
import { isMIDISupported, getMIDIUnsupportedMessage } from '@/plugins/inputs/midiSupport';
import { midiPlugin } from '@/plugins/inputs/midiSingleton';
import { saveMIDIMappings, loadMIDIMappings, clearSavedMIDIMappings } from '@/plugins/inputs/midiPersistence';
import { presetStore } from '@/core/store/presetStore';
import { effectPaletteStore } from '@/core/store/effectPaletteStore';

const CC_TARGETS: Array<{ value: CCMapping['target']; label: string; description: string }> = [
  { value: 'brightness', label: 'Brightness', description: 'LED brightness (0-255)' },
  { value: 'speed', label: 'Speed', description: 'Effect speed (0-255)' },
  { value: 'intensity', label: 'Intensity', description: 'Effect intensity (0-255)' },
  { value: 'hue', label: 'Color Hue', description: 'Primary color hue (0-360)' },
];

/**
 * MIDIControls — UI panel for MIDI controller mapping.
 *
 * Provides: MIDI enable/disable, device selector, MIDI learn for CC mapping,
 * note-to-action mapping, save/load/clear mappings.
 *
 * Shows graceful degradation message on unsupported browsers (Safari/iOS).
 */
export function MIDIControls() {
  const isSupported = midiStore((s) => s.isSupported);
  const isEnabled = midiStore((s) => s.isEnabled);
  const devices = midiStore((s) => s.devices);
  const selectedDeviceId = midiStore((s) => s.selectedDeviceId);
  const ccMappings = midiStore((s) => s.ccMappings);
  const noteMappings = midiStore((s) => s.noteMappings);
  const learnTarget = midiStore((s) => s.learnTarget);
  const error = midiStore((s) => s.error);
  const presets = presetStore((s) => s.presets);
  const effects = effectPaletteStore((s) => s.effects);

  // Check MIDI support on mount and load saved mappings
  useEffect(() => {
    midiStore.getState().setIsSupported(isMIDISupported());
    loadMIDIMappings();
  }, []);

  const handleEnable = useCallback(async () => {
    await midiPlugin.enable();
  }, []);

  const handleDisable = useCallback(() => {
    midiPlugin.disable();
  }, []);

  const handleDeviceChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = e.target.value || null;
    midiStore.getState().setSelectedDeviceId(id);
  }, []);

  const handleLearnCC = useCallback((target: CCMapping['target']) => {
    const current = midiStore.getState().learnTarget;
    // Toggle off if already learning this target
    if (current && current.type === 'cc' && current.target === target) {
      midiStore.getState().setLearnTarget(null);
      return;
    }
    midiStore.getState().setLearnTarget({ type: 'cc', target });
  }, []);

  const handleRemoveCCMapping = useCallback((channel: number, cc: number) => {
    midiStore.getState().removeCCMapping(channel, cc);
  }, []);

  const handleLearnNote = useCallback((action: NoteMapping['action'], actionIndex: number) => {
    const current = midiStore.getState().learnTarget;
    // Toggle off if already learning this target
    if (
      current &&
      current.type === 'note' &&
      current.action === action &&
      current.actionIndex === actionIndex
    ) {
      midiStore.getState().setLearnTarget(null);
      return;
    }
    midiStore.getState().setLearnTarget({ type: 'note', action, actionIndex });
  }, []);

  const handleRemoveNoteMapping = useCallback((channel: number, note: number) => {
    midiStore.getState().removeNoteMapping(channel, note);
  }, []);

  const handleSave = useCallback(() => {
    saveMIDIMappings();
  }, []);

  const handleClear = useCallback(() => {
    midiStore.getState().clearAllMappings();
    clearSavedMIDIMappings();
  }, []);

  // Unsupported browser — show clear message
  if (!isSupported) {
    return (
      <div className="space-y-4">
        <div className="rounded-lg border border-amber-700/50 bg-amber-950/30 p-4">
          <h3 className="text-sm font-semibold text-amber-400 mb-2">MIDI Not Available</h3>
          <p className="text-xs text-amber-300/80 leading-relaxed">
            {getMIDIUnsupportedMessage()}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* MIDI Status */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">MIDI Status</Label>
        <div className="flex items-center gap-2">
          <span
            className={`inline-block h-2 w-2 rounded-full ${
              isEnabled ? 'bg-green-500' : 'bg-zinc-600'
            }`}
          />
          <span className="text-xs text-zinc-400">
            {isEnabled
              ? `MIDI active — ${devices.length} device${devices.length !== 1 ? 's' : ''} connected`
              : 'MIDI not enabled'}
          </span>
        </div>
        {error && (
          <p className="text-xs text-red-400">{error}</p>
        )}
      </div>

      {/* Enable/Disable MIDI */}
      <div className="space-y-2">
        {!isEnabled ? (
          <Button
            aria-label="Enable MIDI"
            className="w-full min-h-11 text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white"
            onClick={handleEnable}
          >
            Enable MIDI
          </Button>
        ) : (
          <Button
            aria-label="Disable MIDI"
            variant="outline"
            className="w-full min-h-11 text-sm font-medium border-red-700 text-red-400 hover:bg-red-900/20 hover:text-red-300"
            onClick={handleDisable}
          >
            Disable MIDI
          </Button>
        )}
      </div>

      {isEnabled && (
        <>
          <Separator className="bg-zinc-800" />

          {/* Device Selector */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">MIDI Input Device</Label>
            <select
              aria-label="MIDI Input Device"
              value={selectedDeviceId ?? ''}
              onChange={handleDeviceChange}
              className="w-full min-h-11 px-3 rounded-md border border-zinc-700 bg-zinc-900 text-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-500"
            >
              <option value="">All Devices</option>
              {devices.map((device) => (
                <option key={device.id} value={device.id}>
                  {device.name} {device.manufacturer !== 'Unknown' ? `(${device.manufacturer})` : ''}
                </option>
              ))}
            </select>
          </div>

          <Separator className="bg-zinc-800" />

          {/* CC Mappings */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">CC Knob/Slider Mapping</Label>
            <p className="text-xs text-zinc-500">Click "Learn" then move a knob/slider on your MIDI controller.</p>
            <div className="space-y-2">
              {CC_TARGETS.map((target) => {
                const mapping = ccMappings.find((m) => m.target === target.value);
                const isLearning =
                  learnTarget?.type === 'cc' && learnTarget.target === target.value;

                return (
                  <div
                    key={target.value}
                    className={`flex items-center justify-between rounded-md border p-2 ${
                      isLearning
                        ? 'border-amber-500 bg-amber-950/20'
                        : mapping
                          ? 'border-green-700/50 bg-green-950/10'
                          : 'border-zinc-700'
                    }`}
                  >
                    <div className="flex-1">
                      <span className="text-xs font-medium text-zinc-200">{target.label}</span>
                      {mapping && (
                        <span className="ml-2 text-[10px] text-green-400 font-mono">
                          CC{mapping.cc} Ch{mapping.channel}
                        </span>
                      )}
                      {isLearning && (
                        <span className="ml-2 text-[10px] text-amber-400 animate-pulse">
                          Waiting for CC...
                        </span>
                      )}
                    </div>
                    <div className="flex gap-1">
                      <Button
                        aria-label={`Learn ${target.label}`}
                        variant={isLearning ? 'default' : 'outline'}
                        size="sm"
                        className={`min-h-8 text-xs ${
                          isLearning
                            ? 'bg-amber-600 hover:bg-amber-700 text-white'
                            : 'border-zinc-600 text-zinc-300'
                        }`}
                        onClick={() => handleLearnCC(target.value)}
                      >
                        {isLearning ? 'Cancel' : 'Learn'}
                      </Button>
                      {mapping && (
                        <Button
                          aria-label={`Remove ${target.label} mapping`}
                          variant="outline"
                          size="sm"
                          className="min-h-8 text-xs border-zinc-600 text-zinc-400 hover:text-red-400 hover:border-red-700"
                          onClick={() => handleRemoveCCMapping(mapping.channel, mapping.cc)}
                        >
                          X
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <Separator className="bg-zinc-800" />

          {/* Note Mappings — Presets */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Note-to-Preset Mapping</Label>
            <p className="text-xs text-zinc-500">Click "Learn" then press a key on your MIDI controller to bind it to a preset.</p>
            {presets.length === 0 ? (
              <p className="text-xs text-zinc-600 italic">No presets saved. Save presets in the Presets tab first.</p>
            ) : (
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {presets.slice(0, 16).map((preset, index) => {
                  const mapping = noteMappings.find(
                    (m) => m.action === 'preset' && m.actionIndex === index,
                  );
                  const isLearning =
                    learnTarget?.type === 'note' &&
                    learnTarget.action === 'preset' &&
                    learnTarget.actionIndex === index;

                  return (
                    <div
                      key={preset.id}
                      className={`flex items-center justify-between rounded-md border p-1.5 ${
                        isLearning
                          ? 'border-amber-500 bg-amber-950/20'
                          : mapping
                            ? 'border-green-700/50 bg-green-950/10'
                            : 'border-zinc-800'
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <span className="text-xs text-zinc-300 truncate block">{preset.name}</span>
                        {mapping && (
                          <span className="text-[10px] text-green-400 font-mono">
                            Note {mapping.note} Ch{mapping.channel}
                          </span>
                        )}
                        {isLearning && (
                          <span className="text-[10px] text-amber-400 animate-pulse">
                            Press a key...
                          </span>
                        )}
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <Button
                          aria-label={`Learn preset ${preset.name}`}
                          variant={isLearning ? 'default' : 'outline'}
                          size="sm"
                          className={`min-h-7 h-7 text-[10px] px-2 ${
                            isLearning
                              ? 'bg-amber-600 hover:bg-amber-700 text-white'
                              : 'border-zinc-700 text-zinc-400'
                          }`}
                          onClick={() => handleLearnNote('preset', index)}
                        >
                          {isLearning ? 'Cancel' : 'Learn'}
                        </Button>
                        {mapping && (
                          <Button
                            aria-label={`Remove preset ${preset.name} mapping`}
                            variant="outline"
                            size="sm"
                            className="min-h-7 h-7 text-[10px] px-2 border-zinc-700 text-zinc-400 hover:text-red-400"
                            onClick={() => handleRemoveNoteMapping(mapping.channel, mapping.note)}
                          >
                            X
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <Separator className="bg-zinc-800" />

          {/* Note Mappings — Effects */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Note-to-Effect Mapping</Label>
            <p className="text-xs text-zinc-500">Bind MIDI notes to switch between effects.</p>
            {effects.length === 0 ? (
              <p className="text-xs text-zinc-600 italic">Connect to cube to load effects.</p>
            ) : (
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {effects.slice(0, 24).map((effect, index) => {
                  const mapping = noteMappings.find(
                    (m) => m.action === 'effect' && m.actionIndex === index,
                  );
                  const isLearning =
                    learnTarget?.type === 'note' &&
                    learnTarget.action === 'effect' &&
                    learnTarget.actionIndex === index;

                  return (
                    <div
                      key={`effect-${index}`}
                      className={`flex items-center justify-between rounded-md border p-1.5 ${
                        isLearning
                          ? 'border-amber-500 bg-amber-950/20'
                          : mapping
                            ? 'border-green-700/50 bg-green-950/10'
                            : 'border-zinc-800'
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <span className="text-xs text-zinc-300 truncate block">{effect}</span>
                        {mapping && (
                          <span className="text-[10px] text-green-400 font-mono">
                            Note {mapping.note} Ch{mapping.channel}
                          </span>
                        )}
                        {isLearning && (
                          <span className="text-[10px] text-amber-400 animate-pulse">
                            Press a key...
                          </span>
                        )}
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <Button
                          aria-label={`Learn effect ${effect}`}
                          variant={isLearning ? 'default' : 'outline'}
                          size="sm"
                          className={`min-h-7 h-7 text-[10px] px-2 ${
                            isLearning
                              ? 'bg-amber-600 hover:bg-amber-700 text-white'
                              : 'border-zinc-700 text-zinc-400'
                          }`}
                          onClick={() => handleLearnNote('effect', index)}
                        >
                          {isLearning ? 'Cancel' : 'Learn'}
                        </Button>
                        {mapping && (
                          <Button
                            aria-label={`Remove effect ${effect} mapping`}
                            variant="outline"
                            size="sm"
                            className="min-h-7 h-7 text-[10px] px-2 border-zinc-700 text-zinc-400 hover:text-red-400"
                            onClick={() => handleRemoveNoteMapping(mapping.channel, mapping.note)}
                          >
                            X
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <Separator className="bg-zinc-800" />

          {/* Save/Clear Mappings */}
          <div className="flex gap-2">
            <Button
              aria-label="Save MIDI Mappings"
              className="flex-1 min-h-11 text-sm font-medium bg-zinc-700 hover:bg-zinc-600 text-white"
              onClick={handleSave}
            >
              Save Mappings
            </Button>
            <Button
              aria-label="Clear All Mappings"
              variant="outline"
              className="flex-1 min-h-11 text-sm font-medium border-zinc-700 text-zinc-400 hover:text-red-400 hover:border-red-700"
              onClick={handleClear}
            >
              Clear All
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
