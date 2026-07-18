'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Award, BatteryCharging, Bike, CalendarRange, Check, ChevronRight, Clock3,
  Flag, Flame, Gauge, Mountain, Pencil, Route, Sparkles, Target, TrendingUp, Zap,
} from 'lucide-react';
import { getCompetitiveSegment } from '@/data/competitive-segments';
import { getActivities } from '@/lib/activities/storage';
import { buildBatteryModel, predictBatteryForRoute } from '@/lib/activities/battery';
import { pullActivities } from '@/lib/activities/sync';
import type { RideActivity } from '@/lib/activities/types';
import { calculateProgress } from '@/lib/progress/analytics';
import {
  DEFAULT_GOALS, getProgressGoals, saveProgressGoals,
} from '@/lib/progress/storage';
import type { ProgressGoals } from '@/lib/progress/types';
import { formatSegmentTime, personalSegmentBests } from '@/lib/segments/matcher';

function formatHours(seconds: number): string {
  return (seconds / 3600).toLocaleString('es-ES', { maximumFractionDigits: 1 });
}

function GoalRing({ label, current, target, unit, color }: {
  label: string;
  current: number;
  target: number;
  unit: string;
  color: string;
}) {
  const percent = target > 0 ? Math.min(100, current / target * 100) : 0;
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-slate-950/60 p-3">
      <div
        className="grid h-14 w-14 shrink-0 place-items-center rounded-full"
        style={{ background: `conic-gradient(${color} ${percent}%, #1e293b ${percent}% 100%)` }}
      >
        <div className="grid h-11 w-11 place-items-center rounded-full bg-slate-950 text-[10px] font-black">
          {Math.round(percent)}%
        </div>
      </div>
      <div className="min-w-0">
        <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">{label}</p>
        <p className="mt-1 font-black">{current.toFixed(unit === 'km' ? 1 : 0)} <span className="text-xs text-slate-500">/ {target} {unit}</span></p>
      </div>
    </div>
  );
}

function WeeklyChart({ activities }: { activities: RideActivity[] }) {
  const summary = useMemo(() => calculateProgress(activities), [activities]);
  const maxDistance = Math.max(...summary.weeks.map((week) => week.distanceKm), 1);

  return (
    <div className="flex h-52 items-end gap-2 sm:gap-3" role="img" aria-label="Distancia semanal durante las últimas ocho semanas">
      {summary.weeks.map((week, index) => {
        const height = Math.max(week.distanceKm > 0 ? 8 : 2, week.distanceKm / maxDistance * 100);
        const current = index === summary.weeks.length - 1;
        return (
          <div key={week.key} className="flex h-full min-w-0 flex-1 flex-col justify-end gap-2 text-center">
            <span className="text-[9px] font-bold tabular-nums text-slate-500">
              {week.distanceKm > 0 ? week.distanceKm.toFixed(0) : ''}
            </span>
            <div className="flex h-36 items-end rounded-lg bg-slate-950/50 p-1">
              <div
                className={`w-full rounded-md transition-all ${current ? 'bg-orange-400' : 'bg-slate-600'}`}
                style={{ height: `${height}%` }}
                title={`${week.distanceKm.toFixed(1)} km · ${week.rides} salidas`}
              />
            </div>
            <span className={`truncate text-[8px] font-bold uppercase ${current ? 'text-orange-400' : 'text-slate-600'}`}>
              {week.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function RecordCard({ icon: Icon, label, activity, value }: {
  icon: typeof Route;
  label: string;
  activity: RideActivity | null;
  value: (activity: RideActivity) => string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-4">
      <div className="flex items-center gap-2 text-slate-500">
        <Icon className="h-4 w-4 text-orange-400" />
        <span className="text-[9px] font-black uppercase tracking-widest">{label}</span>
      </div>
      {activity ? (
        <>
          <p className="mt-3 text-2xl font-black">{value(activity)}</p>
          <Link href={`/actividades/${activity.id}`} className="mt-2 flex items-center gap-1 truncate text-xs font-bold text-slate-500 hover:text-orange-400">
            <span className="truncate">{activity.title}</span><ChevronRight className="h-3 w-3 shrink-0" />
          </Link>
        </>
      ) : (
        <p className="mt-4 text-sm text-slate-600">Aún sin datos</p>
      )}
    </div>
  );
}

export default function ProgressDashboard() {
  const [activities, setActivities] = useState<RideActivity[]>([]);
  const [goals, setGoals] = useState<ProgressGoals>(DEFAULT_GOALS);
  const [draftGoals, setDraftGoals] = useState<ProgressGoals>(DEFAULT_GOALS);
  const [loaded, setLoaded] = useState(false);
  const [editingGoals, setEditingGoals] = useState(false);

  const refresh = useCallback(() => setActivities(getActivities()), []);

  useEffect(() => {
    const initialRead = window.setTimeout(() => {
      const storedGoals = getProgressGoals();
      setGoals(storedGoals);
      setDraftGoals(storedGoals);
      refresh();
      setLoaded(true);
    }, 0);
    void pullActivities().then(refresh);
    return () => window.clearTimeout(initialRead);
  }, [refresh]);

  const progress = useMemo(() => calculateProgress(activities), [activities]);
  const segmentBests = useMemo(() => personalSegmentBests(activities), [activities]);
  const batteryModel = useMemo(() => buildBatteryModel(activities, null), [activities]);
  const batteryCapacityWh = batteryModel.typicalCapacityWh ?? 700;
  const fullBatteryPrediction = useMemo(() => predictBatteryForRoute({
    model: batteryModel,
    distanceKm: 1,
    elevationGainM: batteryModel.historicalClimbMPerKm,
    batteryStart: 100,
    capacityWh: batteryCapacityWh,
  }), [batteryCapacityWh, batteryModel]);
  const previousWeek = progress.weeks.at(-2);
  const distanceChange = previousWeek && previousWeek.distanceKm > 0
    ? (progress.currentWeek.distanceKm - previousWeek.distanceKm) / previousWeek.distanceKm * 100
    : null;

  const saveGoals = () => {
    const normalized = {
      weeklyDistanceKm: Math.max(1, draftGoals.weeklyDistanceKm),
      weeklyElevationM: Math.max(100, draftGoals.weeklyElevationM),
      weeklyRides: Math.max(1, draftGoals.weeklyRides),
    };
    saveProgressGoals(normalized);
    setGoals(normalized);
    setDraftGoals(normalized);
    setEditingGoals(false);
  };

  return (
    <main className="min-h-screen bg-slate-950 pb-28 text-white md:pb-16">
      <div className="mx-auto max-w-7xl px-4 py-7 sm:px-6 md:py-12">
        <header className="mb-8 flex flex-wrap items-end justify-between gap-5">
          <div>
            <p className="mb-2 flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-orange-400">
              <TrendingUp className="h-4 w-4" /> Tu evolución
            </p>
            <h1 className="text-3xl font-black tracking-tight sm:text-4xl">Progreso</h1>
            <p className="mt-2 max-w-xl text-sm text-slate-400">Entrenamiento, desnivel y eficiencia e-bike, sin convertir cada salida en una competición.</p>
          </div>
          <div className="flex gap-2">
            <Link href="/mapa-personal" className="rounded-xl border border-orange-500/20 bg-orange-500/5 px-4 py-3 text-xs font-black text-orange-300">Mapa personal</Link>
            <Link href="/actividades" className="rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-xs font-black">Ver historial</Link>
            <Link href="/grabar" className="flex items-center gap-2 rounded-xl bg-orange-500 px-4 py-3 text-xs font-black uppercase">
              <Bike className="h-4 w-4" /> Salir
            </Link>
          </div>
        </header>

        <section className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <div className="rounded-3xl border border-white/10 bg-slate-900/60 p-5">
            <p className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-slate-500"><Route className="h-4 w-4" /> Distancia total</p>
            <p className="mt-3 text-3xl font-black">{progress.totalDistanceKm.toFixed(1)} <span className="text-xs text-slate-500">km</span></p>
          </div>
          <div className="rounded-3xl border border-white/10 bg-slate-900/60 p-5">
            <p className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-slate-500"><Mountain className="h-4 w-4" /> Desnivel total</p>
            <p className="mt-3 text-3xl font-black">{Math.round(progress.totalElevationM).toLocaleString('es-ES')} <span className="text-xs text-slate-500">m</span></p>
          </div>
          <div className="rounded-3xl border border-white/10 bg-slate-900/60 p-5">
            <p className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-slate-500"><Clock3 className="h-4 w-4" /> Tiempo</p>
            <p className="mt-3 text-3xl font-black">{formatHours(progress.totalDurationSeconds)} <span className="text-xs text-slate-500">h</span></p>
          </div>
          <div className="rounded-3xl border border-white/10 bg-slate-900/60 p-5">
            <p className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-slate-500"><Flame className="h-4 w-4 text-orange-400" /> Racha semanal</p>
            <p className="mt-3 text-3xl font-black">{progress.activeWeekStreak} <span className="text-xs text-slate-500">{progress.activeWeekStreak === 1 ? 'semana' : 'semanas'}</span></p>
          </div>
        </section>

        {!loaded ? (
          <div className="py-20 text-center text-sm text-slate-500">Calculando tu progreso…</div>
        ) : (
          <div className="grid gap-5 lg:grid-cols-[1.35fr_.65fr]">
            <div className="space-y-5">
              <section className="rounded-3xl border border-white/10 bg-slate-900/50 p-5 sm:p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-400">
                      <CalendarRange className="h-4 w-4 text-orange-400" /> Últimas 8 semanas
                    </p>
                    <h2 className="mt-2 text-2xl font-black">{progress.currentWeek.distanceKm.toFixed(1)} km esta semana</h2>
                  </div>
                  {distanceChange != null && (
                    <span className={`rounded-full px-2.5 py-1 text-[10px] font-black ${distanceChange >= 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-800 text-slate-400'}`}>
                      {distanceChange >= 0 ? '+' : ''}{distanceChange.toFixed(0)}%
                    </span>
                  )}
                </div>
                <WeeklyChart activities={activities} />
              </section>

              <section>
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="flex items-center gap-2 font-black"><Award className="h-5 w-5 text-orange-400" /> Récords personales</h2>
                  <span className="text-[10px] uppercase tracking-widest text-slate-600">{progress.totalRides} actividades</span>
                </div>
                <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
                  <RecordCard icon={Route} label="Más larga" activity={progress.records.longest} value={(activity) => `${(activity.distanceM / 1000).toFixed(1)} km`} />
                  <RecordCard icon={Mountain} label="Más desnivel" activity={progress.records.mostElevation} value={(activity) => `${Math.round(activity.elevationGainM)} m`} />
                  <RecordCard icon={Gauge} label="Mejor media" activity={progress.records.fastest} value={(activity) => `${activity.averageSpeedKmh.toFixed(1)} km/h`} />
                  <RecordCard icon={Zap} label="Más eficiente" activity={progress.records.mostEfficient} value={(activity) => `${((activity.energyUsedWh ?? 0) / (activity.distanceM / 1000)).toFixed(1)} Wh/km`} />
                </div>
              </section>
            </div>

            <aside className="space-y-5">
              <section className="rounded-3xl border border-white/10 bg-slate-900/50 p-5">
                <div className="flex items-center justify-between">
                  <h2 className="flex items-center gap-2 font-black"><Target className="h-5 w-5 text-orange-400" /> Objetivo semanal</h2>
                  <button onClick={() => setEditingGoals((value) => !value)} className="rounded-lg p-2 text-slate-500 hover:bg-white/5 hover:text-white" aria-label="Editar objetivos">
                    <Pencil className="h-4 w-4" />
                  </button>
                </div>
                {editingGoals ? (
                  <div className="mt-5 space-y-3">
                    {([
                      ['weeklyDistanceKm', 'Distancia', 'km'],
                      ['weeklyElevationM', 'Desnivel', 'm'],
                      ['weeklyRides', 'Salidas', ''],
                    ] as const).map(([field, label, unit]) => (
                      <label key={field} className="flex items-center justify-between gap-4 text-xs font-bold text-slate-400">
                        {label}
                        <span className="flex items-center gap-2">
                          <input type="number" min="1" value={draftGoals[field]}
                            onChange={(event) => setDraftGoals({ ...draftGoals, [field]: Number(event.target.value) })}
                            className="w-24 rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-right text-white outline-none focus:border-orange-500" />
                          <span className="w-5 text-slate-600">{unit}</span>
                        </span>
                      </label>
                    ))}
                    <button onClick={saveGoals} className="flex w-full items-center justify-center gap-2 rounded-xl bg-orange-500 py-3 text-xs font-black uppercase">
                      <Check className="h-4 w-4" /> Guardar objetivos
                    </button>
                  </div>
                ) : (
                  <div className="mt-4 space-y-2">
                    <GoalRing label="Distancia" current={progress.currentWeek.distanceKm} target={goals.weeklyDistanceKm} unit="km" color="#fb923c" />
                    <GoalRing label="Desnivel" current={progress.currentWeek.elevationM} target={goals.weeklyElevationM} unit="m" color="#34d399" />
                    <GoalRing label="Salidas" current={progress.currentWeek.rides} target={goals.weeklyRides} unit="" color="#60a5fa" />
                  </div>
                )}
              </section>

              <section className="rounded-3xl border border-emerald-500/20 bg-emerald-500/5 p-5">
                <p className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-emerald-400">
                  <BatteryCharging className="h-4 w-4" /> Tu motor
                </p>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">Consumo prudente</p>
                    <p className="mt-1 text-2xl font-black">
                      {batteryModel.conservativeWhPerKm.toFixed(1)}
                      <span className="ml-1 text-[10px] text-slate-500">Wh/km</span>
                    </p>
                  </div>
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">Autonomía segura</p>
                    <p className="mt-1 text-2xl font-black">
                      {fullBatteryPrediction.safeRangeKm.toFixed(0)}
                      <span className="ml-1 text-[10px] text-slate-500">km</span>
                    </p>
                  </div>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-slate-400">
                  {batteryModel.sampleCount > 0
                    ? `Modelo basado en ${batteryModel.sampleCount} ${batteryModel.sampleCount === 1 ? 'salida' : 'salidas'} y ${batteryModel.distanceKm.toFixed(0)} km. Autonomía con ${batteryCapacityWh} Wh y 15% de reserva.`
                    : 'Estimación inicial conservadora. Se personalizará al indicar la batería real al terminar tus salidas.'}
                </p>
                <Link href="/taller" className="mt-4 inline-flex text-xs font-black text-emerald-400 hover:text-emerald-300">
                  Abrir mantenimiento →
                </Link>
              </section>
            </aside>
          </div>
        )}

        {segmentBests.length > 0 && (
          <section className="mt-6">
            <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="flex items-center gap-2 font-black"><Flag className="h-5 w-5 text-amber-300" /> Récords por segmento</h2>
                <p className="mt-1 text-[10px] text-slate-500">Tu mejor paso por cada tramo reconocido</p>
              </div>
              <Link href="/segmentos" className="flex min-h-11 items-center rounded-xl border border-white/10 px-4 text-xs font-black text-slate-300">
                Ver todos
              </Link>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {segmentBests.slice(0, 4).map((best) => {
                const segment = getCompetitiveSegment(best.segmentId);
                if (!segment) return null;
                return (
                  <Link
                    key={`${best.segmentId}:${best.sportType}`}
                    href={`/segmentos/${best.segmentId}`}
                    className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 transition hover:border-amber-400/40"
                  >
                    <p className="truncate text-[10px] font-black uppercase tracking-widest text-amber-300">
                      {segment.name} · {best.sportType === 'ebike' ? 'E-bike' : 'MTB'}
                    </p>
                    <p className="mt-3 text-2xl font-black tabular-nums">{formatSegmentTime(best.effort.elapsedSeconds)}</p>
                    <p className="mt-1 text-[10px] text-slate-500">{best.attempts} {best.attempts === 1 ? 'intento' : 'intentos'} · {best.effort.averageSpeedKmh.toFixed(1)} km/h</p>
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        <section className="mt-6">
          <div className="mb-3 flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-orange-400" />
            <h2 className="font-black">Logros personales</h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {progress.achievements.map((item) => (
              <div key={item.id} className={`rounded-2xl border p-4 ${
                item.unlocked ? 'border-orange-500/25 bg-orange-500/5' : 'border-white/10 bg-slate-900/40'
              }`}>
                <div className="flex items-start gap-3">
                  <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${item.unlocked ? 'bg-orange-500 text-white' : 'bg-slate-800 text-slate-600'}`}>
                    {item.unlocked ? <Award className="h-5 w-5" /> : <Target className="h-5 w-5" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-black">{item.name}</p>
                    <p className="mt-1 text-xs text-slate-500">{item.description}</p>
                    <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-800">
                      <div className={`h-full rounded-full ${item.unlocked ? 'bg-orange-400' : 'bg-slate-600'}`} style={{ width: `${item.progress}%` }} />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {loaded && activities.length === 0 && (
          <section className="mt-6 rounded-3xl border border-dashed border-white/15 px-6 py-10 text-center">
            <Bike className="mx-auto h-8 w-8 text-orange-400" />
            <h2 className="mt-3 text-lg font-black">Tu primera semana empieza con una salida</h2>
            <p className="mt-2 text-sm text-slate-500">El panel se llenará automáticamente con tus actividades.</p>
            <Link href="/grabar" className="mt-5 inline-flex rounded-xl bg-orange-500 px-5 py-3 text-xs font-black uppercase">Grabar ahora</Link>
          </section>
        )}
      </div>
    </main>
  );
}
