import { useEffect } from 'react';
import { themeStore, type ThemeId } from '@/core/store/themeStore';

/**
 * ThemeProvider — applies the active theme as a data-theme attribute on <html>.
 * Themes are pure CSS custom property overrides: instant switching, no reload.
 *
 * Also sets the font-family on <html> to match the theme's typography.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const activeTheme = themeStore((s) => s.activeTheme);

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-theme', activeTheme);
    // Apply theme font to root so Tailwind utilities and component styles pick it up
    root.style.setProperty('font-family', 'var(--font-theme, var(--font-sans))');
  }, [activeTheme]);

  return <>{children}</>;
}

/**
 * Mapping from theme IDs to Google Font import strings.
 * These get loaded as <link> tags in the document head.
 */
const THEME_FONTS: Record<ThemeId, string[]> = {
  'midnight-grid': [
    'https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500;600;700&display=swap',
  ],
  'neon-void': [
    'https://fonts.googleapis.com/css2?family=Orbitron:wght@400;500;600;700;800;900&display=swap',
    'https://fonts.googleapis.com/css2?family=Share+Tech+Mono&display=swap',
  ],
  'brutalist': [
    'https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&display=swap',
  ],
  'ember': [
    'https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500;600;700&display=swap',
    'https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&display=swap',
  ],
  'phosphor': [
    'https://fonts.googleapis.com/css2?family=VT323&display=swap',
  ],
};

/**
 * FontLoader — dynamically loads Google Fonts for the active theme.
 * Adds/removes <link> tags in <head> as theme changes.
 */
export function FontLoader() {
  const activeTheme = themeStore((s) => s.activeTheme);

  useEffect(() => {
    const urls = THEME_FONTS[activeTheme] || [];
    const links: HTMLLinkElement[] = [];

    for (const url of urls) {
      // Skip if already loaded
      const existing = document.querySelector(`link[href="${url}"]`);
      if (existing) continue;

      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = url;
      link.setAttribute('data-theme-font', activeTheme);
      document.head.appendChild(link);
      links.push(link);
    }

    // Cleanup: remove font links from previous themes that are no longer needed
    return () => {
      // We intentionally do NOT remove links — fonts may be cached and reused.
      // Google Fonts links are tiny and cached by the browser.
    };
  }, [activeTheme]);

  return null;
}
