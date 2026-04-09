import { useState, useCallback, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { effectPaletteStore } from '@/core/store/effectPaletteStore';
import { cubeStateStore } from '@/core/store/cubeStateStore';
import { connectionStore } from '@/core/store/connectionStore';
import { WLEDControlService } from '@/core/wled/WLEDControlService';

/** Reserved effect names in WLED 0.14+ — filter these out */
const RESERVED = new Set(['RSVD', '-', '']);

/**
 * EffectBrowser — scrollable, searchable list of all WLED effects.
 * One-tap activation. Active effect highlighted.
 */
export function EffectBrowser() {
  const effects = effectPaletteStore((s) => s.effects);
  const activeEffect = cubeStateStore((s) => s.effectIndex);
  const ip = connectionStore((s) => s.ip);
  const [search, setSearch] = useState('');

  const filteredEffects = useMemo(() => {
    return effects
      .map((name, index) => ({ name, index }))
      .filter(({ name }) => !RESERVED.has(name))
      .filter(({ name }) =>
        search === '' || name.toLowerCase().includes(search.toLowerCase()),
      );
  }, [effects, search]);

  const handleSelect = useCallback(
    (index: number) => {
      if (!ip) return;
      const service = WLEDControlService.getInstance(ip);
      service.setEffect(index);
    },
    [ip],
  );

  return (
    <div className="flex flex-col h-full">
      <Input
        placeholder="Search effects..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="mb-2 min-h-11"
      />
      <ScrollArea className="flex-1 max-h-[300px]">
        <div className="space-y-0.5">
          {filteredEffects.map(({ name, index }) => (
            <button
              key={index}
              data-effect-item=""
              data-active={index === activeEffect ? 'true' : 'false'}
              onClick={() => handleSelect(index)}
              className={`
                w-full text-left px-3 py-2 min-h-11 rounded-md text-sm
                flex items-center justify-between gap-2
                transition-colors cursor-pointer
                ${
                  index === activeEffect
                    ? 'bg-primary text-primary-foreground'
                    : 'hover:bg-accent hover:text-accent-foreground'
                }
              `}
            >
              <span className="truncate">{name}</span>
              <span className="text-xs opacity-60 tabular-nums shrink-0">
                #{index}
              </span>
            </button>
          ))}
          {filteredEffects.length === 0 && (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No effects found
            </p>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
