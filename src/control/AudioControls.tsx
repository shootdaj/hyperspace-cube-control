import { useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Slider } from '@/components/ui/slider';
import { audioStore, type VisualizationMode } from '@/stores/audioStore';
import { audioPlugin } from '@/plugins/inputs/audioSingleton';

const VIZ_MODES: { value: VisualizationMode; label: string; description: string }[] = [
  { value: 'spectrum', label: 'Spectrum', description: 'Per-edge frequency bands' },
  { value: 'energy', label: 'Energy', description: 'Overall volume pulse' },
  { value: 'waveform', label: 'Waveform', description: 'Full spectrum sweep' },
];

/**
 * AudioControls — UI panel for audio-reactive LED input.
 *
 * Provides: device selector, start/stop, gain slider, sensitivity slider,
 * visualization mode selector.
 *
 * All touch targets are min-h-11 (44px) for mobile accessibility.
 */
export function AudioControls() {
  const devices = audioStore((s) => s.devices);
  const selectedDeviceId = audioStore((s) => s.selectedDeviceId);
  const isAudioActive = audioStore((s) => s.isAudioActive);
  const audioContextState = audioStore((s) => s.audioContextState);
  const gain = audioStore((s) => s.gain);
  const sensitivity = audioStore((s) => s.sensitivity);
  const visualizationMode = audioStore((s) => s.visualizationMode);

  const handleEnableAudio = useCallback(async () => {
    try {
      // Get devices (triggers permission prompt)
      await audioPlugin.getDevices();
      // Start audio with default or selected device
      const deviceId = audioStore.getState().selectedDeviceId ?? undefined;
      await audioPlugin.startAudio(deviceId);
    } catch (err) {
      console.error('Failed to start audio:', err);
    }
  }, []);

  const handleStopAudio = useCallback(() => {
    audioPlugin.stopAudio();
  }, []);

  const handleDeviceChange = useCallback(async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const deviceId = e.target.value || null;
    audioStore.getState().setSelectedDeviceId(deviceId);
    if (audioStore.getState().isAudioActive) {
      try {
        await audioPlugin.startAudio(deviceId ?? undefined);
      } catch (err) {
        console.error('Failed to switch audio device:', err);
      }
    }
  }, []);

  const handleGainChange = useCallback((value: number | readonly number[]) => {
    const v = Array.isArray(value) ? value[0] : value;
    audioPlugin.setGain(v);
  }, []);

  const handleSensitivityChange = useCallback((value: number | readonly number[]) => {
    const v = Array.isArray(value) ? value[0] : value;
    audioStore.getState().setSensitivity(v);
  }, []);

  const handleVisualizationMode = useCallback((mode: VisualizationMode) => {
    audioStore.getState().setVisualizationMode(mode);
  }, []);

  return (
    <div className="space-y-4">
      {/* Audio Status */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Audio Status</Label>
        <div className="flex items-center gap-2">
          <span
            className={`inline-block h-2 w-2 rounded-full ${
              audioContextState === 'running'
                ? 'bg-green-500'
                : audioContextState === 'suspended'
                  ? 'bg-yellow-500'
                  : 'bg-muted'
            }`}
          />
          <span className="text-xs text-muted-foreground">
            {audioContextState === 'running'
              ? 'Audio active'
              : audioContextState === 'suspended'
                ? 'Audio suspended — click Enable to start'
                : 'Audio not initialized'}
          </span>
        </div>
      </div>

      {/* Enable/Stop Audio */}
      <div className="space-y-2">
        {!isAudioActive ? (
          <Button
            aria-label="Enable Audio"
            className="w-full min-h-11 text-sm font-medium bg-emerald-600 hover:bg-emerald-700 text-white"
            onClick={handleEnableAudio}
          >
            Enable Audio
          </Button>
        ) : (
          <Button
            aria-label="Stop Audio"
            variant="outline"
            className="w-full min-h-11 text-sm font-medium border-red-700 text-red-400 hover:bg-red-900/20 hover:text-red-300"
            onClick={handleStopAudio}
          >
            Stop Audio
          </Button>
        )}
      </div>

      <Separator className="bg-border" />

      {/* Device Selector */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Audio Source</Label>
        <select
          aria-label="Audio Source"
          value={selectedDeviceId ?? ''}
          onChange={handleDeviceChange}
          className="w-full min-h-11 px-3 rounded-md border border-border bg-card text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">Default Microphone</option>
          {devices.map((device) => (
            <option key={device.deviceId} value={device.deviceId}>
              {device.label || `Audio Input (${device.deviceId.slice(0, 8)}...)`}
            </option>
          ))}
        </select>
      </div>

      <Separator className="bg-border" />

      {/* Gain Slider */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">Gain</Label>
          <span className="text-xs text-muted-foreground font-mono">{gain.toFixed(1)}x</span>
        </div>
        <Slider
          aria-label="Gain"
          min={0}
          max={5}
          step={0.1}
          value={[gain]}
          onValueChange={handleGainChange}
        />
      </div>

      <Separator className="bg-border" />

      {/* Sensitivity Slider */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">Sensitivity</Label>
          <span className="text-xs text-muted-foreground font-mono">{sensitivity}</span>
        </div>
        <Slider
          aria-label="Sensitivity"
          min={0}
          max={255}
          step={1}
          value={[sensitivity]}
          onValueChange={handleSensitivityChange}
        />
      </div>

      <Separator className="bg-border" />

      {/* Visualization Mode */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Visualization Mode</Label>
        <div className="grid grid-cols-3 gap-2">
          {VIZ_MODES.map((mode) => (
            <Button
              key={mode.value}
              aria-label={mode.label}
              variant={visualizationMode === mode.value ? 'default' : 'outline'}
              className={`min-h-11 flex flex-col gap-0.5 text-xs ${
                visualizationMode === mode.value
                  ? 'bg-secondary text-foreground ring-1 ring-ring'
                  : 'border-border text-muted-foreground hover:text-foreground'
              }`}
              onClick={() => handleVisualizationMode(mode.value)}
            >
              <span className="font-medium">{mode.label}</span>
              <span className="text-[10px] opacity-60">{mode.description}</span>
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}
