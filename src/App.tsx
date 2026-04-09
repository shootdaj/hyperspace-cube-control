import { useState, useEffect } from 'react';
import { ConnectionStatus } from '@/ui/ConnectionStatus';
import { MixedContentWarning } from '@/ui/MixedContentWarning';
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

const WIZARD_STORAGE_KEY = 'wizardCompleted';

export default function App() {
  const [wizardDone, setWizardDone] = useState(
    () => localStorage.getItem(WIZARD_STORAGE_KEY) === 'true',
  );
  const status = connectionStore((state) => state.status);
  const ip = connectionStore((state) => state.ip);

  // Load presets from localStorage on mount
  useEffect(() => {
    presetStore.getState().loadPresets();
  }, []);

  // Start live LED sync + state sync when connected; fetch effects and palettes
  useEffect(() => {
    if (status !== 'connected' || !ip) return;

    const stopLiveSync = startLiveSync();
    const stopStateSync = startStateSync();

    // Fetch effects and palettes for the control panel
    const client = WLEDControlService.getInstance(ip).getRestClient();
    effectPaletteStore.getState().fetchEffects(client);
    effectPaletteStore.getState().fetchPalettes(client);

    return () => {
      stopLiveSync();
      stopStateSync();
    };
  }, [status, ip]);

  function handleWizardComplete(wizardIp: string) {
    localStorage.setItem(WIZARD_STORAGE_KEY, 'true');
    uiStore.getState().setWizardCompleted(true);
    if (wizardIp) {
      connectionStore.getState().setIp(wizardIp);
      WLEDWebSocketService.getInstance().connect(wizardIp);
    }
    setWizardDone(true);
  }

  return (
    <div className="min-h-screen flex flex-col bg-zinc-950 text-zinc-100">
      <MixedContentWarning />
      {!wizardDone && <SetupWizard onComplete={handleWizardComplete} />}
      <header className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 shrink-0">
        <h1 className="text-lg font-bold tracking-tight">HyperCube Control</h1>
        <ConnectionStatus />
      </header>
      <main className="flex-1 flex flex-col md:flex-row min-h-0">
        {wizardDone ? (
          <>
            {/* 3D Cube — 40vh on mobile, flex-1 on desktop */}
            <div className="h-[40vh] md:h-auto md:flex-1 relative shrink-0 md:shrink">
              <div className="absolute inset-0">
                <CubeScene />
              </div>
            </div>
            {/* Control Panel — full width on mobile, 400px sidebar on desktop */}
            <div className="flex-1 md:flex-none md:w-[400px] md:max-w-[400px] border-t md:border-t-0 md:border-l border-zinc-800 min-h-0">
              <ControlPanel />
            </div>
          </>
        ) : (
          <p className="text-zinc-600 text-sm p-4">Complete setup to begin.</p>
        )}
      </main>
    </div>
  );
}
