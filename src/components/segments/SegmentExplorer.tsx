'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, ChevronRight, MapPinned, Trophy } from 'lucide-react';
import { COMPETITIVE_SEGMENTS, type CompetitiveSegmentType } from '@/data/competitive-segments';
import { getActivitiesDurable } from '@/lib/activities/storage';
import type { RideActivity } from '@/lib/activities/types';
import { formatSegmentTime, personalSegmentBests } from '@/lib/segments/matcher';
import { SegmentCourseSketch } from './SegmentCourseSketch';

type SegmentFilter = 'all' | CompetitiveSegmentType;

export function SegmentExplorer() {
  const [filter, setFilter] = useState<SegmentFilter>('all');
  const [activities, setActivities] = useState<RideActivity[]>([]);

  useEffect(() => {
    let active = true;
    void getActivitiesDurable().then((stored) => {
      if (active) setActivities(stored);
    });
    return () => { active = false; };
  }, []);

  const bests = useMemo(
    () => new Map(
      personalSegmentBests(activities).map((best) => [`${best.segmentId}:${best.sportType}`, best]),
    ),
    [activities],
  );
  const segments = COMPETITIVE_SEGMENTS.filter((segment) => filter === 'all' || segment.type === filter);

  return (
    <main className="min-h-screen bg-slate-950 pb-28 text-white md:pb-16">
      <div className="mx-auto max-w-7xl px-4 py-7 sm:px-6 md:py-12">
        <header className="mb-7 flex flex-wrap items-end justify-between gap-5">
          <div>
            <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-amber-300">
              <Trophy className="h-4 w-4" /> Rendimiento sobre el terreno
            </p>
            <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">Segmentos MTB</h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-400">
              Tramos extraídos de tracks GPS reales. La app reconoce automáticamente cada paso y mantiene clasificaciones separadas para MTB y e-bike.
            </p>
          </div>
          <Link href="/grabar" className="flex min-h-11 items-center rounded-xl bg-orange-500 px-5 text-xs font-black uppercase">
            Grabar una salida
          </Link>
        </header>

        <div className="mb-5 flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Filtrar segmentos">
          {([
            ['all', 'Todos'],
            ['climb', 'Subidas'],
            ['descent', 'Descensos'],
          ] as const).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setFilter(value)}
              aria-pressed={filter === value}
              className={`min-h-11 shrink-0 rounded-xl border px-4 text-xs font-black ${
                filter === value
                  ? 'border-orange-500 bg-orange-500/10 text-orange-300'
                  : 'border-white/10 bg-slate-900 text-slate-400'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {segments.map((segment) => {
            const ebikeBest = bests.get(`${segment.id}:ebike`);
            const mtbBest = bests.get(`${segment.id}:mtb`);
            const TypeIcon = segment.type === 'climb' ? ArrowUp : ArrowDown;
            return (
              <article key={segment.id} className="overflow-hidden rounded-3xl border border-white/10 bg-slate-900/60">
                <SegmentCourseSketch segment={segment} compact />
                <div className="p-4 sm:p-5">
                  <div className="flex items-start gap-3">
                    <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${
                      segment.type === 'climb'
                        ? 'bg-orange-500/15 text-orange-300'
                        : 'bg-blue-500/15 text-blue-300'
                    }`}>
                      <TypeIcon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h2 className="font-black">{segment.name}</h2>
                      <p className="mt-1 flex items-center gap-1 text-[10px] text-slate-500">
                        <MapPinned className="h-3 w-3" /> {segment.region}
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-xl bg-slate-950/60 p-2">
                      <p className="text-[9px] uppercase text-slate-600">Distancia</p>
                      <p className="mt-1 text-xs font-black">{(segment.distanceM / 1000).toFixed(2)} km</p>
                    </div>
                    <div className="rounded-xl bg-slate-950/60 p-2">
                      <p className="text-[9px] uppercase text-slate-600">Desnivel</p>
                      <p className="mt-1 text-xs font-black">{segment.elevationDeltaM > 0 ? '+' : ''}{segment.elevationDeltaM} m</p>
                    </div>
                    <div className="rounded-xl bg-slate-950/60 p-2">
                      <p className="text-[9px] uppercase text-slate-600">Media</p>
                      <p className="mt-1 text-xs font-black">{segment.averageGradePct > 0 ? '+' : ''}{segment.averageGradePct}%</p>
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-2 divide-x divide-white/5 rounded-xl border border-white/5 bg-slate-950/40">
                    <div className="px-3 py-2.5">
                      <p className="text-[9px] font-black uppercase text-slate-600">Tu PR e-bike</p>
                      <p className="mt-1 font-black">{ebikeBest ? formatSegmentTime(ebikeBest.effort.elapsedSeconds) : '—'}</p>
                    </div>
                    <div className="px-3 py-2.5">
                      <p className="text-[9px] font-black uppercase text-slate-600">Tu PR MTB</p>
                      <p className="mt-1 font-black">{mtbBest ? formatSegmentTime(mtbBest.effort.elapsedSeconds) : '—'}</p>
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <Link href={`/rutas/${segment.routeSlug}`} className="flex min-h-11 items-center justify-center rounded-xl border border-white/10 text-xs font-black text-slate-400">
                      Ver ruta
                    </Link>
                    <Link href={`/segmentos/${segment.id}`} className="flex min-h-11 items-center justify-center gap-1 rounded-xl bg-orange-500 text-xs font-black">
                      Clasificación <ChevronRight className="h-4 w-4" />
                    </Link>
                  </div>
                </div>
              </article>
            );
          })}
        </section>
      </div>
    </main>
  );
}
