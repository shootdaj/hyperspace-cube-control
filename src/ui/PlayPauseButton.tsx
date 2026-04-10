import { Play, Pause } from 'lucide-react';
import { uiStore } from '@/core/store/uiStore';

export function PlayPauseButton() {
  const paused = uiStore((s) => s.pipelinePaused);

  const label = paused ? 'Resume pipeline' : 'Pause pipeline';

  return (
    <button
      type="button"
      onClick={() => uiStore.getState().setPipelinePaused(!paused)}
      className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded"
      aria-label={label}
      title={label}
    >
      {paused ? (
        <Play className="w-4 h-4" />
      ) : (
        <Pause className="w-4 h-4" />
      )}
    </button>
  );
}
