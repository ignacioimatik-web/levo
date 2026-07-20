'use client';

import {
  CornerUpLeft, CornerUpRight, Flag, MoveUp, Navigation2, RotateCcw, TriangleAlert,
  Volume2, VolumeX,
} from 'lucide-react';
import { cardinalForBearing } from '@/lib/navigation/progress';
import { formatTurnDistance } from '@/lib/navigation/turns';
import type { TurnDirection, TurnInstruction } from '@/lib/navigation/turns';

function TurnIcon({ direction }: { direction: TurnDirection }) {
  if (direction === 'arrive') return <Flag className="h-9 w-9 fill-current" />;
  if (direction === 'uturn') return <RotateCcw className="h-9 w-9" />;
  if (direction.includes('left')) {
    return <CornerUpLeft className={`h-10 w-10 ${direction.includes('slight') ? '-rotate-12' : direction.includes('sharp') ? 'rotate-12' : ''}`} />;
  }
  if (direction.includes('right')) {
    return <CornerUpRight className={`h-10 w-10 ${direction.includes('slight') ? 'rotate-12' : direction.includes('sharp') ? '-rotate-12' : ''}`} />;
  }
  return <MoveUp className="h-10 w-10" />;
}

export default function TurnGuidanceHud({
  instruction,
  offRouteM,
  rejoinBearingDeg,
  recovery,
  wrongWay,
  voiceEnabled,
  onVoiceChange,
}: {
  instruction: TurnInstruction | null;
  offRouteM: number;
  rejoinBearingDeg?: number | null;
  recovery?: {
    status: 'idle' | 'loading' | 'ready' | 'offline' | 'error';
    routed: boolean;
    distanceM: number;
    instruction: TurnInstruction | null;
  } | null;
  wrongWay?: {
    differenceDeg: number;
  } | null;
  voiceEnabled: boolean;
  onVoiceChange: (enabled: boolean) => void;
}) {
  const offRoute = offRouteM > 75;
  const wrongDirection = !offRoute && Boolean(wrongWay);
  if (!instruction && !offRoute && !wrongDirection) return null;
  const rejoinCardinal = rejoinBearingDeg == null ? null : cardinalForBearing(rejoinBearingDeg);
  const routedRecovery = offRoute && Boolean(recovery?.routed);
  const recoveryInstruction = routedRecovery ? recovery?.instruction ?? null : null;
  const recoveryLabel = recovery?.status === 'ready'
    ? 'Recuperación por caminos'
    : recovery?.status === 'loading'
      ? routedRecovery ? 'Actualizando reenganche' : 'Calculando reenganche'
      : recovery?.status === 'offline'
        ? routedRecovery ? 'Ruta guardada · sin cobertura' : 'Recuperación offline'
        : recovery?.status === 'error'
          ? routedRecovery ? 'Ruta guardada' : 'Recuperación offline'
          : 'Recuperación offline';
  const recoveryDistanceM = recoveryInstruction?.distanceM
    ?? recovery?.distanceM
    ?? offRouteM;

  return (
    <div className={`mt-4 overflow-hidden rounded-2xl border ${
      offRoute
        ? 'border-red-500/40 bg-red-500/10'
        : wrongDirection
          ? 'border-amber-400/45 bg-amber-500/10'
          : 'border-white/10 bg-slate-950/75'
    }`}>
      {offRoute && (
        <div className="flex items-center gap-2 border-b border-red-500/20 bg-red-500/15 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-red-200">
          <TriangleAlert className="h-4 w-4" /> {recoveryLabel} · {Math.round(offRouteM)} m del track
        </div>
      )}
      {wrongDirection && (
        <div
          role="alert"
          className="flex items-center gap-2 border-b border-amber-400/25 bg-amber-500/15 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-amber-100"
        >
          <TriangleAlert className="h-4 w-4" /> Sentido contrario
        </div>
      )}
      <div className="flex items-center gap-4 p-3 sm:p-4">
        <div className={`grid h-16 w-16 shrink-0 place-items-center rounded-2xl ${
          offRoute
            ? 'bg-red-500 text-white'
            : wrongDirection
              ? 'bg-amber-400 text-slate-950'
              : 'bg-white text-slate-950'
        }`}>
          {offRoute
            ? recoveryInstruction
              ? <TurnIcon direction={recoveryInstruction.direction} />
              : <Navigation2 className="h-10 w-10 fill-current" style={{ transform: `rotate(${rejoinBearingDeg ?? 0}deg)` }} />
            : wrongDirection
              ? <RotateCcw className="h-10 w-10" />
            : instruction && <TurnIcon direction={instruction.direction} />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">
            {offRoute ? recoveryLabel : wrongDirection ? 'Corrige el rumbo' : 'Próxima indicación'}
          </p>
          <p className="mt-1 text-lg font-black leading-tight text-white">
            {offRoute
              ? recoveryInstruction?.label ?? (recovery?.status === 'loading'
                ? 'Buscando camino ciclable…'
                : 'Vuelve al track')
              : wrongDirection
                ? 'Da la vuelta'
              : instruction?.label}
          </p>
          <p className={`mt-1 text-2xl font-black tabular-nums ${
            offRoute ? 'text-red-300' : wrongDirection ? 'text-amber-300' : 'text-orange-400'
          }`}>
            {wrongDirection
              ? 'Rumbo opuesto'
              : formatTurnDistance(offRoute ? recoveryDistanceM : instruction?.distanceM ?? 0)}
          </p>
          {wrongDirection && wrongWay && (
            <p className="mt-1 text-[10px] font-bold text-amber-100/70">
              Diferencia de rumbo {Math.round(wrongWay.differenceDeg)}°
            </p>
          )}
          {offRoute && routedRecovery && recovery && (
            <p className="mt-1 text-[10px] font-bold text-red-100/70">
              {formatTurnDistance(recovery.distanceM)} por caminos hasta el track
            </p>
          )}
          {offRoute && rejoinBearingDeg != null && (
            <p className="mt-1 text-[10px] font-black uppercase tracking-widest text-red-200">
              Rumbo {Math.round(rejoinBearingDeg)}° · {rejoinCardinal}
            </p>
          )}
        </div>
        <button
          type="button"
          aria-label={voiceEnabled ? 'Desactivar avisos de voz' : 'Activar avisos de voz'}
          aria-pressed={voiceEnabled}
          onClick={() => onVoiceChange(!voiceEnabled)}
          className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl border ${
            voiceEnabled
              ? 'border-blue-400/40 bg-blue-500/20 text-blue-200'
              : 'border-white/10 bg-slate-900 text-slate-500'
          }`}
        >
          {voiceEnabled ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
        </button>
      </div>
    </div>
  );
}
