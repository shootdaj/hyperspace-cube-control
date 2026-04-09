import { describe, it, expect, beforeEach } from 'vitest';
import { uiStore } from '../uiStore';

describe('uiStore', () => {
  beforeEach(() => {
    uiStore.setState({
      activePluginId: null,
      activePanel: 'control',
      wizardCompleted: false,
    });
  });

  it('TestUIStore_InitialWizardCompleted_IsFalse', () => {
    expect(uiStore.getState().wizardCompleted).toBe(false);
  });

  it('TestUIStore_SetWizardCompleted_UpdatesToTrue', () => {
    uiStore.getState().setWizardCompleted(true);
    expect(uiStore.getState().wizardCompleted).toBe(true);
  });

  it('TestUIStore_SetActivePluginId_Updates', () => {
    uiStore.getState().setActivePluginId('manual-paint');
    expect(uiStore.getState().activePluginId).toBe('manual-paint');
  });

  it('TestUIStore_SetActivePanel_Updates', () => {
    uiStore.getState().setActivePanel('settings');
    expect(uiStore.getState().activePanel).toBe('settings');
  });

  it('TestUIStore_InitialActivePanel_IsControl', () => {
    expect(uiStore.getState().activePanel).toBe('control');
  });

  it('TestUIStore_InitialActivePluginId_IsNull', () => {
    expect(uiStore.getState().activePluginId).toBeNull();
  });
});
