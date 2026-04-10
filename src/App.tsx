import { useState, useEffect, useCallback } from 'react';
import { ConnectionStatus } from '@/ui/ConnectionStatus';

import { SetupWizard } from '@/setup/SetupWizard';
import { CubeScene } from '@/visualization/CubeScene';
import { ControlPanel } from '@/control/ControlPanel';
import { connectionStore } from '@/core/store/connectionStore';
import { uiStore } from '@/core/store/uiStore';
import { WLEDWebSocketService } from '@/core/wled/WLEDWebSocketService';
import { WLEDControlService } from '@/core/wled/WLEDControlService';
import { startLiveSync } from '@/core/pipeline/WLEDLiveSync';
import { startStateSync } from '@/core/wled/WLEDStateSync';
import { effectPaletteStore } from '@/core/store/effectPaletteStore';
import { presetStore } from '@/core/store/presetStore';
import { SACNController } from '@/core/wled/SACNController';
import { ledStateProxy } from '@/core/store/ledStateProxy';
import { SACNBridgeOutput } from '@/plugins/outputs/SACNBridgeOutput';
import { InputPipelineRunner } from '@/core/pipeline/InputPipelineRunner';
import { ThemePickerCompact } from '@/themes/ThemePicker';
import { PlayPauseButton } from '@/ui/PlayPauseButton';
import { Box } from 'lucide-react';

const WIZARD_STORAGE_KEY = 'wizardCompleted';

/**
 * Wait for the WebSocket probe to resolve (available or unavailable).
 * Resolves when isWsAvailable() is no longer null, or after maxWaitMs.
 */
function waitForWsProbe(maxWaitMs = 4000): Promise<boolean | null> {
  const ws = WLEDWebSocketService.getInstance();
  return new Promise((resolve) => {
    const start = Date.now();
    const check = () => {
      const result = ws.isWsAvailable();
      if (result !== null || Date.now() - start >= maxWaitMs) {
        resolve(result);
        return;
      }
      setTimeout(check, 100);
    };
    check();
  });
}

export default function App() {
  const [wizardDone, setWizardDone] = useState(() => {
    const completed = localStorage.getItem(WIZARD_STORAGE_KEY) === 'true';
    const savedIp = localStorage.getItem('hypercube-device-ip');
    // If wizard was completed but no IP was saved (bug from before persistence fix),
    // re-show the wizard so the user can enter their IP again
    if (completed && !savedIp) {
      localStorage.removeItem(WIZARD_STORAGE_KEY);
      return false;
    }
    return completed;
  });
  const status = connectionStore((state) => state.status);
  const ip = connectionStore((state) => state.ip);

  // Load presets from localStorage on mount
  useEffect(() => {
    presetStore.getState().loadPresets();
  }, []);

  /**
   * Initiates connection to the WLED device.
   * 1. Tries WebSocket first (fast, push-based).
   * 2. If WS unavailable (e.g., Hyperspace firmware), falls back to REST polling.
   * 3. Connection status reflects actual reachability, not just WS state.
   */
  const connectToDevice = useCallback(async (deviceIp: string) => {
    const ws = WLEDWebSocketService.getInstance();

    // Reset WS availability in case this is a new IP
    ws.resetWsAvailability();

    // Try WebSocket connection
    ws.connect(deviceIp);

    // Wait for probe to complete (up to 4s)
    const wsAvailable = await waitForWsProbe(4000);

    if (wsAvailable === true) {
      // WebSocket works — connection status already set by WS onopen
      console.info('[App] WebSocket connected successfully');
    } else {
      // WebSocket unavailable — verify device is reachable via REST
      console.info('[App] WebSocket unavailable, trying REST fallback');
      try {
        const client = WLEDControlService.getInstance(deviceIp).getRestClient();
        await client.getInfo();
        // REST works — device is reachable
        connectionStore.getState().setStatus('connected');
        console.info('[App] REST connection successful — device reachable');
      } catch {
        connectionStore.getState().setStatus('disconnected');
        console.error('[App] Device unreachable via both WebSocket and REST');
      }
    }
  }, []);

  // Auto-reconnect on mount if we have a saved IP but no active connection
  useEffect(() => {
    if (ip && status === 'disconnected') {
      void connectToDevice(ip);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- intentionally run once on mount only

  // Start live LED sync + state sync when connected; fetch effects and palettes
  // Also start sACN control to kill local patterns and maintain keep-alive
  useEffect(() => {
    if (status !== 'connected' || !ip) return;

    const stopLiveSync = startLiveSync();
    const stopStateSync = startStateSync(ip);

    // Fetch effects and palettes for the control panel
    const client = WLEDControlService.getInstance(ip).getRestClient();
    effectPaletteStore.getState().fetchEffects(client);
    effectPaletteStore.getState().fetchPalettes(client);

    // Start sACN control: kill local pattern and begin keep-alive loop
    // Also populate 3D viz with cube's current color
    let sacnController: SACNController | null = null;
    const startSACN = async () => {
      try {
        const sacnOutput = new SACNBridgeOutput();
        sacnController = SACNController.getInstance(sacnOutput);
        await sacnController.startControl(ip);
        console.info('[App] sACN control started — local pattern killed, keep-alive active');
      } catch (err) {
        console.warn('[App] sACN control failed to start (bridge may not be running):', err);
      }
      // Always sync 3D viz with cube's actual color
      try {
        const state = await client.getState();
        const col = state.seg?.[0]?.col?.[0];
        if (col) {
          const [r, g, b] = col;
          const bri = state.bri / 255;
          for (let i = 0; i < 224; i++) {
            ledStateProxy.colors[i * 3] = Math.round(r * bri);
            ledStateProxy.colors[i * 3 + 1] = Math.round(g * bri);
            ledStateProxy.colors[i * 3 + 2] = Math.round(b * bri);
          }
          ledStateProxy.lastUpdated = performance.now();
          console.info(`[App] 3D viz synced: rgb(${r},${g},${b}) @ bri ${state.bri}`);
        }
      } catch (err) {
        console.warn('[App] Failed to sync 3D viz:', err);
      }
    };
    void startSACN();

    return () => {
      stopLiveSync();
      stopStateSync();
      // Stop sACN control and restore cube state
      if (sacnController?.isActive()) {
        sacnController.stopControl().catch((err) => {
          console.warn('[App] Failed to stop sACN control:', err);
        });
      }
    };
  }, [status, ip]);

  function handleWizardComplete(wizardIp: string) {
    localStorage.setItem(WIZARD_STORAGE_KEY, 'true');
    uiStore.getState().setWizardCompleted(true);
    if (wizardIp) {
      connectionStore.getState().setIp(wizardIp);
      void connectToDevice(wizardIp);
    }
    setWizardDone(true);
  }

  return (
    <div className="h-screen flex flex-col bg-background text-foreground overflow-hidden">
      <InputPipelineRunner />
      {!wizardDone && <SetupWizard onComplete={handleWizardComplete} />}

      {/* Header — compact, professional */}
      <header className="flex items-center justify-between px-4 py-2.5 border-b border-border shrink-0 bg-background/80 backdrop-blur-sm z-10">
        <div className="flex items-center gap-2.5">
          <Box className="w-5 h-5 text-primary" strokeWidth={1.5} />
          <h1 className="text-sm font-bold tracking-tight font-heading uppercase text-foreground/90">
            HyperCube
          </h1>
        </div>
        <div className="flex items-center gap-4">
          <ThemePickerCompact />
          {status === 'connected' && <PlayPauseButton />}
          <ConnectionStatus />
        </div>
      </header>

      {/* Main content area */}
      <main className="flex-1 flex flex-col md:flex-row min-h-0 overflow-hidden">
        {wizardDone ? (
          <>
            {/* 3D Cube Viewport — hero element, 65-70% on desktop */}
            <div className="h-[50vh] md:h-auto md:flex-[2] relative shrink-0 md:shrink">
              {/* Ambient glow behind the cube */}
              <div className="absolute inset-0 cube-viewport-glow pointer-events-none z-0" />
              <div className="absolute inset-0 z-[1]">
                <CubeScene />
              </div>
            </div>

            {/* Control Panel Sidebar — sleek dark rack */}
            <div
              className="flex-1 md:flex-none md:w-[420px] md:max-w-[420px] border-t md:border-t-0 md:border-l border-border min-h-0"
              style={{ backgroundColor: '#06060f' }}
            >
              <ControlPanel />
            </div>
          </>
        ) : (
          <p className="text-muted-foreground text-sm p-4">Complete setup to begin.</p>
        )}
      </main>
    </div>
  );
}
