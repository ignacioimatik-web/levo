'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  ArrowDown, ArrowLeft, ArrowUp, Bike, MapPinned, ShieldCheck, Trophy,
} from 'lucide-react';
import type { CompetitiveSegment } from '@/data/competitive-segments';
import { getActivitiesDurable } from '@/lib/activities/storage';
import type { RideActivity, SportType } from '@/lib/activities/types';
import {
  formatSegmentTime,
  personalSegmentBests,
} from '@/lib/segments/matcher';
import { SegmentCourseSketch } from './SegmentCourseSketch';

export function SegmentDetail({ segment }: { segment: CompetitiveSegment }) {
  const [sportType, setSportType] = useState<SportType>('ebike');
  const [activities, setActivities] = useState<RideActivity[]>([]);
  const TypeIcon = segment.type === 'climb' ? ArrowUp : ArrowDown;
  const personalBest = useMemo(
    () => personalSegmentBests(activities).find((best) => (
      best.segmentId === segment.id && best.sportType === sportType
    )) ?? null,
    [activities, segment.id, sportType],
  );

  useEffect(() => {
    let active = true;
    void getActivitiesDurable().then((stored) => {
      if (active) setActivities(stored);
    });
    return () => { active = false; };
  }, []);

  return (
    <main className="min-h-screen bg-slate-950 pb-28 text-white md:pb-16">
      <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 md:py-10">
        <Link href="/segmentos" className="mb-5 inline-flex min-h-11 items-center gap-2 text-xs font-bold text-slate-400 hover:text-white">
          <ArrowLeft className="h-4 w-4" /> Todos los segmentos
        </Link>

        <div>
          <section className="overflow-hidden rounded-3xl border border-white/10 bg-slate-900/60">
            <SegmentCourseSketch segment={segment} />
            <div className="p-5 sm:p-6">
              <p className={`flex items-center gap-2 text-xs font-black uppercase tracking-widest ${
                segment.type === 'climb' ? 'text-orange-300' : 'text-blue-300'
              }`}>
                <TypeIcon className="h-4 w-4" /> {segment.type === 'climb' ? 'Subida' : 'Descenso'}
              </p>
              <h1 className="mt-2 text-3xl font-black">{segment.name}</h1>
              <p className="mt-2 flex items-center gap-1.5 text-xs text-slate-400">
                <MapPinned className="h-4 w-4" /> {segment.region} · {segment.routeName}
              </p>

              <div className="mt-5 grid grid-cols-3 gap-2">
                <div className="rounded-xl bg-slate-950/70 p-3">
                  <p className="text-[9px] uppercase text-slate-600">Distancia</p>
                  <p className="mt-1 font-black">{(segment.distanceM / 1000).toFixed(2)} km</p>
                </div>
                <div className="rounded-xl bg-slate-950/70 p-3">
                  <p className="text-[9px] uppercase text-slate-600">Desnivel</p>
                  <p className="mt-1 font-black">{segment.elevationDeltaM > 0 ? '+' : ''}{segment.elevationDeltaM} m</p>
                </div>
                <div className="rounded-xl bg-slate-950/70 p-3">
                  <p className="text-[9px] uppercase text-slate-600">Pendiente</p>
                  <p className="mt-1 font-black">{segment.averageGradePct > 0 ? '+' : ''}{segment.averageGradePct}%</p>
                </div>
              </div>

              <div className="mt-4 rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="flex items-center gap-2 text-[10px] font-black uppercase text-amber-300">
                    <Trophy className="h-4 w-4" /> Tu récord personal
                  </p>
                  <div className="grid grid-cols-2 rounded-xl border border-white/10 bg-slate-950 p-1" role="group" aria-label="Tipo de bicicleta">
                    {(['ebike', 'mtb'] as const).map((sport) => (
                      <button
                        key={sport}
                        type="button"
                        onClick={() => setSportType(sport)}
                        aria-pressed={sportType === sport}
                        className={`min-h-10 rounded-lg px-3 text-[10px] font-black uppercase ${
                          sportType === sport ? 'bg-orange-500 text-white' : 'text-slate-500'
                        }`}
                      >
                        {sport === 'ebike' ? 'E-bike' : 'MTB'}
                      </button>
                    ))}
                  </div>
                </div>
                {personalBest ? (
                  <div className="mt-3 flex items-end justify-between gap-4">
                    <div>
                      <p className="text-3xl font-black tabular-nums">{formatSegmentTime(personalBest.effort.elapsedSeconds)}</p>
                      <p className="mt-1 text-[10px] text-slate-500">{personalBest.attempts} {personalBest.attempts === 1 ? 'intento' : 'intentos'} · {personalBest.effort.averageSpeedKmh.toFixed(1)} km/h</p>
                    </div>
                    <Link href={`/actividades/${personalBest.activity.id}`} className="flex min-h-11 items-center rounded-xl border border-white/10 px-3 text-xs font-black">
                      Ver salida
                    </Link>
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-slate-400">Aún no has pasado por los tres controles de este tramo.</p>
                )}
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2">
                <Link href={`/rutas/${segment.routeSlug}`} className="flex min-h-11 items-center justify-center rounded-xl border border-white/10 text-xs font-black">
                  Abrir ruta
                </Link>
                <Link href="/grabar" className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-orange-500 text-xs font-black uppercase">
                  <Bike className="h-4 w-4" /> Salir
                </Link>
              </div>
              <p className="mt-4 flex items-start gap-2 text-[10px] leading-relaxed text-slate-500">
                <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                El tiempo solo se registra al cruzar tres controles GPS ordenados, con distancia y velocidad plausibles.
              </p>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
