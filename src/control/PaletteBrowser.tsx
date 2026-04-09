import { useState, useCallback, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { effectPaletteStore } from '@/core/store/effectPaletteStore';
import { cubeStateStore } from '@/core/store/cubeStateStore';
import { connectionStore } from '@/core/store/connectionStore';
import { WLEDControlService } from '@/core/wled/WLEDControlService';

/**
 * PaletteBrowser — scrollable, searchable list of all WLED color palettes.
 * One-tap to apply a palette. Active palette highlighted.
 */
export function PaletteBrowser() {
  const palettes = effectPaletteStore((s) => s.palettes);
  const activePalette = cubeStateStore((s) => s.paletteIndex);
  const ip = connectionStore((s) => s.ip);
  const [search, setSearch] = useState('');

  const filteredPalettes = useMemo(() => {
    return palettes
      .map((name, index) => ({ name, index }))
      .filter(({ name }) =>
        search === '' || name.toLowerCase().includes(search.toLowerCase()),
      );
  }, [palettes, search]);

  const handleSelect = useCallback(
    (index: number) => {
      if (!ip) return;
      const service = WLEDControlService.getInstance(ip);
      service.setPalette(index);
    },
    [ip],
  );

  return (
    <div className="flex flex-col h-full">
      <Input
        placeholder="Search palettes..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="mb-2 min-h-11"
      />
      <ScrollArea className="flex-1 max-h-[300px]">
        <div className="space-y-0.5">
          {filteredPalettes.map(({ name, index }) => (
            <button
              key={index}
              data-palette-item=""
              data-active={index === activePalette ? 'true' : 'false'}
              onClick={() => handleSelect(index)}
              className={`
                w-full text-left px-3 py-2 min-h-11 rounded-md text-sm
                flex items-center justify-between gap-2
                transition-colors cursor-pointer
                ${
                  index === activePalette
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
          {filteredPalettes.length === 0 && (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No palettes found
            </p>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
