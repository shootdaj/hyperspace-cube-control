import { useCallback, useRef } from 'react';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { cubeStateStore } from '@/core/store/cubeStateStore';
import { connectionStore } from '@/core/store/connectionStore';
import { WLEDControlService } from '@/core/wled/WLEDControlService';

/**
 * SpeedIntensityPanel — effect speed and intensity sliders.
 * Debounced at 100ms to avoid flooding ESP32.
 */
export function SpeedIntensityPanel() {
  const speed = cubeStateStore((s) => s.speed);
  const intensity = cubeStateStore((s) => s.intensity);
  const ip = connectionStore((s) => s.ip);
  const speedDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intensityDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSpeedChange = useCallback(
    (value: number | readonly number[]) => {
      if (!ip) return;
      const v = Array.isArray(value) ? value[0] : value;
      cubeStateStore.getState().setSpeed(v);
      if (speedDebounce.current) clearTimeout(speedDebounce.current);
      speedDebounce.current = setTimeout(() => {
        WLEDControlService.getInstance(ip).setSpeed(v);
      }, 100);
    },
    [ip],
  );

  const handleIntensityChange = useCallback(
    (value: number | readonly number[]) => {
      if (!ip) return;
      const v = Array.isArray(value) ? value[0] : value;
      cubeStateStore.getState().setIntensity(v);
      if (intensityDebounce.current) clearTimeout(intensityDebounce.current);
      intensityDebounce.current = setTimeout(() => {
        WLEDControlService.getInstance(ip).setIntensity(v);
      }, 100);
    },
    [ip],
  );

  return (
    <div className="space-y-4">
      {/* Speed slider */}
      <div className="space-y-2">
        <div className="flex items-center justify-between min-h-6">
          <Label htmlFor="speed-slider" className="text-sm font-medium">
            Speed
          </Label>
          <span className="text-sm text-muted-foreground tabular-nums w-8 text-right">
            {speed}
          </span>
        </div>
        <Slider
          id="speed-slider"
          min={0}
          max={255}
          step={1}
          value={[speed]}
          onValueChange={handleSpeedChange}
          className="min-h-11 [&_[role=slider]]:h-5 [&_[role=slider]]:w-5"
        />
      </div>

      {/* Intensity slider */}
      <div className="space-y-2">
        <div className="flex items-center justify-between min-h-6">
          <Label htmlFor="intensity-slider" className="text-sm font-medium">
            Intensity
          </Label>
          <span className="text-sm text-muted-foreground tabular-nums w-8 text-right">
            {intensity}
          </span>
        </div>
        <Slider
          id="intensity-slider"
          min={0}
          max={255}
          step={1}
          value={[intensity]}
          onValueChange={handleIntensityChange}
          className="min-h-11 [&_[role=slider]]:h-5 [&_[role=slider]]:w-5"
        />
      </div>
    </div>
  );
}
