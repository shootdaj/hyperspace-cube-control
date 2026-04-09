import { useState } from 'react';
import { ConnectionStatus } from '@/ui/ConnectionStatus';
import { MixedContentWarning } from '@/ui/MixedContentWarning';
import { SetupWizard } from '@/setup/SetupWizard';
import { connectionStore } from '@/core/store/connectionStore';
import { uiStore } from '@/core/store/uiStore';
import { WLEDWebSocketService } from '@/core/wled/WLEDWebSocketService';

const WIZARD_STORAGE_KEY = 'wizardCompleted';

export default function App() {
  const [wizardDone, setWizardDone] = useState(
    () => localStorage.getItem(WIZARD_STORAGE_KEY) === 'true',
  );

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
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <MixedContentWarning />
      {!wizardDone && <SetupWizard onComplete={handleWizardComplete} />}
      <header className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
        <h1 className="text-lg font-bold tracking-tight">HyperCube Control</h1>
        <ConnectionStatus />
      </header>
      <main className="p-4">
        {wizardDone ? (
          <p className="text-zinc-500 text-sm">Cube connected. Controls coming in the next phase.</p>
        ) : (
          <p className="text-zinc-600 text-sm">Complete setup to begin.</p>
        )}
      </main>
    </div>
  );
}
