import { create } from 'zustand';

/**
 * Theme identifiers. Each maps to a data-theme attribute value
 * and a CSS custom property set in the theme stylesheets.
 */
export type ThemeId =
  | 'midnight-grid'
  | 'neon-void'
  | 'brutalist'
  | 'ember'
  | 'phosphor';

export interface ThemeMeta {
  id: ThemeId;
  name: string;
  description: string;
  /** Preview accent color for the theme picker */
  accent: string;
}

export const THEMES: ThemeMeta[] = [
  {
    id: 'midnight-grid',
    name: 'Midnight Grid',
    description: 'Ableton/Resolume-inspired — cool blue-gray, monospace, grid borders',
    accent: '#3B82F6',
  },
  {
    id: 'neon-void',
    name: 'Neon Void',
    description: 'Sci-fi command center — neon green & pink on deep black, HUD glow',
    accent: '#00FF88',
  },
  {
    id: 'brutalist',
    name: 'Brutalist',
    description: 'Raw industrial — high contrast, chunky borders, no rounded corners',
    accent: '#FF4500',
  },
  {
    id: 'ember',
    name: 'Ember',
    description: 'Warm luxury minimal — amber & gold on dark brown, refined spacing',
    accent: '#B45309',
  },
  {
    id: 'phosphor',
    name: 'Phosphor',
    description: 'Retro CRT terminal — green phosphor on black, scan-line overlay',
    accent: '#00FF00',
  },
];

const THEME_STORAGE_KEY = 'hypercube-theme';

interface ThemeStore {
  activeTheme: ThemeId;
  setTheme: (theme: ThemeId) => void;
}

function loadPersistedTheme(): ThemeId {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored && THEMES.some((t) => t.id === stored)) {
      return stored as ThemeId;
    }
  } catch {
    // localStorage unavailable
  }
  return 'midnight-grid';
}

export const themeStore = create<ThemeStore>()((set) => ({
  activeTheme: loadPersistedTheme(),
  setTheme: (theme: ThemeId) => {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // localStorage unavailable
    }
    set({ activeTheme: theme });
  },
}));
