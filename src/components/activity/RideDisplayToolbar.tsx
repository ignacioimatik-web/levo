'use client';

import { Expand, Minimize2 } from 'lucide-react';
import type { RideDisplayMode } from '@/lib/activities/display-mode';

type RideDisplayToolbarProps = {
  mode: RideDisplayMode;
  focused: boolean;
  onModeChange: (mode: RideDisplayMode) => void;
  onFocusedChange: (focused: boolean) => void;
};

export default function RideDisplayToolbar({
  mode,
  focused,
  onModeChange,
  onFocusedChange,
}: RideDisplayToolbarProps) {
  return (
    <nav
      aria-label="Vista de conducción"
      className={`z-50 mb-4 flex items-center justify-between gap-2 rounded-2xl border border-white/10 bg-slate-950/95 p-1.5 shadow-xl backdrop-blur ${
        focused ? 'ride-focus-toolbar sticky top-[max(.5rem,env(safe-area-inset-top))]' : ''
      }`}
    >
      <div className="grid flex-1 grid-cols-2 rounded-xl bg-slate-900 p-1" role="group" aria-label="Nivel de información">
        {(['basic', 'pro'] as RideDisplayMode[]).map((value) => (
          <button
            key={value}
            type="button"
            aria-pressed={mode === value}
            onClick={() => onModeChange(value)}
            className={`min-h-11 rounded-lg px-4 text-xs font-black uppercase transition ${
              mode === value
                ? 'bg-orange-500 text-white shadow'
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            {value === 'basic' ? 'Basic' : 'Pro'}
          </button>
        ))}
      </div>
      <button
        type="button"
        aria-pressed={focused}
        onClick={() => onFocusedChange(!focused)}
        className={`flex min-h-12 items-center justify-center gap-2 rounded-xl border px-3 text-[10px] font-black uppercase ${
          focused
            ? 'ride-focus-exit border-blue-400/40 bg-blue-500/15 text-blue-200'
            : 'border-white/10 bg-slate-900 text-slate-300'
        }`}
      >
        {focused ? <Minimize2 className="h-4 w-4" /> : <Expand className="h-4 w-4" />}
        <span className="hidden min-[360px]:inline">{focused ? 'Salir' : 'Vista ruta'}</span>
      </button>
    </nav>
  );
}
