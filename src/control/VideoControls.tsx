import { useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { videoStore } from '@/stores/videoStore';
import { videoPlugin } from '@/plugins/inputs/videoSingleton';
import { DEFAULT_LED_COUNT } from '@/core/constants';
import type { MappingStrategyType } from '@/workers/videoWorkerTypes';

const STRATEGIES: { value: MappingStrategyType; label: string; description: string }[] = [
  { value: 'edge-sampling', label: 'Edge Sampling', description: 'Sample colors along 12 edges' },
  { value: 'face-extraction', label: 'Face Extraction', description: 'Map faces then extract edges' },
];

/**
 * VideoControls — UI panel for video/image-to-LED mapping.
 *
 * Provides: file upload, URL input, play/pause, mapping strategy switcher.
 * All touch targets are min-h-11 (44px) for mobile accessibility.
 */
export function VideoControls() {
  const isLoaded = videoStore((s) => s.isLoaded);
  const isPlaying = videoStore((s) => s.isPlaying);
  const needsInteraction = videoStore((s) => s.needsInteraction);
  const strategy = videoStore((s) => s.strategy);
  const sourceType = videoStore((s) => s.sourceType);
  const sourceFilename = videoStore((s) => s.sourceFilename);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      // Initialize the worker (idempotent — safe to call multiple times)
      await videoPlugin.initialize({ ledCount: DEFAULT_LED_COUNT, frameRate: 30 });

      const isVideo = file.type.startsWith('video/');
      const isImage = file.type.startsWith('image/');

      if (isVideo) {
        videoStore.getState().setSourceType('video');
        videoStore.getState().setSourceFilename(file.name);
        await videoPlugin.loadVideo(file);
      } else if (isImage) {
        videoStore.getState().setSourceType('image');
        videoStore.getState().setSourceFilename(file.name);
        await videoPlugin.loadImage(file);
      } else {
        console.error('Unsupported file type:', file.type);
      }
    } catch (err) {
      console.error('Failed to load file:', err);
    }

    // Reset input so same file can be re-selected
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  const handlePlayPause = useCallback(() => {
    videoPlugin.togglePlayback();
  }, []);

  const handleStrategyChange = useCallback((value: MappingStrategyType) => {
    videoPlugin.setStrategy(value);
  }, []);

  const handleUnload = useCallback(() => {
    videoPlugin.destroy();
    // Re-initialize for next use
    videoPlugin.initialize({ ledCount: DEFAULT_LED_COUNT, frameRate: 30 }).catch(console.error);
  }, []);

  return (
    <div className="space-y-4">
      {/* Video Status */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Video Status</Label>
        <div className="flex items-center gap-2">
          <span
            className={`inline-block h-2 w-2 rounded-full ${
              isLoaded && isPlaying
                ? 'bg-green-500'
                : isLoaded
                  ? 'bg-yellow-500'
                  : 'bg-muted'
            }`}
          />
          <span className="text-xs text-muted-foreground">
            {isLoaded && isPlaying
              ? `Playing: ${sourceFilename ?? 'video'}`
              : isLoaded
                ? `Loaded: ${sourceFilename ?? 'media'}`
                : 'No video loaded'}
          </span>
        </div>
        {needsInteraction && (
          <p className="text-xs text-amber-400">
            Browser blocked autoplay. Click Play to start.
          </p>
        )}
      </div>

      {/* File Upload */}
      <div className="space-y-2">
        <input
          ref={fileInputRef}
          type="file"
          accept="video/*,image/*"
          onChange={handleFileSelect}
          className="hidden"
          aria-label="Select video or image file"
        />
        <Button
          aria-label="Load Video or Image"
          className="w-full min-h-11 text-sm font-medium bg-violet-600 hover:bg-violet-700 text-white"
          onClick={() => fileInputRef.current?.click()}
        >
          Load Video / Image
        </Button>
      </div>

      {/* Play/Pause + Unload */}
      {isLoaded && (
        <div className="flex gap-2">
          {sourceType === 'video' && (
            <Button
              aria-label={isPlaying ? 'Pause Video' : 'Play Video'}
              variant="outline"
              className="flex-1 min-h-11 text-sm font-medium border-border text-secondary-foreground hover:text-foreground"
              onClick={handlePlayPause}
            >
              {isPlaying ? 'Pause' : 'Play'}
            </Button>
          )}
          <Button
            aria-label="Unload Media"
            variant="outline"
            className="flex-1 min-h-11 text-sm font-medium border-border text-muted-foreground hover:text-red-400 hover:border-red-700"
            onClick={handleUnload}
          >
            Unload
          </Button>
        </div>
      )}

      <Separator className="bg-border" />

      {/* Mapping Strategy */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Mapping Strategy</Label>
        <div className="grid grid-cols-2 gap-2">
          {STRATEGIES.map((s) => (
            <Button
              key={s.value}
              aria-label={s.label}
              variant={strategy === s.value ? 'default' : 'outline'}
              className={`min-h-11 flex flex-col gap-0.5 text-xs ${
                strategy === s.value
                  ? 'bg-secondary text-foreground ring-1 ring-ring'
                  : 'border-border text-muted-foreground hover:text-foreground'
              }`}
              onClick={() => handleStrategyChange(s.value)}
            >
              <span className="font-medium">{s.label}</span>
              <span className="text-[10px] opacity-60">{s.description}</span>
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}
