'use client';

import { Moon, Sun } from 'lucide-react';
import { useTheme } from './ThemeProvider';

export default function ThemeToggle({ showLabel = false }: { showLabel?: boolean }) {
  const { theme, toggleTheme } = useTheme();
  const nextLabel = theme === 'dark' ? 'Activar modo día' : 'Activar modo noche';

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={nextLabel}
      title={nextLabel}
      className="theme-toggle flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-xl border border-white/10 bg-slate-900/70 px-3 text-slate-300 transition-colors hover:border-orange-500/40 hover:text-orange-400"
    >
      {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      {showLabel && <span className="text-xs font-black">{theme === 'dark' ? 'Día' : 'Noche'}</span>}
    </button>
  );
}
