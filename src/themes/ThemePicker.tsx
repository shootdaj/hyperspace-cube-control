import { themeStore, THEMES } from '@/core/store/themeStore';
import { cn } from '@/lib/utils';
import { SwatchBook, Check } from 'lucide-react';

/**
 * ThemePicker — grid of theme cards with live preview accent colors.
 * Each card shows the theme name, description, and an accent color swatch.
 * Clicking a card instantly applies that theme.
 */
export function ThemePicker() {
  const activeTheme = themeStore((s) => s.activeTheme);
  const setTheme = themeStore((s) => s.setTheme);

  return (
    <div className="space-y-4">
      <div className="section-header">
        <SwatchBook className="w-3.5 h-3.5 text-primary" />
        <span>Theme</span>
      </div>
      <div
        className="grid grid-cols-1 gap-2"
        role="radiogroup"
        aria-label="Select UI theme"
      >
        {THEMES.map((theme) => {
          const isActive = activeTheme === theme.id;
          return (
            <button
              key={theme.id}
              role="radio"
              aria-checked={isActive}
              onClick={() => setTheme(theme.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setTheme(theme.id);
                }
              }}
              className={cn(
                'group flex items-center gap-3 rounded-md border px-3 py-3 text-left transition-all cursor-pointer',
                'hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                isActive
                  ? 'border-primary/60 bg-primary/10 text-foreground shadow-[0_0_12px_rgba(59,130,246,0.08)]'
                  : 'border-border bg-secondary/20 text-muted-foreground hover:text-foreground',
              )}
            >
              {/* Accent swatch */}
              <div
                className={cn(
                  'h-9 w-9 shrink-0 rounded-md border border-border/50',
                  isActive && 'ring-2 ring-primary/30',
                )}
                style={{ backgroundColor: theme.accent }}
                aria-hidden="true"
              />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-foreground">{theme.name}</div>
                <div className="text-xs text-muted-foreground/70 truncate">
                  {theme.description}
                </div>
              </div>
              {/* Active indicator */}
              {isActive && (
                <Check className="w-4 h-4 shrink-0 text-primary" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * ThemePickerCompact — smaller inline picker for embedding in headers/toolbars.
 * Shows accent swatches as circles with title tooltips.
 */
export function ThemePickerCompact() {
  const activeTheme = themeStore((s) => s.activeTheme);
  const setTheme = themeStore((s) => s.setTheme);

  return (
    <div
      className="flex items-center gap-1"
      role="radiogroup"
      aria-label="Select UI theme"
    >
      {THEMES.map((theme) => {
        const isActive = activeTheme === theme.id;
        return (
          <button
            key={theme.id}
            role="radio"
            aria-checked={isActive}
            aria-label={theme.name}
            title={theme.name}
            onClick={() => setTheme(theme.id)}
            className={cn(
              'h-6 w-6 rounded-full border-2 transition-all cursor-pointer',
              'hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
              isActive
                ? 'border-foreground scale-110 shadow-[0_0_8px_rgba(255,255,255,0.15)]'
                : 'border-transparent opacity-50 hover:opacity-100',
            )}
            style={{ backgroundColor: theme.accent }}
          />
        );
      })}
    </div>
  );
}
