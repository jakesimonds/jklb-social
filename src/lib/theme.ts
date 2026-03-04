// Theme utilities for russAbbot
// Dark mode Memphis design colors (light mode removed in TASK-THEME-03)

/**
 * Memphis Design System Colors (Dark theme only)
 */
export const THEME_COLORS = {
  dark: {
    background: '#1a1a2e',
    backgroundSecondary: '#16213e',
    text: 'rgba(255, 255, 255, 0.87)',
    textMuted: 'rgba(255, 255, 255, 0.5)',
    border: 'rgba(255, 255, 255, 0.1)',
  },
  accent: {
    pink: '#e91e63',
    cyan: '#00bcd4',
    yellow: '#ffeb3b',
  },
} as const;

/**
 * Apply dark theme to document
 * Sets CSS custom properties on :root
 */
export function applyTheme(): void {
  const root = document.documentElement;
  const colors = THEME_COLORS.dark;

  root.style.setProperty('--memphis-bg', colors.background);
  root.style.setProperty('--memphis-bg-secondary', colors.backgroundSecondary);
  root.style.setProperty('--memphis-text', colors.text);
  root.style.setProperty('--memphis-text-muted', colors.textMuted);
  root.style.setProperty('--memphis-border', colors.border);

  // Set data attribute for theme-specific CSS rules
  root.setAttribute('data-theme', 'dark');
}
