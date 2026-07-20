'use client';

import { useMemo, useState } from 'react';
import {
  Bike, Clock3, Droplets, Gauge, ShieldCheck, SunMedium, Thermometer,
  Wind,
} from 'lucide-react';
import type { RouteStatusPayload } from '@/lib/route-status';

export type RideBriefingMode = 'trail' | 'enduro' | 'ebike';
export type RideBriefingView = 'basic' | 'pro';

function clockMinutes(value: string): number | null {
  const match = value.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

function formatClock(totalMinutes: number): string {
  const normalized = ((Math.round(totalMinutes) % 1440) + 1440) % 1440;
  return `${String(Math.floor(normalized / 60)).padStart(2, '0')}:${String(normalized % 60).padStart(2, '0')}`;
}

function confidenceLabel(value: 'high' | 'medium' | 'low'): string {
  return value === 'high' ? 'Alta' : value === 'medium' ? 'Media' : 'Baja';
}

function weatherAgeLabel(minutes: number | null | undefined): string | null {
  if (minutes == null) return null;
  if (minutes < 60) return `${Math.round(minutes)} min`;
  const hours = Math.floor(minutes / 60);
  const rest = Math.round(minutes % 60);
  return `${hours} h${rest ? ` ${rest} min` : ''}`;
}

function windLabel(effect: string): string {
  if (effect === 'headwind') return 'de cara';
  if (effect === 'tailwind') return 'a favor';
  if (effect === 'crosswind') return 'lateral';
  if (effect === 'calm') return 'calma';
  return 'variable';
}

function maxRisk(phases: NonNullable<RouteStatusPayload['ridePlan']>['phases']) {
  if (phases.some((phase) => phase.riskLevel === 'red')) return 'red' as const;
  if (phases.some((phase) => phase.riskLevel === 'yellow')) return 'yellow' as const;
  return 'green' as const;
}

function WeatherChart({
  phases,
  hasWeather,
}: {
  phases: NonNullable<RouteStatusPayload['ridePlan']>['phases'];
  hasWeather: boolean;
}) {
  if (phases.length === 0) return null;
  const width = 620;
  const height = 150;
  const padX = 28;
  const temps = phases.map((phase) => phase.temperatureC).filter((value): value is number => value != null);
  const winds = phases.map((phase) => phase.maxWindKmh ?? phase.windKmh).filter((value): value is number => value != null);
  const minTemp = temps.length > 0 ? Math.min(...temps) - 1 : 0;
  const maxTemp = temps.length > 0 ? Math.max(...temps) + 1 : 1;
  const maxWind = Math.max(...winds, 10);
  const x = (index: number) => padX + index / Math.max(1, phases.length - 1) * (width - padX * 2);
  const tempY = (value: number) => 105 - (value - minTemp) / Math.max(1, maxTemp - minTemp) * 65;
  const tempPoints = phases
    .map((phase, index) => phase.temperatureC == null ? null : `${x(index)},${tempY(phase.temperatureC)}`)
    .filter(Boolean)
    .join(' ');

  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-slate-950/65 p-3">
      <div className="mb-2 flex items-center justify-between gap-3 text-[9px] font-black uppercase tracking-widest text-slate-500">
        <span>Ruta → temperatura y viento</span>
        <span className="flex gap-3"><i className="text-orange-300 not-italic">● °C</i><i className="text-blue-300 not-italic">▮ km/h</i></span>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full touch-pan-y" role="img" aria-label="Evolución inferida de temperatura y viento a lo largo de la ruta">
        {[40, 72, 105].map((gridY) => (
          <line key={gridY} x1={padX} y1={gridY} x2={width - padX} y2={gridY} stroke="#334155" strokeDasharray="4 5" />
        ))}
        {phases.map((phase, index) => {
          const wind = phase.maxWindKmh ?? phase.windKmh ?? 0;
          const barHeight = wind / maxWind * 62;
          const phaseWidth = (width - padX * 2) / phases.length;
          const color = !hasWeather
            ? '#475569'
            : phase.riskLevel === 'red'
              ? '#ef4444'
              : phase.riskLevel === 'yellow'
                ? '#f59e0b'
                : '#10b981';
          return (
            <g key={phase.id}>
              <rect x={x(index) - 7} y={108 - barHeight} width="14" height={barHeight} rx="4" fill="#60a5fa" opacity=".55" />
              <rect x={padX + index * phaseWidth} y="121" width={Math.max(2, phaseWidth - 2)} height="9" rx="3" fill={color} opacity=".75" />
              <text x={x(index) - 13} y="145" fill="#64748b" fontSize="9">{phase.centerKm}k</text>
            </g>
          );
        })}
        {tempPoints && <polyline points={tempPoints} fill="none" stroke="#fb923c" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />}
        {phases.map((phase, index) => phase.temperatureC == null ? null : (
          <circle key={`temp-${phase.id}`} cx={x(index)} cy={tempY(phase.temperatureC)} r="4" fill="#fb923c" stroke="#0f172a" strokeWidth="2" />
        ))}
      </svg>
    </div>
  );
}

export default function RouteRideBriefing({
  data,
  now,
  etaFactor,
  bikeMode,
  onBikeModeChange,
  view,
  onViewChange,
}: {
  data: RouteStatusPayload;
  now: Date;
  etaFactor: number;
  bikeMode: RideBriefingMode;
  onBikeModeChange: (mode: RideBriefingMode) => void;
  view: RideBriefingView;
  onViewChange: (view: RideBriefingView) => void;
}) {
  const [customDeparture, setCustomDeparture] = useState('');
  const phases = data.ridePlan?.phases ?? [];
  const usesWeatherModel = data.weatherNow
    && 'source' in data.weatherNow
    && data.weatherNow.source === 'open-meteo-model';
  const hasWeather = phases.some((phase) => (
    phase.temperatureC != null
    || phase.humidityPct != null
    || phase.windKmh != null
    || phase.maxWindKmh != null
    || phase.precipitationMm != null
  ));
  const currentClock = now.getTime() > 0
    ? now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
    : '08:00';
  const departure = customDeparture || currentClock;
  const etaMinutes = useMemo(() => {
    const segments = data.profile?.segments ?? [];
    const base = segments.reduce((sum, segment) => {
      if (!('etaMinutes' in segment) || !segment.etaMinutes) return sum;
      const values = segment.etaMinutes as Record<RideBriefingMode, number>;
      return sum + (values[bikeMode] ?? 0);
    }, 0);
    if (base > 0) return Math.round(base * etaFactor);
    const speed = bikeMode === 'ebike' ? 16 : bikeMode === 'enduro' ? 12 : 13;
    return Math.round((data.profile?.distanceKm ?? 0) / speed * 60 * etaFactor);
  }, [bikeMode, data.profile, etaFactor]);
  const departureMinutes = clockMinutes(departure) ?? 0;
  const finishMinutes = departureMinutes + etaMinutes;
  const sunsetMinutes = data.daylight && !data.daylight.isPolarDay && !data.daylight.isPolarNight
    ? clockMinutes(data.daylight.sunset)
    : null;
  const lightMarginMinutes = sunsetMinutes == null ? null : sunsetMinutes - finishMinutes;
  const lightState = lightMarginMinutes == null
    ? 'unknown'
    : lightMarginMinutes >= 30
      ? 'safe'
      : lightMarginMinutes >= 0
        ? 'tight'
        : 'dark';
  const phaseRisk = maxRisk(phases);
  const weatherStale = data.ridePlan?.dataIsStale === true
    || (data.ridePlan?.dataAgeMin ?? 0) > 120;
  const routeRisk = weatherStale && phaseRisk === 'green' ? 'yellow' : phaseRisk;
  const weatherAge = weatherAgeLabel(data.ridePlan?.dataAgeMin);
  const criticalPhase = [...phases].sort((a, b) => {
    const risk = { red: 3, yellow: 2, green: 1 };
    const riskDifference = risk[b.riskLevel] - risk[a.riskLevel];
    if (riskDifference !== 0) return riskDifference;
    return (b.maxWindKmh ?? b.windKmh ?? 0) - (a.maxWindKmh ?? a.windKmh ?? 0);
  })[0];
  const firstPhase = phases[0];
  const riskClasses = !hasWeather
    ? 'border-slate-500/25 bg-slate-500/10 text-slate-100'
    : routeRisk === 'red'
    ? 'border-red-500/30 bg-red-500/10 text-red-100'
    : routeRisk === 'yellow'
      ? 'border-amber-500/30 bg-amber-500/10 text-amber-100'
      : 'border-emerald-500/25 bg-emerald-500/10 text-emerald-100';

  return (
    <section className="rounded-3xl border border-white/10 bg-slate-900/70 p-4 sm:p-5 xl:p-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-orange-400">
            <ShieldCheck className="h-4 w-4" /> Ride briefing
          </p>
          <h3 className="mt-1 text-xl font-black sm:text-2xl">Ruta, meteo, ritmo y luz</h3>
          <p className="mt-1 max-w-2xl text-xs leading-relaxed text-slate-400">
            {data.ridePlan?.sourceLabel ?? 'Meteo inferida por tramo'}. No es un sensor situado sobre el sendero.
            {weatherAge ? ` Antigüedad de la observación: ${weatherAge}.` : ''}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex">
          <div className="grid grid-cols-2 rounded-xl bg-slate-950 p-1">
            {(['basic', 'pro'] as RideBriefingView[]).map((option) => (
              <button key={option} type="button" aria-pressed={view === option} onClick={() => onViewChange(option)}
                className={`min-h-11 rounded-lg px-4 text-xs font-black uppercase ${view === option ? 'bg-white text-slate-950' : 'text-slate-500'}`}>
                {option === 'basic' ? 'Basic' : 'Pro'}
              </button>
            ))}
          </div>
          <label className="flex min-h-11 items-center gap-2 rounded-xl border border-white/10 bg-slate-950 px-3 text-[10px] font-black uppercase text-slate-500">
            Salida
            <input type="time" value={departure} onChange={(event) => setCustomDeparture(event.target.value)}
              className="min-w-0 bg-transparent text-sm font-black text-white outline-none" />
          </label>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2 rounded-xl bg-slate-950 p-1">
        {(['trail', 'enduro', 'ebike'] as RideBriefingMode[]).map((mode) => (
          <button key={mode} type="button" aria-pressed={bikeMode === mode} onClick={() => onBikeModeChange(mode)}
            className={`flex min-h-11 items-center justify-center gap-1.5 rounded-lg text-[10px] font-black uppercase ${bikeMode === mode ? 'bg-orange-500 text-white' : 'text-slate-500'}`}>
            <Bike className="h-3.5 w-3.5" /> {mode}
          </button>
        ))}
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-[minmax(0,1.15fr)_minmax(280px,.85fr)]">
        <div className="space-y-4">
          <div className={`rounded-2xl border p-4 ${riskClasses}`}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[9px] font-black uppercase tracking-widest opacity-70">Decisión rápida</p>
                <p className="mt-1 text-lg font-black">
                  {!hasWeather
                    ? 'Meteo no disponible'
                    : routeRisk === 'red'
                      ? 'Condiciones comprometidas'
                      : weatherStale
                        ? 'Datos antiguos: verifica'
                      : routeRisk === 'yellow'
                        ? 'Sal con precaución'
                        : 'Ventana favorable'}
                </p>
              </div>
              <span className="rounded-full bg-slate-950/35 px-2.5 py-1 text-[9px] font-black uppercase">
                Confianza {confidenceLabel(data.ridePlan?.overallConfidence ?? 'low')}
              </span>
            </div>
            <p className="mt-2 text-xs opacity-85">
              Llegada estimada {formatClock(finishMinutes)} · {etaMinutes} min · {lightState === 'safe'
                ? `${lightMarginMinutes} min de luz de margen`
                : lightState === 'tight'
                  ? `solo ${lightMarginMinutes} min antes del ocaso`
                  : lightState === 'dark'
                    ? `${Math.abs(lightMarginMinutes ?? 0)} min después del ocaso`
                    : 'margen solar no disponible'}
            </p>
          </div>
          <WeatherChart phases={phases} hasWeather={hasWeather} />
        </div>

        <div className="grid grid-cols-2 gap-2 content-start">
          <div className="rounded-2xl border border-white/10 bg-slate-950/65 p-3">
            <p className="flex items-center gap-1.5 text-[9px] uppercase text-slate-500"><Thermometer className="h-3.5 w-3.5" /> Temperatura</p>
            <p className="mt-1 text-xl font-black">{firstPhase?.temperatureC?.toFixed(0) ?? '—'}°</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-slate-950/65 p-3">
            <p className="flex items-center gap-1.5 text-[9px] uppercase text-slate-500"><Droplets className="h-3.5 w-3.5" /> Humedad</p>
            <p className="mt-1 text-xl font-black">{firstPhase?.humidityPct ?? '—'}%</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-slate-950/65 p-3">
            <p className="flex items-center gap-1.5 text-[9px] uppercase text-slate-500"><Wind className="h-3.5 w-3.5" /> Viento</p>
            <p className="mt-1 text-xl font-black">{firstPhase?.maxWindKmh?.toFixed(0) ?? firstPhase?.windKmh?.toFixed(0) ?? '—'} <small className="text-[9px] text-slate-600">km/h</small></p>
            <p className="mt-1 text-[9px] text-slate-500">{windLabel(firstPhase?.windEffect ?? 'unknown')}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-slate-950/65 p-3">
            <p className="flex items-center gap-1.5 text-[9px] uppercase text-slate-500"><SunMedium className="h-3.5 w-3.5" /> Ocaso</p>
            <p className="mt-1 text-xl font-black">{data.daylight?.sunset ?? '—'}</p>
          </div>
          <div className="col-span-2 rounded-2xl border border-white/10 bg-slate-950/65 p-3">
            <p className="flex items-center gap-1.5 text-[9px] uppercase text-slate-500"><Gauge className="h-3.5 w-3.5" /> Tramo más sensible</p>
            <p className="mt-1 text-sm font-black">{hasWeather && criticalPhase ? `km ${criticalPhase.fromKm}–${criticalPhase.toKm}` : 'Sin inferencia'}</p>
            <p className="mt-1 text-[10px] leading-relaxed text-slate-400">
              {hasWeather && criticalPhase
                ? criticalPhase.feelLabel
                : 'No hay una fuente meteorológica disponible para este trazado.'}
            </p>
          </div>
        </div>
      </div>

      {view === 'pro' && phases.length > 0 && (
        <div className="mt-4 flex snap-x gap-3 overflow-x-auto pb-2 md:grid md:grid-cols-2 md:overflow-visible xl:grid-cols-3">
          {phases.map((phase) => {
            const arrival = departureMinutes + etaMinutes * phase.centerKm / Math.max(0.1, data.profile?.distanceKm ?? 1);
            return (
              <article key={phase.id} className="min-w-[78%] snap-center rounded-2xl border border-white/10 bg-slate-950/65 p-4 md:min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-black">km {phase.fromKm}–{phase.toKm}</p>
                  <span className="flex items-center gap-1 text-[9px] font-black uppercase text-slate-500"><Clock3 className="h-3 w-3" /> {formatClock(arrival)}</span>
                </div>
                <p className="mt-2 text-xs text-slate-300">{phase.feelLabel}</p>
                <div className="mt-3 grid grid-cols-3 gap-2 text-[10px]">
                  <span>{phase.temperatureC?.toFixed(0) ?? '—'}°C</span>
                  <span>{phase.humidityPct ?? '—'}%</span>
                  <span>{phase.maxWindKmh?.toFixed(0) ?? phase.windKmh?.toFixed(0) ?? '—'} km/h</span>
                </div>
                <p className="mt-2 text-[9px] text-slate-600">
                  {windLabel(phase.windEffect)} · {usesWeatherModel ? 'punto de modelo' : `estación a ${phase.nearestStationKm ?? '—'} km`} · confianza {confidenceLabel(phase.confidence).toLowerCase()}
                </p>
              </article>
            );
          })}
        </div>
      )}

      <p className="mt-3 text-[9px] leading-relaxed text-slate-600">
        {data.ridePlan?.sourceLabel ?? 'Sin fuente meteorológica'} · La evolución por tramo es una estimación espacial actual; no una predicción de la hora futura de paso.
        {weatherStale ? ' La observación supera dos horas y no debe tratarse como tiempo real.' : ''}
      </p>
    </section>
  );
}
