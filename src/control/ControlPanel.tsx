import { useState, useCallback } from 'react';
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
import { ConnectionSettings } from './ConnectionSettings';
import { paintStore } from '@/stores/paintStore';
import { SACNController } from '@/core/wled/SACNController';
import { connectionStore } from '@/core/store/connectionStore';
import {
  SlidersHorizontal,
  Paintbrush,
  Sparkles,
  Palette,
  BookmarkCheck,
  AudioLines,
  Piano,
  Video,
  Camera,
  Settings,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface NavItem {
  id: string;
  label: string;
  icon: LucideIcon;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'controls', label: 'Controls', icon: SlidersHorizontal },
  { id: 'paint', label: 'Paint', icon: Paintbrush },
  { id: 'effects', label: 'Effects', icon: Sparkles },
  { id: 'palettes', label: 'Palettes', icon: Palette },
  { id: 'presets', label: 'Presets', icon: BookmarkCheck },
  { id: 'audio', label: 'Audio', icon: AudioLines },
  { id: 'midi', label: 'MIDI', icon: Piano },
  { id: 'video', label: 'Video', icon: Video },
  { id: 'camera', label: 'Camera', icon: Camera },
  { id: 'settings', label: 'Settings', icon: Settings },
];

/**
 * ControlPanel — top-level container for all WLED control components.
 *
 * Layout: Icon-based vertical sidebar nav on desktop (like Ableton's browser categories),
 * horizontal icon bar on mobile. Each panel section gets a subtle header with accent border.
 * More spacing between controls, larger touch targets.
 */
export function ControlPanel() {
  const [activeTab, setActiveTab] = useState('controls');

  /**
   * Handle tab changes. Auto-enables paint mode when switching to the paint tab
   * and disables it when leaving. Also kills the firmware effect so paint/sACN
   * has direct LED control.
   */
  const handleTabChange = useCallback((tabId: string) => {
    const wasPaint = activeTab === 'paint';
    const isPaint = tabId === 'paint';

    setActiveTab(tabId);

    if (isPaint && !wasPaint) {
      // Entering paint tab — enable paint mode automatically
      paintStore.getState().setIsPaintMode(true);

      // Kill firmware effect for direct LED control (same as old toggle did)
      let sacnActive = false;
      try { sacnActive = SACNController.getInstance().isActive(); } catch { /* not init */ }
      if (!sacnActive) {
        const ip = connectionStore.getState().ip;
        if (ip) {
          fetch(`http://${ip}/json/state`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ on: true, bri: 255, seg: [{ fx: 0, sx: 0, ix: 0 }] }),
          }).catch(() => {});
        }
      }
    } else if (wasPaint && !isPaint) {
      // Leaving paint tab — disable paint mode
      paintStore.getState().setIsPaintMode(false);
    }
  }, [activeTab]);

  return (
    <div className="h-full flex flex-col md:flex-row bg-background theme-panel-texture">
      {/* Navigation — horizontal on mobile, vertical on desktop */}
      <nav className="shrink-0 border-b md:border-b-0 md:border-r border-border bg-card/30">
        {/* Mobile: horizontal scroll bar */}
        <div className="flex md:hidden overflow-x-auto px-1 py-1.5 gap-0.5 scrollbar-none">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleTabChange(item.id)}
                className={`
                  flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium shrink-0
                  transition-all duration-150 cursor-pointer min-h-[40px]
                  ${isActive
                    ? 'bg-primary/15 text-primary border border-primary/30'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent/50 border border-transparent'
                  }
                `}
                aria-label={item.label}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>

        {/* Desktop: vertical icon strip */}
        <div className="hidden md:flex flex-col items-center py-3 px-1.5 gap-1 w-[52px]">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleTabChange(item.id)}
                title={item.label}
                className={`
                  relative flex items-center justify-center w-9 h-9 rounded-md
                  transition-all duration-150 cursor-pointer
                  ${isActive
                    ? 'nav-icon-active'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
                  }
                `}
                aria-label={item.label}
                aria-current={isActive ? 'page' : undefined}
              >
                <Icon className="w-[18px] h-[18px]" strokeWidth={isActive ? 2 : 1.5} />
                {/* Active indicator bar */}
                {isActive && (
                  <span className="absolute left-0 top-1.5 bottom-1.5 w-[2px] rounded-full bg-primary" />
                )}
              </button>
            );
          })}
        </div>
      </nav>

      {/* Panel content area */}
      <div className="flex-1 overflow-y-auto min-h-0 control-scrollbar">
        {activeTab === 'controls' && (
          <div className="p-5 space-y-6">
            <PowerBrightnessPanel />
            <Separator className="bg-border/60" />
            <SpeedIntensityPanel />
            <Separator className="bg-border/60" />
            <ColorPickerPanel />
          </div>
        )}

        {activeTab === 'paint' && (
          <div className="p-5">
            <PaintControls />
          </div>
        )}

        {activeTab === 'effects' && (
          <div className="p-5">
            <EffectBrowser />
          </div>
        )}

        {activeTab === 'palettes' && (
          <div className="p-5">
            <PaletteBrowser />
          </div>
        )}

        {activeTab === 'presets' && (
          <div className="p-5">
            <PresetPanel />
          </div>
        )}

        {activeTab === 'audio' && (
          <div className="p-5">
            <AudioControls />
          </div>
        )}

        {activeTab === 'midi' && (
          <div className="p-5">
            <MIDIControls />
          </div>
        )}

        {activeTab === 'video' && (
          <div className="p-5">
            <VideoControls />
          </div>
        )}

        {activeTab === 'camera' && (
          <div className="p-5">
            <CameraControls />
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="p-5 space-y-6">
            <ConnectionSettings />
            <Separator className="bg-border/60" />
            <ThemePicker />
          </div>
        )}
      </div>
    </div>
  );
}
