import { useCallback, useRef } from 'react';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { cubeStateStore } from '@/core/store/cubeStateStore';
import { connectionStore } from '@/core/store/connectionStore';
import { WLEDControlService } from '@/core/wled/WLEDControlService';
import { Gauge, Zap } from 'lucide-react';

/**
 * SpeedIntensityPanel — effect speed and intensity sliders.
 * Redesigned: Section header with accent border, prominent value readouts,
 * contextual labels showing percentage.
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

  const speedPercent = Math.round((speed / 255) * 100);
  const intensityPercent = Math.round((intensity / 255) * 100);

  return (
    <div className="space-y-5">
      <div className="section-header">
        <Gauge className="w-3.5 h-3.5 text-primary" />
        <span>Speed & Intensity</span>
      </div>

      {/* Speed slider */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label htmlFor="speed-slider" className="text-sm font-medium text-foreground/80 flex items-center gap-2">
            <Zap className="w-3.5 h-3.5 text-muted-foreground" />
            Speed
          </Label>
          <div className="flex items-baseline gap-1">
            <span className="value-readout">{speed}</span>
            <span className="text-xs text-muted-foreground font-mono">{speedPercent}%</span>
          </div>
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
        <div className="flex justify-between text-[10px] text-muted-foreground/60 font-mono px-0.5">
          <span>SLOW</span>
          <span>FAST</span>
        </div>
      </div>

      {/* Intensity slider */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label htmlFor="intensity-slider" className="text-sm font-medium text-foreground/80 flex items-center gap-2">
            <Gauge className="w-3.5 h-3.5 text-muted-foreground" />
            Intensity
          </Label>
          <div className="flex items-baseline gap-1">
            <span className="value-readout">{intensity}</span>
            <span className="text-xs text-muted-foreground font-mono">{intensityPercent}%</span>
          </div>
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
        <div className="flex justify-between text-[10px] text-muted-foreground/60 font-mono px-0.5">
          <span>LOW</span>
          <span>HIGH</span>
        </div>
      </div>
    </div>
  );
}
