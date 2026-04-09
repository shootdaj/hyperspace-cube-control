import { themeStore, THEMES } from '@/core/store/themeStore';
import { cn } from '@/lib/utils';

/**
 * ThemePicker — grid of theme cards with live preview accent colors.
 * Each card shows the theme name, description, and an accent color swatch.
 * Clicking a card instantly applies that theme.
 */
export function ThemePicker() {
  const activeTheme = themeStore((s) => s.activeTheme);
  const setTheme = themeStore((s) => s.setTheme);

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold tracking-tight text-foreground">Theme</h3>
      <div
        className="grid grid-cols-1 gap-2"
        role="radiogroup"
        aria-label="Select UI theme"
      >
        {THEMES.map((theme) => (
          <button
            key={theme.id}
            role="radio"
            aria-checked={activeTheme === theme.id}
            onClick={() => setTheme(theme.id)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                setTheme(theme.id);
              }
            }}
            className={cn(
              'group flex items-center gap-3 rounded-md border px-3 py-2.5 text-left transition-all',
              'hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              activeTheme === theme.id
                ? 'border-primary bg-primary/10 text-foreground'
                : 'border-border bg-card text-muted-foreground hover:text-foreground',
            )}
          >
            {/* Accent swatch */}
            <div
              className={cn(
                'h-8 w-8 shrink-0 rounded-sm border border-border/50',
                activeTheme === theme.id && 'ring-2 ring-primary/30',
              )}
              style={{ backgroundColor: theme.accent }}
              aria-hidden="true"
            />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium text-foreground">{theme.name}</div>
              <div className="text-xs text-muted-foreground truncate">
                {theme.description}
              </div>
            </div>
            {/* Active indicator */}
            {activeTheme === theme.id && (
              <div
                className="h-2 w-2 shrink-0 rounded-full bg-primary"
                aria-hidden="true"
              />
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * ThemePickerCompact — smaller inline picker for embedding in headers/toolbars.
 * Shows just the accent swatches as small circles.
 */
export function ThemePickerCompact() {
  const activeTheme = themeStore((s) => s.activeTheme);
  const setTheme = themeStore((s) => s.setTheme);

  return (
    <div
      className="flex items-center gap-1.5"
      role="radiogroup"
      aria-label="Select UI theme"
    >
      {THEMES.map((theme) => (
        <button
          key={theme.id}
          role="radio"
          aria-checked={activeTheme === theme.id}
          aria-label={theme.name}
          onClick={() => setTheme(theme.id)}
          className={cn(
            'h-5 w-5 rounded-full border-2 transition-all',
            'hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
            activeTheme === theme.id
              ? 'border-foreground scale-110'
              : 'border-transparent opacity-60 hover:opacity-100',
          )}
          style={{ backgroundColor: theme.accent }}
        />
      ))}
    </div>
  );
}
