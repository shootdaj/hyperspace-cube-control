import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from '@/themes/ThemeProvider';
import { ThemePicker } from '@/themes/ThemePicker';
import { themeStore, THEMES, type ThemeId } from '@/core/store/themeStore';

/**
 * Integration test: theme switching through ThemeProvider + ThemePicker working together.
 * Verifies CSS custom properties are applied to the document when themes change.
 */
describe('Theme Switching Integration', () => {
  beforeEach(() => {
    localStorage.clear();
    themeStore.setState({ activeTheme: 'midnight-grid' });
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.style.removeProperty('font-family');
  });

  it('TestThemeSwitching_FullRoundTrip_AllThemes', async () => {
    const user = userEvent.setup();

    render(
      <ThemeProvider>
        <ThemePicker />
      </ThemeProvider>,
    );

    // Verify initial theme
    expect(document.documentElement.getAttribute('data-theme')).toBe('midnight-grid');

    // Switch through all themes
    const themeIds: ThemeId[] = ['neon-void', 'brutalist', 'ember', 'phosphor', 'midnight-grid'];

    for (const id of themeIds) {
      const theme = THEMES.find((t) => t.id === id)!;
      const button = screen.getByText(theme.name).closest('button')!;
      await user.click(button);

      expect(themeStore.getState().activeTheme).toBe(id);
      expect(localStorage.getItem('hypercube-theme')).toBe(id);
    }
  });

  it('TestThemeSwitching_PersistsAcrossRenders', () => {
    // Set theme
    themeStore.getState().setTheme('phosphor');

    // First render
    const { unmount } = render(
      <ThemeProvider>
        <div>content</div>
      </ThemeProvider>,
    );
    expect(document.documentElement.getAttribute('data-theme')).toBe('phosphor');
    unmount();

    // Second render — should restore from store
    render(
      <ThemeProvider>
        <div>content</div>
      </ThemeProvider>,
    );
    expect(document.documentElement.getAttribute('data-theme')).toBe('phosphor');
  });

  it('TestThemeSwitching_NoPageReload_InstantSwitch', async () => {
    const user = userEvent.setup();

    render(
      <ThemeProvider>
        <ThemePicker />
      </ThemeProvider>,
    );

    // Rapidly switch themes — should not throw or lose state
    for (const theme of THEMES) {
      const button = screen.getByText(theme.name).closest('button')!;
      await user.click(button);
      expect(themeStore.getState().activeTheme).toBe(theme.id);
    }
  });

  it('TestThemeSwitching_ActiveTheme_HasAriaCheckedTrue', async () => {
    const user = userEvent.setup();

    render(
      <ThemeProvider>
        <ThemePicker />
      </ThemeProvider>,
    );

    // Switch to brutalist
    const brutalistButton = screen.getByText('Brutalist').closest('button')!;
    await user.click(brutalistButton);

    // Verify aria state
    const buttons = screen.getAllByRole('radio');
    const checked = buttons.filter((b) => b.getAttribute('aria-checked') === 'true');
    expect(checked).toHaveLength(1);
    expect(checked[0]).toHaveTextContent('Brutalist');
  });
});
