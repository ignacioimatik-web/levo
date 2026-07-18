'use client';

import { Flag, Gauge, Trophy } from 'lucide-react';
import type { RideDisplayMode } from '@/lib/activities/display-mode';
import type { LiveRideSplitState, RideSplit } from '@/lib/activities/track-analysis';

type LiveSplitCardProps = {
  mode: RideDisplayMode;
  state: LiveRideSplitState;
  announcement: RideSplit | null;
};

function formatSplitTime(seconds: number | null): string {
  if (seconds == null || !Number.isFinite(seconds) || seconds <= 0) return '—';
  const rounded = Math.round(seconds);
  const hours = Math.floor(rounded / 3_600);
  const minutes = Math.floor(rounded % 3_600 / 60);
  const remainder = rounded % 60;
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`
    : `${minutes}:${String(remainder).padStart(2, '0')}`;
}

function formatDelta(seconds: number | null): string {
  if (seconds == null) return 'Primer parcial';
  if (Math.abs(seconds) < 1) return 'Mismo tiempo';
  return `${seconds < 0 ? '−' : '+'}${formatSplitTime(Math.abs(seconds))} vs. km anterior`;
}

export default function LiveSplitCard({ mode, state, announcement }: LiveSplitCardProps) {
  const lastSplit = announcement ?? state.lastCompleted;
  const announcedNow = announcement != null;

  return (
    <section
      aria-label="Parcial kilométrico en vivo"
      className={`overflow-hidden rounded-2xl border transition-colors ${
        announcedNow
          ? 'border-orange-400/50 bg-orange-500/15'
          : 'border-white/10 bg-slate-900/60'
      }`}
    >
      {announcedNow && (
        <div
          role="status"
          aria-live="polite"
          className="flex items-center justify-between gap-3 border-b border-orange-400/20 px-4 py-3"
        >
          <p className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-orange-200">
            <Flag className="h-4 w-4" />
            Km {announcement.index} completado
          </p>
          <p className="text-xl font-black tabular-nums text-white">
            {formatSplitTime(announcement.movingSeconds)}
          </p>
        </div>
      )}

      <div className="p-4">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">
              Km {state.currentIndex} en curso
            </p>
            <p className="mt-1 text-xl font-black tabular-nums">
              {(state.currentDistanceM / 1_000).toFixed(2)}
              <span className="ml-1 text-[10px] text-slate-500">km</span>
            </p>
          </div>
          {lastSplit && (
            <div className="text-right">
              <p className="flex items-center justify-end gap-1 text-[9px] font-black uppercase tracking-wider text-slate-500">
                {state.fastestCompletedIndex === lastSplit.index && (
                  <Trophy className="h-3 w-3 text-orange-300" />
                )}
                Último · km {lastSplit.index}
              </p>
              <p className="mt-1 text-lg font-black tabular-nums text-slate-200">
                {formatSplitTime(lastSplit.movingSeconds)}
              </p>
            </div>
          )}
        </div>

        <div
          className="mt-3 h-2 overflow-hidden rounded-full bg-slate-800"
          role="progressbar"
          aria-label={`Progreso del kilómetro ${state.currentIndex}`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(state.currentProgressPercent)}
        >
          <div
            className="h-full rounded-full bg-orange-400 transition-[width] duration-500"
            style={{ width: `${state.currentProgressPercent}%` }}
          />
        </div>

        {mode === 'pro' && (
          <div className="mt-3 grid grid-cols-3 gap-2 border-t border-white/5 pt-3 text-center">
            <div>
              <p className="text-[8px] uppercase tracking-wider text-slate-600">Ritmo actual</p>
              <p className="mt-1 text-xs font-black tabular-nums">
                {state.currentAverageSpeedKmh > 0 ? state.currentAverageSpeedKmh.toFixed(1) : '—'}
                <span className="ml-1 text-[8px] text-slate-600">km/h</span>
              </p>
            </div>
            <div>
              <p className="text-[8px] uppercase tracking-wider text-slate-600">Proyección</p>
              <p className="mt-1 text-xs font-black tabular-nums">
                {formatSplitTime(state.projectedMovingSeconds)}
              </p>
            </div>
            <div>
              <p className="text-[8px] uppercase tracking-wider text-slate-600">Tendencia</p>
              <p className={`mt-1 text-[10px] font-black ${
                (state.deltaFromPreviousSeconds ?? 0) < 0 ? 'text-emerald-300' : 'text-slate-300'
              }`}>
                {formatDelta(state.deltaFromPreviousSeconds)}
              </p>
            </div>
          </div>
        )}

        {!lastSplit && mode === 'basic' && (
          <p className="mt-2 flex items-center gap-1.5 text-[9px] text-slate-500">
            <Gauge className="h-3 w-3" /> El primer parcial aparecerá al completar 1 km.
          </p>
        )}
      </div>
    </section>
  );
}
