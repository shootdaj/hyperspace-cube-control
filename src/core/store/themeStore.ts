import { create } from 'zustand';

/**
 * Theme identifiers. Each maps to a data-theme attribute value
 * and a CSS custom property set in the theme stylesheets.
 */
export type ThemeId = 'neon-void';

export interface ThemeMeta {
  id: ThemeId;
  name: string;
  description: string;
  accent: string;
}

export const THEMES: ThemeMeta[] = [
  {
    id: 'neon-void',
    name: 'Neon Void',
    description: 'Sci-fi command center — neon green & pink on deep black, HUD glow',
    accent: '#00FF88',
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
  return 'neon-void';
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
