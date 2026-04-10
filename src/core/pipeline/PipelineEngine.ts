import { useRef, useEffect } from 'react';
import type { InputPlugin, MappingStrategy, OutputPlugin } from './types';
import { ledStateProxy } from '@/core/store/ledStateProxy';
import { DEFAULT_LED_COUNT } from '@/core/constants';

export const TARGET_FPS = 30;
export const FRAME_INTERVAL_MS = 1000 / TARGET_FPS; // ~33.33ms

export interface PipelineRefs {
  activeInput: React.MutableRefObject<InputPlugin | null>;
  activeMapping: React.MutableRefObject<MappingStrategy | null>;
  activeOutput: React.MutableRefObject<OutputPlugin | null>;
  lastTime: React.MutableRefObject<number>;
}

/**
 * Core tick logic — extracted for testability.
 * Called by the RAF loop with current timestamp.
 * Exported so unit tests can call it directly without RAF.
 */
export function runPipelineTick(
  now: number,
  refs: PipelineRefs,
): boolean {
  const delta = now - refs.lastTime.current;
  if (delta < FRAME_INTERVAL_MS) return false; // Frame rate throttle
  refs.lastTime.current = now - (delta % FRAME_INTERVAL_MS);

  const input = refs.activeInput.current;
  const mapping = refs.activeMapping.current;
  if (!input || !mapping) return false;

  const frame = input.tick(delta);
  if (!frame) return false;

  const leds = mapping.map(frame, DEFAULT_LED_COUNT);
  ledStateProxy.colors.set(leds);
  ledStateProxy.lastUpdated = now;

  refs.activeOutput.current?.send(leds, 255);
  return true;
}

/**
 * usePipelineEngine — RAF game loop hook.
 *
 * CRITICAL: useEffect deps array MUST be [].
 * If any dep causes the effect to re-run, the RAF loop restarts → audible pop/flash.
 * All plugin changes go through ref mutations (setInputPlugin etc.), never through deps.
 *
 * Two loops coexist independently:
 * 1. This RAF loop at 30fps target — drives plugin pipeline
 * 2. R3F useFrame loop at device refresh rate — drives 3D rendering
 * They do NOT interfere — they write/read different parts of ledStateProxy.
 */
export function usePipelineEngine() {
  const activeInputRef = useRef<InputPlugin | null>(null);
  const activeMappingRef = useRef<MappingStrategy | null>(null);
  const activeOutputRef = useRef<OutputPlugin | null>(null);
  const lastTimeRef = useRef<number>(0);

  const refs: PipelineRefs = {
    activeInput: activeInputRef,
    activeMapping: activeMappingRef,
    activeOutput: activeOutputRef,
    lastTime: lastTimeRef,
  };

  useEffect(() => {
    let rafId: number;

    function tick(now: number) {
      rafId = requestAnimationFrame(tick);
      runPipelineTick(now, refs);
    }

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function setInputPlugin(plugin: InputPlugin | null): void {
    activeInputRef.current?.destroy();
    activeInputRef.current = plugin;
  }

  function setMappingStrategy(strategy: MappingStrategy | null): void {
    activeMappingRef.current = strategy;
  }

  function setOutputPlugin(plugin: OutputPlugin | null): void {
    activeOutputRef.current?.destroy();
    activeOutputRef.current = plugin;
  }

  return { setInputPlugin, setMappingStrategy, setOutputPlugin };
}
