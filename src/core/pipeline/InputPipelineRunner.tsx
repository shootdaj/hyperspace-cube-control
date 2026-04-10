import { useEffect, useRef } from 'react';
import { ledStateProxy } from '@/core/store/ledStateProxy';
import { uiStore } from '@/core/store/uiStore';
import { audioPlugin } from '@/plugins/inputs/audioSingleton';
import { cameraPlugin } from '@/plugins/inputs/cameraSingleton';
import { videoPlugin } from '@/plugins/inputs/videoSingleton';
import { audioStore } from '@/stores/audioStore';
import { cameraStore } from '@/stores/cameraStore';
import { videoStore } from '@/stores/videoStore';
import { AudioSpectrumMappingStrategy } from '@/plugins/mappings/AudioSpectrumMappingStrategy';
import { DEFAULT_LED_COUNT } from '@/core/constants';

const TARGET_FPS = 30;
const FRAME_INTERVAL_MS = 1000 / TARGET_FPS;

/**
 * InputPipelineRunner — RAF loop that ticks active input plugins and writes
 * their LED output to ledStateProxy.
 *
 * This bridges the gap between input plugins (audio/camera/video) and the
 * visualization + sACN output. Each plugin produces LED data via tick(),
 * which gets written to ledStateProxy. The useFrame loop in CubeMesh reads
 * ledStateProxy for 3D rendering, and forwards it to SACNController for
 * physical cube output.
 *
 * Runs at 30fps. Only one input plugin is active at a time (audio OR camera
 * OR video). Paint mode bypasses this entirely — it writes to ledStateProxy
 * directly from pointer handlers.
 *
 * Plugin initialization happens in the respective Controls components
 * (AudioControls, CameraControls, VideoControls) on user gesture. The tick()
 * methods return null if the plugin is not initialized, so no initialization
 * is needed here.
 *
 * Mount this component once at the app level (outside Canvas).
 */
export function InputPipelineRunner() {
  const lastTimeRef = useRef(0);
  const audioMappingRef = useRef<AudioSpectrumMappingStrategy | null>(null);

  // Initialize the audio mapping strategy once (no user gesture needed)
  useEffect(() => {
    audioMappingRef.current = new AudioSpectrumMappingStrategy();
  }, []);

  // Main RAF loop — ticks active plugins and writes to ledStateProxy
  useEffect(() => {
    let rafId: number;

    function tick(now: number) {
      rafId = requestAnimationFrame(tick);

      const delta = now - lastTimeRef.current;
      if (delta < FRAME_INTERVAL_MS) return;
      lastTimeRef.current = now - (delta % FRAME_INTERVAL_MS);

      // Skip plugin ticking when paused — RAF keeps running so keep-alive
      // (which runs on its own setInterval in SACNController) is unaffected.
      const paused = uiStore.getState().pipelinePaused;
      if (paused) return;

      // Check which plugin is active and tick it.
      // Priority: audio > camera > video (only one runs at a time)
      const audioActive = audioStore.getState().isAudioActive;
      const cameraActive = cameraStore.getState().isActive;
      const videoLoaded = videoStore.getState().isLoaded;

      if (audioActive) {
        const frame = audioPlugin.tick(delta);
        if (frame && frame.spectrum && audioMappingRef.current) {
          const leds = audioMappingRef.current.map(frame, DEFAULT_LED_COUNT);
          ledStateProxy.colors.set(leds);
          ledStateProxy.lastUpdated = now;
        }
      } else if (cameraActive) {
        // tick() returns null if worker not initialized (initialize() not yet called)
        const frame = cameraPlugin.tick(delta);
        if (frame?.leds) {
          ledStateProxy.colors.set(frame.leds);
          ledStateProxy.lastUpdated = now;
        }
      } else if (videoLoaded) {
        // tick() returns null if worker not initialized
        const frame = videoPlugin.tick(delta);
        if (frame?.leds) {
          ledStateProxy.colors.set(frame.leds);
          ledStateProxy.lastUpdated = now;
        }
      }
    }

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return null; // Headless component — no UI
}
