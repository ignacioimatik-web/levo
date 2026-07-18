import {
  BatteryCharging, Bike, CalendarDays, Clock3, Gauge, Mountain, Route,
  Sparkles, TimerReset, UserRound, Zap,
} from 'lucide-react';
import ActivityElevationProfile from './ActivityElevationProfile';
import ActivityWeatherTimeline from './ActivityWeatherTimeline';
import ActivityMap from './ActivityMap';
import PublicActivityShareButton from './PublicActivityShareButton';
import type { PublicActivity } from '@/lib/activities/public';

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor(seconds % 3600 / 60);
  const remaining = seconds % 60;
  return hours > 0 ? `${hours} h ${minutes} min` : `${minutes} min ${remaining} s`;
}

function Stat({ icon: Icon, label, value, accent = false }: {
  icon: typeof Route;
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-4">
      <div className="flex items-center gap-2 text-slate-500">
        <Icon className={`h-4 w-4 ${accent ? 'text-orange-400' : ''}`} />
        <span className="text-[9px] font-black uppercase tracking-widest">{label}</span>
      </div>
      <p className="mt-2 text-xl font-black tabular-nums sm:text-2xl">{value}</p>
    </div>
  );
}

export default function PublicActivityView({ activity }: { activity: PublicActivity }) {
  const batteryUsed = activity.batteryStart != null && activity.batteryEnd != null
    ? Math.max(0, activity.batteryStart - activity.batteryEnd)
    : null;
  const whPerKm = activity.energyUsedWh != null && activity.distanceM > 0
    ? activity.energyUsedWh / (activity.distanceM / 1000)
    : null;
  const stoppedSeconds = Math.max(0, activity.durationSeconds - activity.movingSeconds);
  const summary = `${activity.title}: ${(activity.distanceM / 1000).toFixed(1)} km y ${Math.round(activity.elevationGainM)} m+`;

  return (
    <main className="min-h-screen bg-slate-950 pb-28 text-white md:pb-16">
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 md:py-10">
        <header className="mb-6 flex flex-wrap items-start justify-between gap-5">
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-orange-400">
              <Bike className="h-4 w-4" /> {activity.sportType === 'ebike' ? 'E-bike' : 'MTB'} · Actividad pública
            </p>
            <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">{activity.title}</h1>
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-400">
              <span className="flex items-center gap-1.5 font-bold text-slate-300">
                <UserRound className="h-4 w-4 text-orange-400" /> {activity.riderName}
              </span>
              <span className="flex items-center gap-1.5">
                <CalendarDays className="h-4 w-4" />
                {new Intl.DateTimeFormat('es-ES', { dateStyle: 'full', timeStyle: 'short' }).format(new Date(activity.startedAt))}
              </span>
              {activity.bikeName && <span>{activity.bikeName}</span>}
            </div>
          </div>
          <PublicActivityShareButton title={activity.title} summary={summary} />
        </header>

        <section className="mb-5 h-[360px] overflow-hidden rounded-3xl border border-white/10 sm:h-[500px]">
          <ActivityMap points={activity.points} />
        </section>

        <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <Stat icon={Route} label="Distancia" value={`${(activity.distanceM / 1000).toFixed(2)} km`} accent />
          <Stat icon={Clock3} label="Tiempo" value={formatDuration(activity.durationSeconds)} />
          <Stat icon={Gauge} label="Media" value={`${activity.averageSpeedKmh.toFixed(1)} km/h`} />
          <Stat icon={Zap} label="Máxima" value={`${activity.maxSpeedKmh.toFixed(1)} km/h`} />
          <Stat icon={Mountain} label="Desnivel +" value={`${Math.round(activity.elevationGainM)} m`} />
          <Stat icon={TimerReset} label="Parado" value={formatDuration(stoppedSeconds)} />
        </section>
        <ActivityWeatherTimeline samples={activity.weatherSamples} />

        <div className="mt-5 grid gap-5 lg:grid-cols-[1.25fr_.75fr]">
          <section className="overflow-hidden rounded-3xl border border-white/10 bg-slate-900/50">
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
              <div>
                <h2 className="font-black">Perfil de elevación</h2>
                <p className="mt-1 text-[10px] uppercase tracking-wider text-slate-500">{activity.points.length} puntos GPS</p>
              </div>
              <Mountain className="h-5 w-5 text-orange-400" />
            </div>
            <ActivityElevationProfile points={activity.points} />
          </section>

          <section className="rounded-3xl border border-emerald-500/20 bg-emerald-500/5 p-5">
            <p className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-emerald-400">
              <BatteryCharging className="h-4 w-4" /> Análisis e-bike
            </p>
            {activity.sportType === 'ebike' ? (
              <div className="mt-5 space-y-4">
                <div className="flex items-end justify-between gap-4">
                  <span className="text-sm text-slate-400">Batería</span>
                  <strong className="text-2xl">{activity.batteryStart ?? '—'}% → {activity.batteryEnd ?? '—'}%</strong>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-800">
                  <div className="h-full rounded-full bg-emerald-400" style={{ width: `${activity.batteryEnd ?? 0}%` }} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl bg-slate-950/60 p-3">
                    <p className="text-[9px] uppercase text-slate-500">Consumida</p>
                    <p className="mt-1 font-black">{batteryUsed == null ? '—' : `${batteryUsed}%`}</p>
                  </div>
                  <div className="rounded-xl bg-slate-950/60 p-3">
                    <p className="text-[9px] uppercase text-slate-500">Eficiencia</p>
                    <p className="mt-1 font-black">{whPerKm == null ? '—' : `${whPerKm.toFixed(1)} Wh/km`}</p>
                  </div>
                </div>
                <p className="flex items-start gap-2 text-xs leading-relaxed text-slate-400">
                  <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                  Modo {activity.assistMode || 'sin indicar'}{activity.batteryCapacityWh ? ` con batería de ${activity.batteryCapacityWh} Wh` : ''}.
                </p>
              </div>
            ) : (
              <p className="mt-5 text-sm text-slate-400">Actividad muscular, sin datos de batería.</p>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
