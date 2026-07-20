'use client';

import {
  createContext, useCallback, useContext, useEffect, useMemo, useState,
} from 'react';
import {
  oppositeTheme, resolveThemePreference, THEME_STORAGE_KEY,
} from '@/lib/theme';
import type { AppTheme, ThemePreference } from '@/lib/theme';

type ThemeContextValue = {
  theme: AppTheme;
  preference: ThemePreference;
  setTheme: (theme: ThemePreference) => void;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function applyTheme(theme: AppTheme) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
  const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  meta?.setAttribute('content', theme === 'dark' ? '#020617' : '#f8fafc');
}

export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setResolvedTheme] = useState<AppTheme>('dark');
  const [preference, setPreference] = useState<ThemePreference>('system');

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const sync = () => {
      const stored = localStorage.getItem(THEME_STORAGE_KEY);
      const currentPreference: ThemePreference = stored === 'light' || stored === 'dark'
        ? stored
        : 'system';
      const resolved = resolveThemePreference(currentPreference, media.matches);
      setPreference(currentPreference);
      setResolvedTheme(resolved);
      applyTheme(resolved);
    };
    sync();
    media.addEventListener('change', sync);
    return () => media.removeEventListener('change', sync);
  }, []);

  const setTheme = useCallback((next: ThemePreference) => {
    const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const resolved = resolveThemePreference(next, systemPrefersDark);
    if (next === 'system') localStorage.removeItem(THEME_STORAGE_KEY);
    else localStorage.setItem(THEME_STORAGE_KEY, next);
    setPreference(next);
    setResolvedTheme(resolved);
    applyTheme(resolved);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(oppositeTheme(theme));
  }, [setTheme, theme]);

  const value = useMemo(() => ({
    theme, preference, setTheme, toggleTheme,
  }), [preference, setTheme, theme, toggleTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme debe usarse dentro de ThemeProvider.');
  return context;
}
