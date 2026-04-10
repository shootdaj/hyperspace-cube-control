import { useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Slider } from '@/components/ui/slider';
import { cameraStore } from '@/stores/cameraStore';
import { cameraPlugin } from '@/plugins/inputs/cameraSingleton';
import { DEFAULT_LED_COUNT } from '@/core/constants';

/**
 * CameraControls — UI panel for webcam motion-reactive LED input.
 *
 * Provides: camera enable/disable, device selector, motion sensitivity slider,
 * motion level indicator. Handles permission states with clear UI guidance.
 *
 * All touch targets are min-h-11 (44px) for mobile accessibility.
 */
export function CameraControls() {
  const isActive = cameraStore((s) => s.isActive);
  const devices = cameraStore((s) => s.devices);
  const selectedDeviceId = cameraStore((s) => s.selectedDeviceId);
  const permissionState = cameraStore((s) => s.permissionState);
  const error = cameraStore((s) => s.error);
  const sensitivity = cameraStore((s) => s.sensitivity);
  const motionLevel = cameraStore((s) => s.motionLevel);

  const handleEnableCamera = useCallback(async () => {
    try {
      // Initialize the worker (idempotent — safe to call multiple times)
      await cameraPlugin.initialize({ ledCount: DEFAULT_LED_COUNT, frameRate: 30 });
      await cameraPlugin.getDevices();
      const deviceId = cameraStore.getState().selectedDeviceId ?? undefined;
      await cameraPlugin.startCamera(deviceId);
    } catch (err) {
      console.error('Failed to start camera:', err);
    }
  }, []);

  const handleStopCamera = useCallback(() => {
    cameraPlugin.stopCamera();
  }, []);

  const handleDeviceChange = useCallback(async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const deviceId = e.target.value || null;
    cameraStore.getState().setSelectedDeviceId(deviceId);
    if (cameraStore.getState().isActive) {
      cameraPlugin.stopCamera();
      try {
        await cameraPlugin.startCamera(deviceId ?? undefined);
      } catch (err) {
        console.error('Failed to switch camera:', err);
      }
    }
  }, []);

  const handleSensitivityChange = useCallback((value: number | readonly number[]) => {
    const v = Array.isArray(value) ? value[0] : value;
    cameraPlugin.setSensitivity(v);
  }, []);

  return (
    <div className="space-y-4">
      {/* Camera Status */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Camera Status</Label>
        <div className="flex items-center gap-2">
          <span
            className={`inline-block h-2 w-2 rounded-full ${
              isActive
                ? 'bg-green-500'
                : permissionState === 'denied'
                  ? 'bg-red-500'
                  : 'bg-muted'
            }`}
          />
          <span className="text-xs text-muted-foreground">
            {isActive
              ? 'Camera active — detecting motion'
              : permissionState === 'denied'
                ? 'Camera access denied'
                : 'Camera not active'}
          </span>
        </div>
        {error && (
          <div className="rounded-lg border border-amber-700/50 bg-amber-950/30 p-3">
            <p className="text-xs text-amber-300/80 leading-relaxed">{error}</p>
          </div>
        )}
      </div>

      {/* Enable/Stop Camera */}
      <div className="space-y-2">
        {!isActive ? (
          <Button
            aria-label="Enable Camera"
            className="w-full min-h-11 text-sm font-medium bg-teal-600 hover:bg-teal-700 text-white"
            onClick={handleEnableCamera}
          >
            Enable Camera
          </Button>
        ) : (
          <Button
            aria-label="Stop Camera"
            variant="outline"
            className="w-full min-h-11 text-sm font-medium border-red-700 text-red-400 hover:bg-red-900/20 hover:text-red-300"
            onClick={handleStopCamera}
          >
            Stop Camera
          </Button>
        )}
      </div>

      <Separator className="bg-border" />

      {/* Device Selector */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Camera Source</Label>
        <select
          aria-label="Camera Source"
          value={selectedDeviceId ?? ''}
          onChange={handleDeviceChange}
          className="w-full min-h-11 px-3 rounded-md border border-border bg-card text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">Default Camera</option>
          {devices.map((device) => (
            <option key={device.deviceId} value={device.deviceId}>
              {device.label || `Camera (${device.deviceId.slice(0, 8)}...)`}
            </option>
          ))}
        </select>
      </div>

      <Separator className="bg-border" />

      {/* Motion Sensitivity */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">Motion Sensitivity</Label>
          <span className="text-xs text-muted-foreground font-mono">{sensitivity}</span>
        </div>
        <Slider
          aria-label="Motion Sensitivity"
          min={0}
          max={255}
          step={1}
          value={[sensitivity]}
          onValueChange={handleSensitivityChange}
        />
        <p className="text-xs text-muted-foreground">
          Higher = more sensitive to small movements
        </p>
      </div>

      <Separator className="bg-border" />

      {/* Motion Level Indicator */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">Motion Level</Label>
          <span className="text-xs text-muted-foreground font-mono">
            {(motionLevel * 100).toFixed(1)}%
          </span>
        </div>
        <div className="h-2 bg-border rounded-full overflow-hidden">
          <div
            className="h-full bg-teal-500 rounded-full transition-all duration-100"
            style={{ width: `${Math.min(100, motionLevel * 100)}%` }}
          />
        </div>
      </div>
    </div>
  );
}
