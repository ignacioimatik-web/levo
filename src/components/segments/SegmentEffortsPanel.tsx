'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, ChevronRight, Gauge, ShieldCheck, Trophy } from 'lucide-react';
import { getCompetitiveSegment } from '@/data/competitive-segments';
import { getActivitiesDurable } from '@/lib/activities/storage';
import type { RideActivity, SegmentEffort, SportType } from '@/lib/activities/types';
import { formatSegmentTime, personalSegmentBests } from '@/lib/segments/matcher';

export function SegmentEffortsPanel({
  efforts,
  activityId,
  sportType,
  publicView = false,
}: {
  efforts: SegmentEffort[];
  activityId: string;
  sportType: SportType;
  publicView?: boolean;
}) {
  const [proMode, setProMode] = useState(false);
  const [activities, setActivities] = useState<RideActivity[]>([]);

  useEffect(() => {
    if (publicView) return;
    let active = true;
    void getActivitiesDurable().then((stored) => {
      if (active) setActivities(stored);
    });
    return () => { active = false; };
  }, [publicView]);

  const personalBests = useMemo(
    () => new Map(
      personalSegmentBests(activities)
        .filter((best) => best.sportType === sportType)
        .map((best) => [best.segmentId, best]),
    ),
    [activities, sportType],
  );
  const visibleEfforts = efforts
    .map((effort) => ({ effort, segment: getCompetitiveSegment(effort.segmentId) }))
    .filter((item) => item.segment != null);
  if (visibleEfforts.length === 0) return null;

  return (
    <section className="mt-5 overflow-hidden rounded-3xl border border-amber-500/20 bg-amber-500/5">
      <header className="flex items-start justify-between gap-4 border-b border-white/10 px-4 py-4 sm:px-5">
        <div>
          <p className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-amber-300">
            <Trophy className="h-4 w-4" /> Segmentos completados
          </p>
          <p className="mt-1 text-[10px] leading-relaxed text-slate-500">
            Coincidencia automática mediante tres controles GPS en el sentido correcto.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setProMode((value) => !value)}
          aria-expanded={proMode}
          className="min-h-11 shrink-0 rounded-xl border border-white/10 bg-slate-950 px-3 text-[10px] font-black uppercase text-slate-300"
        >
          {proMode ? 'Basic' : 'Pro'}
        </button>
      </header>

      <div className="divide-y divide-white/5">
        {visibleEfforts.map(({ effort, segment }) => {
          const best = personalBests.get(effort.segmentId);
          const isPersonalBest = !publicView
            && best?.activity.id === activityId
            && best.effort.elapsedSeconds === effort.elapsedSeconds;
          const deltaSeconds = best ? effort.elapsedSeconds - best.effort.elapsedSeconds : 0;
          const TypeIcon = segment!.type === 'climb' ? ArrowUp : ArrowDown;
          return (
            <article key={effort.segmentId} className="p-4 sm:p-5">
              <div className="flex items-start gap-3">
                <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${
                  segment!.type === 'climb'
                    ? 'bg-orange-500/15 text-orange-300'
                    : 'bg-blue-500/15 text-blue-300'
                }`}>
                  <TypeIcon className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-black">{segment!.name}</h3>
                    {isPersonalBest && (
                      <span className="rounded-full bg-amber-400 px-2 py-0.5 text-[9px] font-black uppercase text-slate-950">PR</span>
                    )}
                  </div>
                  <p className="mt-1 text-[10px] text-slate-500">
                    {segment!.routeName} · {(segment!.distanceM / 1000).toFixed(2)} km
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-black tabular-nums">{formatSegmentTime(effort.elapsedSeconds)}</p>
                  {!isPersonalBest && deltaSeconds > 0 && (
                    <p className="text-[10px] font-bold text-slate-500">+{formatSegmentTime(deltaSeconds)} del PR</p>
                  )}
                </div>
              </div>

              {proMode && (
                <div className="mt-4 grid grid-cols-3 gap-2">
                  <div className="rounded-xl bg-slate-950/60 p-3">
                    <p className="text-[9px] uppercase text-slate-500">Velocidad</p>
                    <p className="mt-1 text-sm font-black">{effort.averageSpeedKmh.toFixed(1)} km/h</p>
                  </div>
                  <div className="rounded-xl bg-slate-950/60 p-3">
                    <p className="text-[9px] uppercase text-slate-500">Pendiente</p>
                    <p className="mt-1 text-sm font-black">{segment!.averageGradePct > 0 ? '+' : ''}{segment!.averageGradePct}%</p>
                  </div>
                  <div className="rounded-xl bg-slate-950/60 p-3">
                    <p className="flex items-center gap-1 text-[9px] uppercase text-slate-500"><ShieldCheck className="h-3 w-3" /> Match</p>
                    <p className="mt-1 text-sm font-black">{Math.round(effort.matchQuality * 100)}%</p>
                  </div>
                </div>
              )}

              <Link
                href={`/segmentos/${segment!.id}`}
                className="mt-3 flex min-h-11 items-center justify-between rounded-xl border border-white/10 bg-slate-950/50 px-3 text-xs font-black text-slate-300 hover:border-amber-500/30 hover:text-amber-300"
              >
                <span className="flex items-center gap-2"><Gauge className="h-4 w-4" /> Ver clasificación MTB / e-bike</span>
                <ChevronRight className="h-4 w-4" />
              </Link>
            </article>
          );
        })}
      </div>
    </section>
  );
}
