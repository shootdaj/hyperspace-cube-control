import { create } from 'zustand';
import type { MappingStrategyType } from '@/workers/videoWorkerTypes';

interface VideoState {
  /** Whether a video/image has been loaded */
  isLoaded: boolean;
  /** Whether the video is currently playing */
  isPlaying: boolean;
  /** Whether browser autoplay was blocked (needs user interaction) */
  needsInteraction: boolean;
  /** Current mapping strategy */
  strategy: MappingStrategyType;
  /** Current source type */
  sourceType: 'none' | 'video' | 'image';
  /** Source filename for display */
  sourceFilename: string | null;

  setIsLoaded: (loaded: boolean) => void;
  setIsPlaying: (playing: boolean) => void;
  setNeedsInteraction: (needs: boolean) => void;
  setStrategy: (strategy: MappingStrategyType) => void;
  setSourceType: (type: 'none' | 'video' | 'image') => void;
  setSourceFilename: (name: string | null) => void;
  reset: () => void;
}

const initialState = {
  isLoaded: false,
  isPlaying: false,
  needsInteraction: false,
  strategy: 'edge-sampling' as MappingStrategyType,
  sourceType: 'none' as const,
  sourceFilename: null as string | null,
};

export const videoStore = create<VideoState>((set) => ({
  ...initialState,

  setIsLoaded: (loaded) => set({ isLoaded: loaded }),
  setIsPlaying: (playing) => set({ isPlaying: playing }),
  setNeedsInteraction: (needs) => set({ needsInteraction: needs }),
  setStrategy: (strategy) => set({ strategy }),
  setSourceType: (type) => set({ sourceType: type }),
  setSourceFilename: (name) => set({ sourceFilename: name }),
  reset: () => set(initialState),
}));
