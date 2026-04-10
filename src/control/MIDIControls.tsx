import { useCallback, useEffect, useState } from 'react';
import { HexColorPicker } from 'react-colorful';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { midiStore, type CCMapping, type NoteMapping } from '@/stores/midiStore';
import { isMIDISupported, getMIDIUnsupportedMessage } from '@/plugins/inputs/midiSupport';
import { midiPlugin } from '@/plugins/inputs/midiSingleton';
import { saveMIDIMappings, loadMIDIMappings, clearSavedMIDIMappings } from '@/plugins/inputs/midiPersistence';
import { presetStore } from '@/core/store/presetStore';
import { effectPaletteStore } from '@/core/store/effectPaletteStore';

function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map((c) => Math.max(0, Math.min(255, c)).toString(16).padStart(2, '0')).join('');
}

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  return [
    parseInt(clean.slice(0, 2), 16),
    parseInt(clean.slice(2, 4), 16),
    parseInt(clean.slice(4, 6), 16),
  ];
}

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
  const padColors = midiStore((s) => s.padColors);
  const padNoteMap = midiStore((s) => s.padNoteMap);
  const padHoldMode = midiStore((s) => s.padHoldMode);
  const padLearnIndex = midiStore((s) => s.padLearnIndex);
  const [padColorPopover, setPadColorPopover] = useState<number | null>(null);

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
              isEnabled ? 'bg-green-500' : 'bg-muted'
            }`}
          />
          <span className="text-xs text-muted-foreground">
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
          <Separator className="bg-border" />

          {/* Device Selector */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">MIDI Input Device</Label>
            <select
              aria-label="MIDI Input Device"
              value={selectedDeviceId ?? ''}
              onChange={handleDeviceChange}
              className="w-full min-h-11 px-3 rounded-md border border-border bg-card text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">All Devices</option>
              {devices.map((device) => (
                <option key={device.id} value={device.id}>
                  {device.name} {device.manufacturer !== 'Unknown' ? `(${device.manufacturer})` : ''}
                </option>
              ))}
            </select>
          </div>

          <Separator className="bg-border" />

          {/* CC Mappings */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">CC Knob/Slider Mapping</Label>
            <p className="text-xs text-muted-foreground">Click "Learn" then move a knob/slider on your MIDI controller.</p>
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
                          : 'border-border'
                    }`}
                  >
                    <div className="flex-1">
                      <span className="text-xs font-medium text-foreground">{target.label}</span>
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
                            : 'border-border text-foreground/80'
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
                          className="min-h-8 text-xs border-border text-muted-foreground hover:text-red-400 hover:border-red-700"
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

          <Separator className="bg-border" />

          {/* Drum Pad Colors */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Drum Pad Colors</Label>
            <p className="text-xs text-muted-foreground">Trigger pad notes to flash all LEDs with a color. Click square to change color.</p>
            <div className="grid grid-cols-4 gap-2">
              {padColors.map((color, i) => {
                const isLearning = padLearnIndex === i;
                const hex = rgbToHex(color[0], color[1], color[2]);
                return (
                  <div key={i} className="flex flex-col items-center gap-1">
                    <Popover
                      open={padColorPopover === i}
                      onOpenChange={(open) => setPadColorPopover(open ? i : null)}
                    >
                      <PopoverTrigger
                        aria-label={`Pad ${i + 1} color`}
                        className={`min-h-11 min-w-11 w-full rounded-md border-2 cursor-pointer transition-all ${
                          isLearning
                            ? 'border-amber-500 animate-pulse'
                            : 'border-border hover:border-primary/50'
                        }`}
                        style={{ backgroundColor: hex }}
                      />
                      <PopoverContent className="w-auto p-3" align="start">
                        <HexColorPicker
                          color={hex}
                          onChange={(newHex) => midiStore.getState().setPadColor(i, hexToRgb(newHex))}
                        />
                      </PopoverContent>
                    </Popover>
                    <span className="text-[10px] font-mono text-muted-foreground">N{padNoteMap[i]}</span>
                    <Button
                      aria-label={`Learn pad ${i + 1}`}
                      variant={isLearning ? 'default' : 'outline'}
                      size="sm"
                      className={`min-h-7 h-7 text-[10px] px-2 w-full ${
                        isLearning
                          ? 'bg-amber-600 hover:bg-amber-700 text-white'
                          : 'border-border text-muted-foreground'
                      }`}
                      onClick={() => midiStore.getState().setPadLearnIndex(isLearning ? null : i)}
                    >
                      {isLearning ? 'Cancel' : 'Learn'}
                    </Button>
                  </div>
                );
              })}
            </div>
            <div className="flex items-center gap-2 pt-1">
              <button
                aria-label="Hold Mode"
                role="checkbox"
                aria-checked={padHoldMode}
                className={`h-4 w-4 rounded border cursor-pointer transition-colors ${
                  padHoldMode ? 'bg-primary border-primary' : 'border-border'
                }`}
                onClick={() => midiStore.getState().setPadHoldMode(!padHoldMode)}
              >
                {padHoldMode && (
                  <svg viewBox="0 0 12 12" className="w-full h-full text-primary-foreground">
                    <path d="M3 6l2 2 4-4" stroke="currentColor" strokeWidth="2" fill="none" />
                  </svg>
                )}
              </button>
              <span className="text-xs text-muted-foreground">Hold Mode (keep color after release)</span>
            </div>
          </div>

          <Separator className="bg-border" />

          {/* Note Mappings — Presets */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Note-to-Preset Mapping</Label>
            <p className="text-xs text-muted-foreground">Click "Learn" then press a key on your MIDI controller to bind it to a preset.</p>
            {presets.length === 0 ? (
              <p className="text-xs text-muted-foreground/70 italic">No presets saved. Save presets in the Presets tab first.</p>
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
                            : 'border-border'
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <span className="text-xs text-foreground/80 truncate block">{preset.name}</span>
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
                              : 'border-border text-muted-foreground'
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
                            className="min-h-7 h-7 text-[10px] px-2 border-border text-muted-foreground hover:text-red-400"
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

          <Separator className="bg-border" />

          {/* Note Mappings — Effects */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Note-to-Effect Mapping</Label>
            <p className="text-xs text-muted-foreground">Bind MIDI notes to switch between effects.</p>
            {effects.length === 0 ? (
              <p className="text-xs text-muted-foreground/70 italic">Connect to cube to load effects.</p>
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
                            : 'border-border'
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <span className="text-xs text-foreground/80 truncate block">{effect}</span>
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
                              : 'border-border text-muted-foreground'
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
                            className="min-h-7 h-7 text-[10px] px-2 border-border text-muted-foreground hover:text-red-400"
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

          <Separator className="bg-border" />

          {/* Save/Clear Mappings */}
          <div className="flex gap-2">
            <Button
              aria-label="Save MIDI Mappings"
              className="flex-1 min-h-11 text-sm font-medium bg-secondary hover:bg-secondary/80 text-foreground"
              onClick={handleSave}
            >
              Save Mappings
            </Button>
            <Button
              aria-label="Clear All Mappings"
              variant="outline"
              className="flex-1 min-h-11 text-sm font-medium border-border text-muted-foreground hover:text-red-400 hover:border-red-700"
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
