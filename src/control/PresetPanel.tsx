import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { presetStore } from '@/core/store/presetStore';
import { connectionStore } from '@/core/store/connectionStore';
import { BookmarkCheck, Plus, Play, Trash2 } from 'lucide-react';

/**
 * PresetPanel — save, load, and delete named presets.
 * Redesigned: Section header, better card layout, icon buttons.
 */
export function PresetPanel() {
  const presets = presetStore((s) => s.presets);
  const ip = connectionStore((s) => s.ip);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [presetName, setPresetName] = useState('');

  const handleSave = useCallback(() => {
    if (!presetName.trim()) return;
    presetStore.getState().savePreset(presetName.trim());
    setPresetName('');
    setDialogOpen(false);
  }, [presetName]);

  const handleApply = useCallback(
    (id: string) => {
      if (!ip) return;
      presetStore.getState().applyPreset(id, ip);
    },
    [ip],
  );

  const handleDelete = useCallback((id: string) => {
    presetStore.getState().deletePreset(id);
  }, []);

  return (
    <div className="flex flex-col h-full space-y-4">
      <div className="section-header">
        <BookmarkCheck className="w-3.5 h-3.5 text-primary" />
        <span>Presets</span>
        <span className="ml-auto text-[10px] font-mono text-muted-foreground/60 normal-case tracking-normal">
          {presets.length} saved
        </span>
      </div>

      <Button
        onClick={() => setDialogOpen(true)}
        className="w-full min-h-11 gap-2"
        aria-label="Save current preset"
      >
        <Plus className="w-4 h-4" />
        Save Current State
      </Button>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save Preset</DialogTitle>
          </DialogHeader>
          <Input
            placeholder="Preset name..."
            value={presetName}
            onChange={(e) => setPresetName(e.target.value)}
            className="min-h-11"
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSave();
            }}
          />
          <DialogFooter>
            <DialogClose
              className="inline-flex items-center justify-center rounded-lg border border-input bg-background
                px-4 py-2 text-sm font-medium min-h-11 hover:bg-accent hover:text-accent-foreground
                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Cancel
            </DialogClose>
            <Button onClick={handleSave} className="min-h-11" aria-label="Save">
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ScrollArea className="flex-1 max-h-[400px]">
        {presets.length === 0 ? (
          <div className="text-center py-12">
            <BookmarkCheck className="w-8 h-8 mx-auto text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground">
              No presets saved yet
            </p>
            <p className="text-xs text-muted-foreground/60 mt-1">
              Save your current setup to recall it later
            </p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {presets.map((preset) => (
              <div
                key={preset.id}
                className="flex items-center gap-2 px-3 py-2.5 rounded-md bg-secondary/30 border border-transparent hover:border-border transition-colors"
              >
                <span className="flex-1 text-sm font-medium truncate">{preset.name}</span>
                <button
                  onClick={() => handleApply(preset.id)}
                  className="flex items-center justify-center w-8 h-8 rounded-md bg-primary/15 text-primary hover:bg-primary/25 transition-colors cursor-pointer"
                  aria-label="Apply preset"
                >
                  <Play className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => handleDelete(preset.id)}
                  className="flex items-center justify-center w-8 h-8 rounded-md text-destructive/60 hover:bg-destructive/15 hover:text-destructive transition-colors cursor-pointer"
                  aria-label="Delete preset"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
