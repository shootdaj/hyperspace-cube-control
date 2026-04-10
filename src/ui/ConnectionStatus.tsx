import { connectionStore } from '@/core/store/connectionStore';

const STATUS_CONFIG = {
  connected: {
    label: 'Connected',
    dotClass: 'bg-green-500 pulse-connected',
    textClass: 'text-green-400',
  },
  reconnecting: {
    label: 'Reconnecting...',
    dotClass: 'bg-amber-400 animate-pulse',
    textClass: 'text-amber-400',
  },
  connecting: {
    label: 'Connecting...',
    dotClass: 'bg-blue-400 animate-pulse',
    textClass: 'text-blue-400',
  },
  disconnected: {
    label: 'Offline',
    dotClass: 'bg-muted-foreground/50',
    textClass: 'text-muted-foreground/60',
  },
} as const;

export function ConnectionStatus() {
  const status = connectionStore((s) => s.status);
  const ip = connectionStore((s) => s.ip);
  const config = STATUS_CONFIG[status];

  return (
    <div className="flex items-center gap-2" role="status" aria-label={`Connection: ${config.label}`}>
      <span
        className={`inline-block h-2.5 w-2.5 rounded-full ${config.dotClass}`}
        data-status={status}
      />
      <div className="flex items-center gap-1.5">
        <span className={`text-xs font-medium ${config.textClass}`}>
          {config.label}
        </span>
        {ip && status === 'connected' && (
          <span className="text-[10px] font-mono text-muted-foreground/50 hidden sm:inline">
            {ip}
          </span>
        )}
      </div>
    </div>
  );
}
