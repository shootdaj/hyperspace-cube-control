import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemePicker, ThemePickerCompact } from '../ThemePicker';
import { themeStore, THEMES } from '@/core/store/themeStore';

describe('ThemePicker', () => {
  beforeEach(() => {
    localStorage.clear();
    themeStore.setState({ activeTheme: 'neon-void' });
  });

  it('TestThemePicker_RendersAllFiveThemes', () => {
    render(<ThemePicker />);
    for (const theme of THEMES) {
      expect(screen.getByText(theme.name)).toBeInTheDocument();
    }
  });

  it('TestThemePicker_HighlightsActiveTheme', () => {
    render(<ThemePicker />);
    const activeButton = screen.getByRole('radio', { name: /Midnight Grid/i });
    expect(activeButton).toHaveAttribute('aria-checked', 'true');
  });

  it('TestThemePicker_SwitchesTheme_OnClick', async () => {
    const user = userEvent.setup();
    render(<ThemePicker />);

    const brutalistButton = screen.getByText('Brutalist').closest('button')!;
    await user.click(brutalistButton);

    expect(themeStore.getState().activeTheme).toBe('brutalist');
  });

  it('TestThemePicker_SwitchesTheme_OnKeyboard', async () => {
    const user = userEvent.setup();
    render(<ThemePicker />);

    const emberButton = screen.getByText('Ember').closest('button')!;
    emberButton.focus();
    await user.keyboard('{Enter}');

    expect(themeStore.getState().activeTheme).toBe('ember');
  });

  it('TestThemePicker_HasRadioGroupRole', () => {
    render(<ThemePicker />);
    expect(screen.getByRole('radiogroup')).toBeInTheDocument();
  });

  it('TestThemePicker_ShowsDescriptions', () => {
    render(<ThemePicker />);
    for (const theme of THEMES) {
      expect(screen.getByText(theme.description)).toBeInTheDocument();
    }
  });
});

describe('ThemePickerCompact', () => {
  beforeEach(() => {
    localStorage.clear();
    themeStore.setState({ activeTheme: 'neon-void' });
  });

  it('TestThemePickerCompact_RendersAllFiveSwatches', () => {
    render(<ThemePickerCompact />);
    const buttons = screen.getAllByRole('radio');
    expect(buttons).toHaveLength(5);
  });

  it('TestThemePickerCompact_SwitchesTheme', async () => {
    const user = userEvent.setup();
    render(<ThemePickerCompact />);

    const buttons = screen.getAllByRole('radio');
    // Click the Phosphor button (last one)
    await user.click(buttons[4]);

    expect(themeStore.getState().activeTheme).toBe('phosphor');
  });

  it('TestThemePickerCompact_HasAriaLabels', () => {
    render(<ThemePickerCompact />);
    for (const theme of THEMES) {
      expect(screen.getByRole('radio', { name: theme.name })).toBeInTheDocument();
    }
  });
});
