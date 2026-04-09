import { useState, useEffect } from 'react';
import { ConnectionStatus } from '@/ui/ConnectionStatus';
import { MixedContentWarning } from '@/ui/MixedContentWarning';
import { SetupWizard } from '@/setup/SetupWizard';
import { CubeScene } from '@/visualization/CubeScene';
import { connectionStore } from '@/core/store/connectionStore';
import { uiStore } from '@/core/store/uiStore';
import { WLEDWebSocketService } from '@/core/wled/WLEDWebSocketService';
import { startLiveSync } from '@/core/pipeline/WLEDLiveSync';

const WIZARD_STORAGE_KEY = 'wizardCompleted';

export default function App() {
  const [wizardDone, setWizardDone] = useState(
    () => localStorage.getItem(WIZARD_STORAGE_KEY) === 'true',
  );
  const status = connectionStore((state) => state.status);

  // Start live LED sync when connected — CubeMesh.useFrame picks up changes automatically
  useEffect(() => {
    if (status !== 'connected') return;
    const stopSync = startLiveSync();
    return stopSync;
  }, [status]);

  function handleWizardComplete(ip: string) {
    localStorage.setItem(WIZARD_STORAGE_KEY, 'true');
    uiStore.getState().setWizardCompleted(true);
    if (ip) {
      connectionStore.getState().setIp(ip);
      WLEDWebSocketService.getInstance().connect(ip);
    }
    setWizardDone(true);
  }

  return (
    <div className="min-h-screen flex flex-col bg-zinc-950 text-zinc-100">
      <MixedContentWarning />
      {!wizardDone && <SetupWizard onComplete={handleWizardComplete} />}
      <header className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
        <h1 className="text-lg font-bold tracking-tight">HyperCube Control</h1>
        <ConnectionStatus />
      </header>
      <main className="flex-1 relative">
        {wizardDone ? (
          <div className="absolute inset-0">
            <CubeScene />
          </div>
        ) : (
          <p className="text-zinc-600 text-sm p-4">Complete setup to begin.</p>
        )}
      </main>
    </div>
  );
}
