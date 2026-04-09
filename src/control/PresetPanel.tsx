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

/**
 * PresetPanel — save, load, and delete named presets.
 * Presets persist to localStorage (up to 50).
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
    <div className="flex flex-col h-full">
      <Button
        onClick={() => setDialogOpen(true)}
        className="w-full min-h-11 mb-3"
        aria-label="Save current preset"
      >
        Save Current
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

      <ScrollArea className="flex-1 max-h-[300px]">
        {presets.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">
            No presets saved. Save your current setup!
          </p>
        ) : (
          <div className="space-y-1">
            {presets.map((preset) => (
              <div
                key={preset.id}
                className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-accent/50"
              >
                <span className="flex-1 text-sm truncate">{preset.name}</span>
                <Button
                  size="sm"
                  variant="default"
                  className="min-h-9 px-3 text-xs"
                  onClick={() => handleApply(preset.id)}
                  aria-label="Apply preset"
                >
                  Apply
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  className="min-h-9 px-3 text-xs"
                  onClick={() => handleDelete(preset.id)}
                  aria-label="Delete preset"
                >
                  Delete
                </Button>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
