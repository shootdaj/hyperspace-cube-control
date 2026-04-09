import { describe, it, expect, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { ThemeProvider } from '../ThemeProvider';
import { themeStore } from '@/core/store/themeStore';

describe('ThemeProvider', () => {
  beforeEach(() => {
    localStorage.clear();
    themeStore.setState({ activeTheme: 'midnight-grid' });
    document.documentElement.removeAttribute('data-theme');
  });

  it('TestThemeProvider_SetsDataThemeAttribute', () => {
    render(
      <ThemeProvider>
        <div>child</div>
      </ThemeProvider>,
    );
    expect(document.documentElement.getAttribute('data-theme')).toBe('midnight-grid');
  });

  it('TestThemeProvider_UpdatesOnThemeChange', () => {
    render(
      <ThemeProvider>
        <div>child</div>
      </ThemeProvider>,
    );

    themeStore.getState().setTheme('neon-void');
    // ThemeProvider uses useEffect, re-render needed
    render(
      <ThemeProvider>
        <div>child</div>
      </ThemeProvider>,
    );
    expect(document.documentElement.getAttribute('data-theme')).toBe('neon-void');
  });

  it('TestThemeProvider_SetsFontFamily', () => {
    render(
      <ThemeProvider>
        <div>child</div>
      </ThemeProvider>,
    );
    const fontFamily = document.documentElement.style.getPropertyValue('font-family');
    expect(fontFamily).toContain('var(--font-theme');
  });

  it('TestThemeProvider_RendersChildren', () => {
    const { getByText } = render(
      <ThemeProvider>
        <div>Test Child Content</div>
      </ThemeProvider>,
    );
    expect(getByText('Test Child Content')).toBeInTheDocument();
  });
});
