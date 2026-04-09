import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { PowerBrightnessPanel } from './PowerBrightnessPanel';
import { SpeedIntensityPanel } from './SpeedIntensityPanel';
import { ColorPickerPanel } from './ColorPickerPanel';
import { EffectBrowser } from './EffectBrowser';
import { PaletteBrowser } from './PaletteBrowser';
import { PresetPanel } from './PresetPanel';
import { PaintControls } from './PaintControls';
import { AudioControls } from './AudioControls';
import { MIDIControls } from './MIDIControls';
import { VideoControls } from './VideoControls';
import { CameraControls } from './CameraControls';
import { ThemePicker } from '@/themes/ThemePicker';

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
    <div className="h-full flex flex-col bg-background theme-panel-texture">
      <Tabs defaultValue="controls" className="flex-1 flex flex-col min-h-0">
        <TabsList className="w-full justify-start gap-0 rounded-none border-b border-border bg-background/80 px-1 shrink-0 overflow-x-auto">
          <TabsTrigger value="controls" className="min-h-11 px-3 text-xs data-[state=active]:bg-secondary rounded-md">
            Controls
          </TabsTrigger>
          <TabsTrigger value="paint" className="min-h-11 px-3 text-xs data-[state=active]:bg-secondary rounded-md">
            Paint
          </TabsTrigger>
          <TabsTrigger value="effects" className="min-h-11 px-3 text-xs data-[state=active]:bg-secondary rounded-md">
            Effects
          </TabsTrigger>
          <TabsTrigger value="palettes" className="min-h-11 px-3 text-xs data-[state=active]:bg-secondary rounded-md">
            Palettes
          </TabsTrigger>
          <TabsTrigger value="presets" className="min-h-11 px-3 text-xs data-[state=active]:bg-secondary rounded-md">
            Presets
          </TabsTrigger>
          <TabsTrigger value="audio" className="min-h-11 px-3 text-xs data-[state=active]:bg-secondary rounded-md">
            Audio
          </TabsTrigger>
          <TabsTrigger value="midi" className="min-h-11 px-3 text-xs data-[state=active]:bg-secondary rounded-md">
            MIDI
          </TabsTrigger>
          <TabsTrigger value="video" className="min-h-11 px-3 text-xs data-[state=active]:bg-secondary rounded-md">
            Video
          </TabsTrigger>
          <TabsTrigger value="camera" className="min-h-11 px-3 text-xs data-[state=active]:bg-secondary rounded-md">
            Camera
          </TabsTrigger>
          <TabsTrigger value="settings" className="min-h-11 px-3 text-xs data-[state=active]:bg-secondary rounded-md">
            Settings
          </TabsTrigger>
        </TabsList>

        <div className="flex-1 overflow-y-auto min-h-0">
          <TabsContent value="controls" className="p-4 space-y-4 mt-0">
            <PowerBrightnessPanel />
            <Separator className="bg-border" />
            <SpeedIntensityPanel />
            <Separator className="bg-border" />
            <ColorPickerPanel />
          </TabsContent>

          <TabsContent value="paint" className="p-4 mt-0">
            <PaintControls />
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

          <TabsContent value="audio" className="p-4 mt-0">
            <AudioControls />
          </TabsContent>

          <TabsContent value="midi" className="p-4 mt-0">
            <MIDIControls />
          </TabsContent>

          <TabsContent value="video" className="p-4 mt-0">
            <VideoControls />
          </TabsContent>

          <TabsContent value="camera" className="p-4 mt-0">
            <CameraControls />
          </TabsContent>

          <TabsContent value="settings" className="p-4 mt-0">
            <ThemePicker />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
