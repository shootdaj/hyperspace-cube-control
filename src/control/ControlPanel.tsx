import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { PowerBrightnessPanel } from './PowerBrightnessPanel';
import { SpeedIntensityPanel } from './SpeedIntensityPanel';
import { ColorPickerPanel } from './ColorPickerPanel';
import { EffectBrowser } from './EffectBrowser';
import { PaletteBrowser } from './PaletteBrowser';
import { PresetPanel } from './PresetPanel';

/**
 * ControlPanel — top-level container for all WLED control components.
 *
 * Layout Strategy:
 * - Uses shadcn Tabs for panel switching (visible on all viewports)
 * - On mobile (< md): tabs serve as primary navigation, one panel at a time
 * - On desktop (>= md): parent layout places this in a sidebar; tabs still work
 *   for organizing content in the fixed-width sidebar
 *
 * Touch targets: all tab triggers are min-h-11 (44px).
 */
export function ControlPanel() {
  return (
    <div className="h-full flex flex-col bg-zinc-950">
      <Tabs defaultValue="controls" className="flex-1 flex flex-col min-h-0">
        <TabsList className="w-full justify-start gap-0 rounded-none border-b border-zinc-800 bg-zinc-950/80 px-1 shrink-0">
          <TabsTrigger value="controls" className="min-h-11 px-3 text-xs data-[state=active]:bg-zinc-800 rounded-md">
            Controls
          </TabsTrigger>
          <TabsTrigger value="effects" className="min-h-11 px-3 text-xs data-[state=active]:bg-zinc-800 rounded-md">
            Effects
          </TabsTrigger>
          <TabsTrigger value="palettes" className="min-h-11 px-3 text-xs data-[state=active]:bg-zinc-800 rounded-md">
            Palettes
          </TabsTrigger>
          <TabsTrigger value="presets" className="min-h-11 px-3 text-xs data-[state=active]:bg-zinc-800 rounded-md">
            Presets
          </TabsTrigger>
        </TabsList>

        <div className="flex-1 overflow-y-auto min-h-0">
          <TabsContent value="controls" className="p-4 space-y-4 mt-0">
            <PowerBrightnessPanel />
            <Separator className="bg-zinc-800" />
            <SpeedIntensityPanel />
            <Separator className="bg-zinc-800" />
            <ColorPickerPanel />
          </TabsContent>

          <TabsContent value="effects" className="p-4 mt-0">
            <EffectBrowser />
          </TabsContent>

          <TabsContent value="palettes" className="p-4 mt-0">
            <PaletteBrowser />
          </TabsContent>

          <TabsContent value="presets" className="p-4 mt-0">
            <PresetPanel />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
