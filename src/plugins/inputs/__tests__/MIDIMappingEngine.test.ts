import { describe, it, expect, beforeEach } from 'vitest';
import {
  mapCCToParameterValue,
  hueToRGB,
  handleCCMessage,
  handleNoteOnMessage,
  applyCCParameter,
  executeNoteAction,
} from '../MIDIMappingEngine';
import { midiStore } from '@/stores/midiStore';
import { cubeStateStore } from '@/core/store/cubeStateStore';
import { connectionStore } from '@/core/store/connectionStore';

describe('MIDIMappingEngine', () => {
  beforeEach(() => {
    midiStore.setState({
      isSupported: true,
      isEnabled: true,
      devices: [],
      selectedDeviceId: null,
      ccMappings: [],
      noteMappings: [],
      learnTarget: null,
      lastCCValues: {},
      error: null,
    });
    cubeStateStore.setState({
      on: true,
      brightness: 128,
      effectIndex: 0,
      paletteIndex: 0,
      speed: 128,
      intensity: 128,
      colors: [[255, 160, 0], [0, 0, 0], [0, 0, 0]],
    });
  });

  describe('mapCCToParameterValue', () => {
    it('TestCCMap_BrightnessMinMax', () => {
      expect(mapCCToParameterValue(0, 'brightness')).toBe(0);
      expect(mapCCToParameterValue(127, 'brightness')).toBe(255);
    });

    it('TestCCMap_BrightnessMidpoint', () => {
      expect(mapCCToParameterValue(64, 'brightness')).toBe(129);
    });

    it('TestCCMap_SpeedRange', () => {
      expect(mapCCToParameterValue(0, 'speed')).toBe(0);
      expect(mapCCToParameterValue(127, 'speed')).toBe(255);
    });

    it('TestCCMap_IntensityRange', () => {
      expect(mapCCToParameterValue(0, 'intensity')).toBe(0);
      expect(mapCCToParameterValue(127, 'intensity')).toBe(255);
    });

    it('TestCCMap_HueRange', () => {
      expect(mapCCToParameterValue(0, 'hue')).toBe(0);
      expect(mapCCToParameterValue(127, 'hue')).toBe(360);
    });

    it('TestCCMap_ClampsOutOfRange', () => {
      expect(mapCCToParameterValue(-5, 'brightness')).toBe(0);
      expect(mapCCToParameterValue(200, 'brightness')).toBe(255);
    });
  });

  describe('hueToRGB', () => {
    it('TestHueToRGB_Red', () => {
      const [r, g, b] = hueToRGB(0);
      expect(r).toBe(255);
      expect(g).toBe(0);
      expect(b).toBe(0);
    });

    it('TestHueToRGB_Green', () => {
      const [r, g, b] = hueToRGB(120);
      expect(r).toBe(0);
      expect(g).toBe(255);
      expect(b).toBe(0);
    });

    it('TestHueToRGB_Blue', () => {
      const [r, g, b] = hueToRGB(240);
      expect(r).toBe(0);
      expect(g).toBe(0);
      expect(b).toBe(255);
    });

    it('TestHueToRGB_Wraps360', () => {
      const [r, g, b] = hueToRGB(360);
      expect(r).toBe(255);
      expect(g).toBe(0);
      expect(b).toBe(0);
    });
  });

  describe('handleCCMessage', () => {
    it('TestHandleCC_UpdatesLastCCValue', () => {
      handleCCMessage(1, 7, 100);
      expect(midiStore.getState().lastCCValues['7']).toBe(100);
    });

    it('TestHandleCC_LearnModeCapturesBinding', () => {
      midiStore.getState().setLearnTarget({ type: 'cc', target: 'brightness' });
      handleCCMessage(1, 7, 64);

      // Should have created a mapping
      expect(midiStore.getState().ccMappings).toHaveLength(1);
      expect(midiStore.getState().ccMappings[0]).toEqual({
        channel: 1, cc: 7, target: 'brightness',
      });
      // Learn mode should be cleared
      expect(midiStore.getState().learnTarget).toBeNull();
    });

    it('TestHandleCC_AppliesBrightnessMapping', () => {
      midiStore.getState().addCCMapping({ channel: 1, cc: 7, target: 'brightness' });
      handleCCMessage(1, 7, 64);
      expect(cubeStateStore.getState().brightness).toBe(129);
    });

    it('TestHandleCC_AppliesSpeedMapping', () => {
      midiStore.getState().addCCMapping({ channel: 1, cc: 10, target: 'speed' });
      handleCCMessage(1, 10, 127);
      expect(cubeStateStore.getState().speed).toBe(255);
    });

    it('TestHandleCC_AppliesIntensityMapping', () => {
      midiStore.getState().addCCMapping({ channel: 1, cc: 11, target: 'intensity' });
      handleCCMessage(1, 11, 0);
      expect(cubeStateStore.getState().intensity).toBe(0);
    });

    it('TestHandleCC_AppliesHueMapping', () => {
      midiStore.getState().addCCMapping({ channel: 1, cc: 1, target: 'hue' });
      handleCCMessage(1, 1, 42); // 42/127 * 360 = ~119 degrees (green)
      const colors = cubeStateStore.getState().colors;
      // Hue ~119 should produce a greenish color
      expect(colors[0][1]).toBeGreaterThan(colors[0][0]); // g > r
    });

    it('TestHandleCC_IgnoresUnmappedCC', () => {
      handleCCMessage(1, 99, 64);
      // Brightness should not change
      expect(cubeStateStore.getState().brightness).toBe(128);
    });

    it('TestHandleCC_IgnoresWrongChannel', () => {
      midiStore.getState().addCCMapping({ channel: 1, cc: 7, target: 'brightness' });
      handleCCMessage(2, 7, 64); // Wrong channel
      expect(cubeStateStore.getState().brightness).toBe(128); // Unchanged
    });
  });

  describe('handleNoteOnMessage', () => {
    it('TestHandleNoteOn_LearnModeCapturesBinding', () => {
      midiStore.getState().setLearnTarget({
        type: 'note', action: 'preset', actionIndex: 0,
      });
      handleNoteOnMessage(1, 60, 127);

      expect(midiStore.getState().noteMappings).toHaveLength(1);
      expect(midiStore.getState().noteMappings[0]).toEqual({
        channel: 1, note: 60, action: 'preset', actionIndex: 0,
      });
      expect(midiStore.getState().learnTarget).toBeNull();
    });

    it('TestHandleNoteOn_ActivatesEffectMapping', () => {
      midiStore.getState().addNoteMapping({
        channel: 1, note: 60, action: 'effect', actionIndex: 42,
      });
      handleNoteOnMessage(1, 60, 127);
      expect(cubeStateStore.getState().effectIndex).toBe(42);
    });

    it('TestHandleNoteOn_IgnoresUnmappedNote', () => {
      handleNoteOnMessage(1, 60, 127);
      // No crash, effect unchanged
      expect(cubeStateStore.getState().effectIndex).toBe(0);
    });
  });

  describe('applyCCParameter', () => {
    it('TestApplyCCParameter_SetsBrightness', () => {
      applyCCParameter('brightness', 200);
      expect(cubeStateStore.getState().brightness).toBe(200);
    });

    it('TestApplyCCParameter_SetsSpeed', () => {
      applyCCParameter('speed', 100);
      expect(cubeStateStore.getState().speed).toBe(100);
    });

    it('TestApplyCCParameter_SetsIntensity', () => {
      applyCCParameter('intensity', 50);
      expect(cubeStateStore.getState().intensity).toBe(50);
    });

    it('TestApplyCCParameter_SetsHue', () => {
      applyCCParameter('hue', 180);
      const colors = cubeStateStore.getState().colors;
      // Hue 180 = cyan
      expect(colors[0][2]).toBeGreaterThan(0); // blue component
    });
  });

  describe('executeNoteAction', () => {
    it('TestExecuteNoteAction_SwitchesEffect', () => {
      executeNoteAction({ channel: 1, note: 60, action: 'effect', actionIndex: 15 });
      expect(cubeStateStore.getState().effectIndex).toBe(15);
    });

    it('TestExecuteNoteAction_IgnoresPresetWithoutConnection', () => {
      // No IP set — should not crash
      connectionStore.setState({ ip: '' });
      executeNoteAction({ channel: 1, note: 60, action: 'preset', actionIndex: 0 });
      // No crash = pass
    });
  });
});
