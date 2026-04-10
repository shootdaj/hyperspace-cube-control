import { useState, useCallback, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { effectPaletteStore } from '@/core/store/effectPaletteStore';
import { cubeStateStore } from '@/core/store/cubeStateStore';
import { connectionStore } from '@/core/store/connectionStore';
import { WLEDControlService } from '@/core/wled/WLEDControlService';
import { Search, Palette, Check } from 'lucide-react';

/**
 * PaletteBrowser — scrollable, searchable grid of all WLED color palettes.
 * Redesigned: 2-column card grid, active palette highlighted, search with icon.
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
    <div className="flex flex-col h-full space-y-4">
      <div className="section-header">
        <Palette className="w-3.5 h-3.5 text-primary" />
        <span>Palettes</span>
        <span className="ml-auto text-[10px] font-mono text-muted-foreground/60 normal-case tracking-normal">
          {filteredPalettes.length} available
        </span>
      </div>

      {/* Search input with icon */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search palettes..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 min-h-11 bg-secondary/50"
        />
      </div>

      <ScrollArea className="flex-1 max-h-[400px]">
        <div className="grid grid-cols-2 gap-1.5">
          {filteredPalettes.map(({ name, index }) => {
            const isActive = index === activePalette;
            return (
              <button
                key={index}
                data-palette-item=""
                data-active={isActive ? 'true' : 'false'}
                onClick={() => handleSelect(index)}
                className={`
                  relative text-left px-3 py-2.5 rounded-md text-xs
                  transition-all duration-150 cursor-pointer min-h-11
                  border
                  ${isActive
                    ? 'bg-primary/15 text-primary-foreground border-primary/40 shadow-[0_0_12px_rgba(59,130,246,0.1)]'
                    : 'bg-secondary/30 border-transparent hover:bg-accent/50 hover:border-border text-foreground/80 hover:text-foreground'
                  }
                `}
              >
                <span className="block truncate text-[13px] font-medium">{name}</span>
                <span className="block text-[10px] mt-0.5 font-mono opacity-40">
                  #{index}
                </span>
                {isActive && (
                  <Check className="absolute top-2 right-2 w-3.5 h-3.5 text-primary" />
                )}
              </button>
            );
          })}
        </div>
        {filteredPalettes.length === 0 && (
          <p className="text-sm text-muted-foreground py-8 text-center">
            No palettes found
          </p>
        )}
      </ScrollArea>
    </div>
  );
}
