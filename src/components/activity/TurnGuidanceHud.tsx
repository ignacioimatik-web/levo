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
  voiceEnabled,
  onVoiceChange,
}: {
  instruction: TurnInstruction | null;
  offRouteM: number;
  rejoinBearingDeg?: number | null;
  voiceEnabled: boolean;
  onVoiceChange: (enabled: boolean) => void;
}) {
  const offRoute = offRouteM > 75;
  if (!instruction && !offRoute) return null;
  const rejoinCardinal = rejoinBearingDeg == null ? null : cardinalForBearing(rejoinBearingDeg);

  return (
    <div className={`mt-4 overflow-hidden rounded-2xl border ${
      offRoute ? 'border-red-500/40 bg-red-500/10' : 'border-white/10 bg-slate-950/75'
    }`}>
      {offRoute && (
        <div className="flex items-center gap-2 border-b border-red-500/20 bg-red-500/15 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-red-200">
          <TriangleAlert className="h-4 w-4" /> Fuera de ruta · {Math.round(offRouteM)} m
        </div>
      )}
      <div className="flex items-center gap-4 p-3 sm:p-4">
        <div className={`grid h-16 w-16 shrink-0 place-items-center rounded-2xl ${
          offRoute ? 'bg-red-500 text-white' : 'bg-white text-slate-950'
        }`}>
          {offRoute
            ? <Navigation2 className="h-10 w-10 fill-current" style={{ transform: `rotate(${rejoinBearingDeg ?? 0}deg)` }} />
            : instruction && <TurnIcon direction={instruction.direction} />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">
            {offRoute ? 'Recuperación offline' : 'Próxima indicación'}
          </p>
          <p className="mt-1 text-lg font-black leading-tight text-white">
            {offRoute ? 'Vuelve al track' : instruction?.label}
          </p>
          <p className={`mt-1 text-2xl font-black tabular-nums ${offRoute ? 'text-red-300' : 'text-orange-400'}`}>
            {formatTurnDistance(offRoute ? offRouteM : instruction?.distanceM ?? 0)}
          </p>
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
