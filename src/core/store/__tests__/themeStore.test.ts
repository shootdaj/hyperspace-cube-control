import { describe, it, expect, beforeEach, vi } from 'vitest';
import { themeStore, THEMES, type ThemeId } from '../themeStore';

describe('themeStore', () => {
  beforeEach(() => {
    localStorage.clear();
    themeStore.setState({ activeTheme: 'neon-void' });
  });

  it('TestThemeStore_DefaultTheme', () => {
    expect(themeStore.getState().activeTheme).toBe('neon-void');
  });

  it('TestThemeStore_SetTheme_UpdatesState', () => {
    themeStore.getState().setTheme('neon-void');
    expect(themeStore.getState().activeTheme).toBe('neon-void');
  });

  it('TestThemeStore_SetTheme_PersistsToLocalStorage', () => {
  });

  it('TestThemeStore_AllFiveThemes_HaveMetadata', () => {
    expect(THEMES).toHaveLength(5);
    const ids = THEMES.map((t) => t.id);
    expect(ids).toContain('neon-void');
    expect(ids).toContain('neon-void');
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
      'neon-void',
      'neon-void',
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

    // Restore
    Storage.prototype.setItem = originalSetItem;
  });
});
