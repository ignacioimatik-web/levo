'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  ArrowDown, ArrowLeft, ArrowUp, Bike, Clock3, Gauge, Loader2, MapPinned,
  Medal, ShieldCheck, Trophy,
} from 'lucide-react';
import type { CompetitiveSegment } from '@/data/competitive-segments';
import { getActivitiesDurable } from '@/lib/activities/storage';
import type { RideActivity, SportType } from '@/lib/activities/types';
import {
  loadSegmentLeaderboard,
  type SegmentLeaderboardEntry,
} from '@/lib/segments/leaderboard';
import {
  formatSegmentTime,
  personalSegmentBests,
} from '@/lib/segments/matcher';
import { SegmentCourseSketch } from './SegmentCourseSketch';

export function SegmentDetail({ segment }: { segment: CompetitiveSegment }) {
  const [sportType, setSportType] = useState<SportType>('ebike');
  const [leaderboard, setLeaderboard] = useState<SegmentLeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
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

  useEffect(() => {
    let active = true;
    void loadSegmentLeaderboard(segment.id, sportType)
      .then((entries) => {
        if (active) setLeaderboard(entries);
      })
      .catch((loadError) => {
        if (active) setError(loadError instanceof Error ? loadError.message : 'No hemos podido cargar la clasificación.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [segment.id, sportType]);

  const selectSport = (sport: SportType) => {
    if (sport === sportType) return;
    setLoading(true);
    setError('');
    setSportType(sport);
  };

  return (
    <main className="min-h-screen bg-slate-950 pb-28 text-white md:pb-16">
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 md:py-10">
        <Link href="/segmentos" className="mb-5 inline-flex min-h-11 items-center gap-2 text-xs font-bold text-slate-400 hover:text-white">
          <ArrowLeft className="h-4 w-4" /> Todos los segmentos
        </Link>

        <div className="grid gap-5 lg:grid-cols-[.8fr_1.2fr]">
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
                <p className="flex items-center gap-2 text-[10px] font-black uppercase text-amber-300">
                  <Trophy className="h-4 w-4" /> Tu récord personal
                </p>
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

          <section className="overflow-hidden rounded-3xl border border-white/10 bg-slate-900/50">
            <header className="border-b border-white/10 p-4 sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-amber-300">
                    <Medal className="h-4 w-4" /> Clasificación
                  </p>
                  <p className="mt-1 text-[10px] text-slate-500">Mejor esfuerzo público por rider</p>
                </div>
                <div className="grid grid-cols-2 rounded-xl border border-white/10 bg-slate-950 p-1" role="group" aria-label="Tipo de bicicleta">
                  {(['ebike', 'mtb'] as const).map((sport) => (
                    <button
                      key={sport}
                      type="button"
                      onClick={() => selectSport(sport)}
                      aria-pressed={sportType === sport}
                      className={`min-h-11 rounded-lg px-4 text-xs font-black uppercase ${
                        sportType === sport ? 'bg-orange-500 text-white' : 'text-slate-500'
                      }`}
                    >
                      {sport === 'ebike' ? 'E-bike' : 'MTB'}
                    </button>
                  ))}
                </div>
              </div>
            </header>

            {loading ? (
              <div className="grid min-h-72 place-items-center"><Loader2 className="h-7 w-7 animate-spin text-orange-400" /></div>
            ) : error ? (
              <p role="alert" className="m-4 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-200">{error}</p>
            ) : leaderboard.length === 0 ? (
              <div className="px-6 py-16 text-center">
                <Trophy className="mx-auto h-9 w-9 text-slate-700" />
                <h2 className="mt-4 text-xl font-black">Clasificación abierta</h2>
                <p className="mx-auto mt-2 max-w-sm text-sm text-slate-500">
                  Publica una actividad {sportType === 'ebike' ? 'e-bike' : 'MTB'} que complete el segmento para inaugurarla.
                </p>
              </div>
            ) : (
              <div>
                <div className="grid grid-cols-[48px_1fr_auto] gap-3 border-b border-white/5 px-4 py-2 text-[9px] font-black uppercase text-slate-600 sm:grid-cols-[56px_1fr_120px_100px]">
                  <span>Pos.</span><span>Rider</span><span className="hidden sm:block">Velocidad</span><span className="text-right">Tiempo</span>
                </div>
                {leaderboard.map((entry) => (
                  <article key={entry.userId} className={`grid min-h-16 grid-cols-[48px_1fr_auto] items-center gap-3 border-b border-white/5 px-4 py-3 last:border-0 sm:grid-cols-[56px_1fr_120px_100px] ${entry.own ? 'bg-orange-500/5' : ''}`}>
                    <span className={`text-lg font-black ${entry.rank <= 3 ? 'text-amber-300' : 'text-slate-600'}`}>#{entry.rank}</span>
                    <div className="min-w-0">
                      <p className="truncate font-black">{entry.riderName}{entry.own ? ' · Tú' : ''}</p>
                      <p className="mt-0.5 truncate text-[10px] text-slate-600">{entry.bikeName || new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium' }).format(new Date(entry.startedAt))}</p>
                    </div>
                    <span className="hidden items-center gap-1 text-xs font-bold text-slate-400 sm:flex"><Gauge className="h-3.5 w-3.5" /> {entry.averageSpeedKmh.toFixed(1)} km/h</span>
                    <span className="flex items-center justify-end gap-1 text-lg font-black tabular-nums"><Clock3 className="h-4 w-4 text-slate-600" /> {formatSegmentTime(entry.elapsedSeconds)}</span>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
