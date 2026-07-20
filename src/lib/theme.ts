export type AppTheme = 'light' | 'dark';
export type ThemePreference = AppTheme | 'system';

export const THEME_STORAGE_KEY = 'levo.theme.v1';

export function resolveThemePreference(
  preference: string | null | undefined,
  systemPrefersDark: boolean,
): AppTheme {
  if (preference === 'light' || preference === 'dark') return preference;
  return systemPrefersDark ? 'dark' : 'light';
}

export function oppositeTheme(theme: AppTheme): AppTheme {
  return theme === 'dark' ? 'light' : 'dark';
}
