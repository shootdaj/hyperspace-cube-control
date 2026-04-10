import { useCallback, useRef } from 'react';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { cubeStateStore } from '@/core/store/cubeStateStore';
import { WLEDControlService } from '@/core/wled/WLEDControlService';
import { connectionStore } from '@/core/store/connectionStore';
import { SACNController } from '@/core/wled/SACNController';
import { Power, Sun } from 'lucide-react';

/**
 * PowerBrightnessPanel — on/off toggle + brightness slider.
 *
 * Redesigned: Large power button with glow state, big brightness value readout,
 * and percentage label for contextualizing the raw value.
 */
export function PowerBrightnessPanel() {
  const on = cubeStateStore((s) => s.on);
  const brightness = cubeStateStore((s) => s.brightness);
  const ip = connectionStore((s) => s.ip);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handlePowerToggle = useCallback(() => {
    if (!ip) return;
    const newOn = !on;

    // Send via sACN for instant visual feedback
    try {
      const sacn = SACNController.getInstance();
      if (sacn.isActive()) {
        if (!newOn) {
          // Power OFF: send all-black frame
          sacn.sendFrame(new Uint8Array(SACNController.FRAME_SIZE));
        } else {
          // Power ON: send current color at current brightness
          const { colors, brightness: bri } = cubeStateStore.getState();
          const [r, g, b] = colors[0] || [255, 160, 0];
          const factor = bri / 255;
          const frame = new Uint8Array(SACNController.FRAME_SIZE);
          for (let i = 0; i < 224; i++) {
            frame[i * 3] = Math.round(r * factor);
            frame[i * 3 + 1] = Math.round(g * factor);
            frame[i * 3 + 2] = Math.round(b * factor);
          }
          sacn.sendFrame(frame);
        }
      }
    } catch {
      // SACNController not initialized — ignore
    }

    const service = WLEDControlService.getInstance(ip);
    service.setPower(newOn);
  }, [on, ip]);

  const handleBrightnessChange = useCallback(
    (value: number | readonly number[]) => {
      if (!ip) return;
      const v = Array.isArray(value) ? value[0] : value;
      // Optimistic store update immediately
      cubeStateStore.getState().setBrightness(v);

      // If sACN is active, send a solid-color frame at the new brightness
      try {
        const sacn = SACNController.getInstance();
        if (sacn.isActive()) {
          const { colors: storeColors } = cubeStateStore.getState();
          const [r, g, b] = storeColors[0] || [255, 160, 0];
          const factor = v / 255;
          const frame = new Uint8Array(SACNController.FRAME_SIZE);
          for (let i = 0; i < 224; i++) {
            frame[i * 3] = Math.round(r * factor);
            frame[i * 3 + 1] = Math.round(g * factor);
            frame[i * 3 + 2] = Math.round(b * factor);
          }
          sacn.sendFrame(frame);
        }
      } catch {
        // SACNController not initialized — ignore
      }

      // Debounce the REST call
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        const service = WLEDControlService.getInstance(ip);
        service.setBrightness(v);
      }, 100);
    },
    [ip],
  );

  const brightnessPercent = Math.round((brightness / 255) * 100);

  return (
    <div className="space-y-5">
      <div className="section-header">
        <Sun className="w-3.5 h-3.5 text-primary" />
        <span>Power & Brightness</span>
      </div>

      {/* Power toggle — large circular button */}
      <div className="flex items-center gap-4">
        <button
          onClick={handlePowerToggle}
          className={`
            relative flex items-center justify-center w-14 h-14 rounded-full
            border-2 transition-all duration-300 cursor-pointer
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background
            ${on
              ? 'bg-green-500/15 border-green-500/60 text-green-400 shadow-[0_0_20px_rgba(34,197,94,0.2)]'
              : 'bg-secondary/50 border-border text-muted-foreground hover:border-muted-foreground/50 hover:text-foreground'
            }
          `}
          aria-label={on ? 'Turn off' : 'Turn on'}
        >
          <Power className="w-6 h-6" strokeWidth={2} />
          {/* Glow ring when on */}
          {on && (
            <span className="absolute inset-0 rounded-full animate-ping bg-green-500/10 pointer-events-none" style={{ animationDuration: '3s' }} />
          )}
        </button>

        <div className="flex-1">
          <div className="text-sm font-medium text-foreground/80">
            {on ? 'On' : 'Off'}
          </div>
          <div className="text-xs text-muted-foreground">
            {on ? 'Cube is active' : 'Tap to power on'}
          </div>
        </div>
      </div>

      {/* Brightness slider with prominent readout */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label htmlFor="brightness-slider" className="text-sm font-medium text-foreground/80 flex items-center gap-2">
            <Sun className="w-3.5 h-3.5 text-muted-foreground" />
            Brightness
          </Label>
          <div className="flex items-baseline gap-1">
            <span className="value-readout">{brightness}</span>
            <span className="text-xs text-muted-foreground font-mono">{brightnessPercent}%</span>
          </div>
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
        <div className="flex justify-between text-[10px] text-muted-foreground/60 font-mono px-0.5">
          <span>OFF</span>
          <span>DIM</span>
          <span>MID</span>
          <span>FULL</span>
        </div>
      </div>
    </div>
  );
}
