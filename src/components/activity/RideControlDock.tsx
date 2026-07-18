'use client';

import { CircleStop, Pause, Play } from 'lucide-react';

export default function RideControlDock({
  status,
  duration,
  finishArmed,
  onPause,
  onResume,
  onArmFinish,
  onFinish,
  focused = false,
}: {
  status: 'requesting' | 'recording' | 'paused';
  duration: string;
  finishArmed: boolean;
  onPause: () => void;
  onResume: () => void;
  onArmFinish: () => void;
  onFinish: () => void;
  focused?: boolean;
}) {
  return (
    <div className={`fixed inset-x-3 mx-auto max-w-md lg:hidden ${
      focused
        ? 'bottom-[max(.75rem,env(safe-area-inset-bottom))] z-[2010]'
        : 'bottom-20 z-[90] md:bottom-3'
    }`}>
      <div className="flex min-h-16 items-center gap-3 rounded-2xl border border-white/15 bg-slate-950/95 p-2.5 shadow-2xl shadow-black/60 backdrop-blur-xl">
        <div className="min-w-0 flex-1 pl-2">
          <p className={`text-[8px] font-black uppercase tracking-[0.18em] ${
            status === 'paused' ? 'text-amber-300' : 'text-red-400'
          }`}>
            {status === 'paused' ? 'En pausa' : status === 'requesting' ? 'Buscando GPS' : 'Grabando'}
          </p>
          <p className="mt-0.5 text-xl font-black tabular-nums text-white">{duration}</p>
        </div>
        {status === 'paused' ? (
          <button type="button" onClick={onResume}
            className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-emerald-500 text-slate-950" aria-label="Reanudar grabación">
            <Play className="h-5 w-5 fill-current" />
          </button>
        ) : (
          <button type="button" onClick={onPause} disabled={status === 'requesting'}
            className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-amber-400 text-slate-950 disabled:opacity-40" aria-label="Pausar grabación">
            <Pause className="h-5 w-5 fill-current" />
          </button>
        )}
        <button
          type="button"
          onClick={finishArmed ? onFinish : onArmFinish}
          className={`flex h-12 shrink-0 items-center justify-center rounded-xl bg-red-500 text-white transition-all ${
            finishArmed ? 'min-w-28 px-3' : 'w-12'
          }`}
          aria-label={finishArmed ? 'Confirmar fin de la actividad' : 'Preparar fin de la actividad'}
        >
          {finishArmed
            ? <span className="text-[9px] font-black uppercase">Confirmar fin</span>
            : <CircleStop className="h-5 w-5" />}
        </button>
      </div>
    </div>
  );
}
