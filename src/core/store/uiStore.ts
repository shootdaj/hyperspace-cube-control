import { create } from 'zustand';

type ActivePanel = 'control' | 'plugins' | 'presets' | 'settings';

interface UIStore {
  activePluginId: string | null;
  activePanel: ActivePanel;
  wizardCompleted: boolean;
  pipelinePaused: boolean;
  // Actions
  setActivePluginId: (id: string | null) => void;
  setActivePanel: (panel: ActivePanel) => void;
  setWizardCompleted: (completed: boolean) => void;
  setPipelinePaused: (paused: boolean) => void;
}

export type { UIStore, ActivePanel };

export const uiStore = create<UIStore>()((set) => ({
  activePluginId: null,
  activePanel: 'control',
  wizardCompleted: false,
  pipelinePaused: false,
  setActivePluginId: (activePluginId) => set({ activePluginId }),
  setActivePanel: (activePanel) => set({ activePanel }),
  setWizardCompleted: (wizardCompleted) => set({ wizardCompleted }),
  setPipelinePaused: (pipelinePaused) => set({ pipelinePaused }),
}));
