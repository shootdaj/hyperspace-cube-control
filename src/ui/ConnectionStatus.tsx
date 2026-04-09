import { connectionStore } from '@/core/store/connectionStore';

const STATUS_CONFIG = {
  connected: {
    label: 'Connected',
    dotClass: 'bg-green-500',
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
    label: 'Disconnected',
    dotClass: 'bg-muted-foreground',
    textClass: 'text-muted-foreground',
  },
} as const;

export function ConnectionStatus() {
  const status = connectionStore((s) => s.status);
  const config = STATUS_CONFIG[status];

  return (
    <div className="flex items-center gap-2" role="status" aria-label={`Connection: ${config.label}`}>
      <span
        className={`inline-block h-2 w-2 rounded-full ${config.dotClass}`}
        data-status={status}
      />
      <span className={`text-xs font-medium ${config.textClass}`}>
        {config.label}
      </span>
    </div>
  );
}
