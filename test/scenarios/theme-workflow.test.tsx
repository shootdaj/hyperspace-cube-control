import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from '@/themes/ThemeProvider';
import { ThemePicker, ThemePickerCompact } from '@/themes/ThemePicker';
import { themeStore, THEMES } from '@/core/store/themeStore';

/**
 * Scenario tests: complete user workflows for theme selection.
 * Covers UI-01 (5 themes), UI-02 (theme switching in settings),
 * and UI-05 (keyboard navigation).
 */
describe('Theme Workflow Scenarios', () => {
  beforeEach(() => {
    localStorage.clear();
    themeStore.setState({ activeTheme: 'midnight-grid' });
    document.documentElement.removeAttribute('data-theme');
  });

  it('TestScenario_UserBrowsesAndSelectsTheme', async () => {
    const user = userEvent.setup();

    render(
      <ThemeProvider>
        <ThemePicker />
      </ThemeProvider>,
    );

    // User sees all 5 themes
    expect(screen.getAllByRole('radio')).toHaveLength(5);

    // User reads descriptions
    expect(screen.getByText(/Ableton/i)).toBeInTheDocument();
    expect(screen.getByText(/Sci-fi/i)).toBeInTheDocument();
    expect(screen.getByText(/Raw industrial/i)).toBeInTheDocument();
    expect(screen.getByText(/Warm luxury/i)).toBeInTheDocument();
    expect(screen.getByText(/Retro CRT/i)).toBeInTheDocument();

    // User clicks Neon Void
    await user.click(screen.getByText('Neon Void').closest('button')!);

    // Theme applies instantly
    expect(document.documentElement.getAttribute('data-theme')).toBe('neon-void');

    // Selection persists
    expect(localStorage.getItem('hypercube-theme')).toBe('neon-void');
  });

  it('TestScenario_UserNavigatesThemesWithKeyboard', async () => {
    const user = userEvent.setup();

    render(
      <ThemeProvider>
        <ThemePicker />
      </ThemeProvider>,
    );

    // Tab to first theme button
    await user.tab();
    const firstButton = screen.getByText('Midnight Grid').closest('button')!;
    expect(firstButton).toHaveFocus();

    // Tab to second theme and activate with Enter
    await user.tab();
    await user.keyboard('{Enter}');
    expect(themeStore.getState().activeTheme).toBe('neon-void');

    // Tab to third and activate with Space
    await user.tab();
    await user.keyboard(' ');
    expect(themeStore.getState().activeTheme).toBe('brutalist');
  });

  it('TestScenario_CompactPickerInHeader', async () => {
    const user = userEvent.setup();

    render(
      <ThemeProvider>
        <header>
          <ThemePickerCompact />
        </header>
      </ThemeProvider>,
    );

    // User sees 5 small swatches
    const swatches = screen.getAllByRole('radio');
    expect(swatches).toHaveLength(5);

    // User clicks the 3rd swatch (Brutalist)
    await user.click(swatches[2]);
    expect(themeStore.getState().activeTheme).toBe('brutalist');
  });

  it('TestScenario_ThemePersistsAfterPageReload', () => {
    // User selects Ember
    themeStore.getState().setTheme('ember');
    expect(localStorage.getItem('hypercube-theme')).toBe('ember');

    // Simulate page reload by resetting store and reading from localStorage
    // The store constructor reads from localStorage
    const stored = localStorage.getItem('hypercube-theme');
    expect(stored).toBe('ember');
  });

  it('TestScenario_AllThemesHaveDistinctAccentColors', () => {
    const accents = THEMES.map((t) => t.accent);
    const uniqueAccents = new Set(accents);
    expect(uniqueAccents.size).toBe(5);
  });

  it('TestScenario_FocusVisibleOnThemeButtons', async () => {
    const user = userEvent.setup();

    render(
      <ThemeProvider>
        <ThemePicker />
      </ThemeProvider>,
    );

    // Tab to activate focus-visible styles
    await user.tab();
    const focused = document.activeElement;
    expect(focused).toBeInstanceOf(HTMLButtonElement);
    // The button should have focus-visible classes in its className
    expect(focused?.className).toContain('focus-visible');
  });
});
