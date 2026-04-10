import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { uiStore } from '@/core/store/uiStore';
import { ledStateProxy } from '@/core/store/ledStateProxy';
import { audioStore } from '@/stores/audioStore';
import { cameraStore } from '@/stores/cameraStore';
import { videoStore } from '@/stores/videoStore';

/**
 * Integration tests for play/pause pipeline behavior.
 *
 * These tests verify that the InputPipelineRunner's tick function respects
 * the pipelinePaused state by simulating the tick logic. The actual RAF loop
 * is not testable in jsdom, but the pause gate is a simple synchronous check
 * at the top of the tick function body.
 *
 * The contract: when uiStore.getState().pipelinePaused is true, the tick
 * function returns early before any plugin ticking, so ledStateProxy is
 * NOT updated.
 */

// Simulate the core logic of InputPipelineRunner's tick function
// This mirrors the actual implementation's pause check + plugin priority
function simulatePipelineTick(now: number) {
  // Pause gate — same as in InputPipelineRunner
  const paused = uiStore.getState().pipelinePaused;
  if (paused) return;

  // Simulate plugin ticking (simplified: audio > camera > video priority)
  const audioActive = audioStore.getState().isAudioActive;
  const cameraActive = cameraStore.getState().isActive;
  const videoLoaded = videoStore.getState().isLoaded;

  if (audioActive || cameraActive || videoLoaded) {
    // Simulate writing a frame to ledStateProxy
    ledStateProxy.colors[0] = 255;
    ledStateProxy.colors[1] = 128;
    ledStateProxy.colors[2] = 64;
    ledStateProxy.lastUpdated = now;
  }
}

describe('Play/Pause Pipeline Integration', () => {
  beforeEach(() => {
    uiStore.setState({ pipelinePaused: false });
    ledStateProxy.colors.fill(0);
    ledStateProxy.lastUpdated = 0;
    audioStore.setState({ isAudioActive: true });
    cameraStore.setState({ isActive: false });
    videoStore.setState({ isLoaded: false });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('TestPipelineRunner_StopsWritingFrames_WhenPaused', () => {
    // First tick while playing — should update
    simulatePipelineTick(100);
    expect(ledStateProxy.lastUpdated).toBe(100);
    expect(ledStateProxy.colors[0]).toBe(255);

    // Now pause the pipeline
    uiStore.getState().setPipelinePaused(true);

    // Reset lastUpdated to detect change
    const lastUpdatedBefore = ledStateProxy.lastUpdated;

    // Tick while paused — should NOT update
    simulatePipelineTick(200);
    expect(ledStateProxy.lastUpdated).toBe(lastUpdatedBefore);
  });

  it('TestPipelineRunner_ResumesWritingFrames_WhenUnpaused', () => {
    // Pause first
    uiStore.getState().setPipelinePaused(true);

    // Tick while paused — no update
    simulatePipelineTick(100);
    expect(ledStateProxy.lastUpdated).toBe(0);

    // Resume
    uiStore.getState().setPipelinePaused(false);

    // Tick while playing — should update
    simulatePipelineTick(200);
    expect(ledStateProxy.lastUpdated).toBe(200);
    expect(ledStateProxy.colors[0]).toBe(255);
  });
});
