import { describe, it, expect, beforeEach, vi } from 'vitest';
import { themeStore, THEMES, type ThemeId } from '../themeStore';

describe('themeStore', () => {
  beforeEach(() => {
    localStorage.clear();
    themeStore.setState({ activeTheme: 'midnight-grid' });
  });

  it('TestThemeStore_DefaultTheme', () => {
    expect(themeStore.getState().activeTheme).toBe('midnight-grid');
  });

  it('TestThemeStore_SetTheme_UpdatesState', () => {
    themeStore.getState().setTheme('neon-void');
    expect(themeStore.getState().activeTheme).toBe('neon-void');
  });

  it('TestThemeStore_SetTheme_PersistsToLocalStorage', () => {
    themeStore.getState().setTheme('brutalist');
    expect(localStorage.getItem('hypercube-theme')).toBe('brutalist');
  });

  it('TestThemeStore_AllFiveThemes_HaveMetadata', () => {
    expect(THEMES).toHaveLength(5);
    const ids = THEMES.map((t) => t.id);
    expect(ids).toContain('midnight-grid');
    expect(ids).toContain('neon-void');
    expect(ids).toContain('brutalist');
    expect(ids).toContain('ember');
    expect(ids).toContain('phosphor');
  });

  it('TestThemeStore_EachTheme_HasRequiredFields', () => {
    for (const theme of THEMES) {
      expect(theme.id).toBeTruthy();
      expect(theme.name).toBeTruthy();
      expect(theme.description).toBeTruthy();
      expect(theme.accent).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });

  it('TestThemeStore_SetTheme_AllThemesValid', () => {
    const themeIds: ThemeId[] = [
      'midnight-grid',
      'neon-void',
      'brutalist',
      'ember',
      'phosphor',
    ];
    for (const id of themeIds) {
      themeStore.getState().setTheme(id);
      expect(themeStore.getState().activeTheme).toBe(id);
    }
  });

  it('TestThemeStore_LocalStorageFallback_WhenUnavailable', () => {
    // Mock localStorage to throw
    const originalSetItem = localStorage.setItem;
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceeded');
    });

    // Should not throw
    expect(() => themeStore.getState().setTheme('ember')).not.toThrow();
    expect(themeStore.getState().activeTheme).toBe('ember');

    // Restore
    Storage.prototype.setItem = originalSetItem;
  });
});
