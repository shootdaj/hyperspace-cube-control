import { describe, it, expect, beforeEach } from 'vitest';
import { videoStore } from '../videoStore';

describe('videoStore', () => {
  beforeEach(() => {
    videoStore.getState().reset();
  });

  it('TestVideoStore_DefaultState', () => {
    const state = videoStore.getState();
    expect(state.isLoaded).toBe(false);
    expect(state.isPlaying).toBe(false);
    expect(state.needsInteraction).toBe(false);
    expect(state.strategy).toBe('edge-sampling');
    expect(state.sourceType).toBe('none');
    expect(state.sourceFilename).toBeNull();
  });

  it('TestVideoStore_SetIsLoaded', () => {
    videoStore.getState().setIsLoaded(true);
    expect(videoStore.getState().isLoaded).toBe(true);
  });

  it('TestVideoStore_SetIsPlaying', () => {
    videoStore.getState().setIsPlaying(true);
    expect(videoStore.getState().isPlaying).toBe(true);
  });

  it('TestVideoStore_SetStrategy', () => {
    videoStore.getState().setStrategy('face-extraction');
    expect(videoStore.getState().strategy).toBe('face-extraction');
  });

  it('TestVideoStore_SetSourceType', () => {
    videoStore.getState().setSourceType('video');
    expect(videoStore.getState().sourceType).toBe('video');
  });

  it('TestVideoStore_SetSourceFilename', () => {
    videoStore.getState().setSourceFilename('test.mp4');
    expect(videoStore.getState().sourceFilename).toBe('test.mp4');
  });

  it('TestVideoStore_Reset', () => {
    videoStore.getState().setIsLoaded(true);
    videoStore.getState().setIsPlaying(true);
    videoStore.getState().setStrategy('face-extraction');
    videoStore.getState().setSourceType('video');
    videoStore.getState().setSourceFilename('test.mp4');

    videoStore.getState().reset();

    const state = videoStore.getState();
    expect(state.isLoaded).toBe(false);
    expect(state.isPlaying).toBe(false);
    expect(state.strategy).toBe('edge-sampling');
    expect(state.sourceType).toBe('none');
    expect(state.sourceFilename).toBeNull();
  });
});
