import { useCallback, useRef } from 'react';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { cubeStateStore } from '@/core/store/cubeStateStore';
import { WLEDControlService } from '@/core/wled/WLEDControlService';
import { connectionStore } from '@/core/store/connectionStore';

/**
 * PowerBrightnessPanel — on/off toggle + brightness slider.
 *
 * Touch targets: Switch wrapped in 44px-tall row, Slider thumb is 20px default.
 * Brightness slider debounced at 100ms to avoid flooding ESP32.
 */
export function PowerBrightnessPanel() {
  const on = cubeStateStore((s) => s.on);
  const brightness = cubeStateStore((s) => s.brightness);
  const ip = connectionStore((s) => s.ip);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handlePowerToggle = useCallback(() => {
    if (!ip) return;
    const service = WLEDControlService.getInstance(ip);
    service.setPower(!on);
  }, [on, ip]);

  const handleBrightnessChange = useCallback(
    (value: number | readonly number[]) => {
      if (!ip) return;
      const v = Array.isArray(value) ? value[0] : value;
      // Optimistic store update immediately
      cubeStateStore.getState().setBrightness(v);
      // Debounce the REST call
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        const service = WLEDControlService.getInstance(ip);
        service.setBrightness(v);
      }, 100);
    },
    [ip],
  );

  return (
    <div className="space-y-4">
      {/* Power toggle — 44px min touch target */}
      <div className="flex items-center justify-between min-h-11">
        <Label htmlFor="power-toggle" className="text-sm font-medium">
          Power
        </Label>
        <Switch
          id="power-toggle"
          checked={on}
          onCheckedChange={handlePowerToggle}
          className="data-[state=checked]:bg-green-500"
        />
      </div>

      {/* Brightness slider */}
      <div className="space-y-2">
        <div className="flex items-center justify-between min-h-6">
          <Label htmlFor="brightness-slider" className="text-sm font-medium">
            Brightness
          </Label>
          <span className="text-sm text-muted-foreground tabular-nums w-8 text-right">
            {brightness}
          </span>
        </div>
        <Slider
          id="brightness-slider"
          min={0}
          max={255}
          step={1}
          value={[brightness]}
          onValueChange={handleBrightnessChange}
          className="min-h-11 [&_[role=slider]]:h-5 [&_[role=slider]]:w-5"
        />
      </div>
    </div>
  );
}
