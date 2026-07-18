'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle, ChevronDown, CloudSun, Droplets, RefreshCw, Sunset, Wind,
} from 'lucide-react';
import type { RidePoint, RideWeatherSample, SportType } from '@/lib/activities/types';
import {
  deriveLiveRideConditions,
} from '@/lib/navigation/live-ride-conditions';
import type { PlannedRoutePoint } from '@/lib/navigation/types';
import type { RouteStatusPayload } from '@/lib/route-status';

type RoutePoint = RidePoint | PlannedRoutePoint;

function compactRoutePoints(points: RoutePoint[], maxPoints = 400): RoutePoint[] {
  if (points.length <= maxPoints) return points;
  return Array.from({ length: maxPoints }, (_, index) => (
    points[Math.round(index / (maxPoints - 1) * (points.length - 1))]
  ));
}

function windLabel(effect?: string): string {
  if (effect === 'headwind') return 'de cara';
  if (effect === 'tailwind') return 'a favor';
  if (effect === 'crosswind') return 'lateral';
  if (effect === 'calm') return 'calma';
  return 'variable';
}

function formatMinutes(minutes: number | null): string {
  if (minutes == null) return '—';
  const absolute = Math.abs(Math.round(minutes));
  const hours = Math.floor(absolute / 60);
  const rest = absolute % 60;
  const value = hours ? `${hours} h ${rest} min` : `${rest} min`;
  return minutes < 0 ? `-${value}` : value;
}

export default function LiveRideConditions({
  active,
  routeId,
  routeName,
  routePoints,
  completedM,
  remainingM,
  averageSpeedKmh,
  movingSeconds,
  sportType,
  onSample,
}: {
  active: boolean;
  routeId?: string;
  routeName?: string;
  routePoints: RoutePoint[];
  completedM: number;
  remainingM: number | null;
  averageSpeedKmh: number;
  movingSeconds: number;
  sportType: SportType;
  onSample?: (sample: RideWeatherSample) => void;
}) {
  const [payload, setPayload] = useState<RouteStatusPayload | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'offline' | 'error'>('idle');
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [pro, setPro] = useState(false);
  const latestInput = useRef({ routeId, routeName, routePoints });
  const lastFetchAt = useRef(0);
  const lastSampleKey = useRef('');
  const requestRef = useRef<AbortController | null>(null);

  useEffect(() => {
    latestInput.current = { routeId, routeName, routePoints };
  }, [routeId, routeName, routePoints]);

  const refresh = useCallback(async (force = false) => {
    const input = latestInput.current;
    if (!active || input.routePoints.length < 2) return;
    if (!force && Date.now() - lastFetchAt.current < 8 * 60_000) return;
    if (!navigator.onLine) {
      setStatus(payload ? 'offline' : 'error');
      return;
    }
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    setStatus('loading');
    try {
      const points = compactRoutePoints(input.routePoints);
      const response = await fetch('/api/route-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: input.routeId || 'ride-live',
          title: input.routeName || 'Salida en marcha',
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Madrid',
          points,
        }),
        signal: controller.signal,
      });
      const next = await response.json() as RouteStatusPayload & { error?: string };
      if (!response.ok || !next.ok) throw new Error(next.error || next.message || 'Meteo no disponible.');
      lastFetchAt.current = Date.now();
      setPayload(next);
      setUpdatedAt(new Date());
      setStatus('ready');
    } catch {
      if (controller.signal.aborted) return;
      setStatus(payload ? 'offline' : 'error');
    }
  }, [active, payload]);

  useEffect(() => {
    if (!active) return;
    const initial = window.setTimeout(() => { void refresh(); }, 1_000);
    const interval = window.setInterval(() => { void refresh(); }, 60_000);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(interval);
      requestRef.current?.abort();
    };
  }, [active, refresh]);

  const summary = useMemo(() => deriveLiveRideConditions({
    phases: payload?.ridePlan?.phases ?? [],
    daylight: payload?.daylight,
    completedM,
    remainingM,
    averageSpeedKmh,
    movingSeconds,
    sportType,
  }), [averageSpeedKmh, completedM, movingSeconds, payload, remainingM, sportType]);

  useEffect(() => {
    const phase = summary.phase;
    if (!phase || !updatedAt || !onSample) return;
    const key = `${updatedAt.getTime()}-${phase.id}`;
    if (lastSampleKey.current === key) return;
    lastSampleKey.current = key;
    onSample({
      sourceLabel: payload?.ridePlan?.sourceLabel,
      capturedAt: updatedAt.toISOString(),
      distanceM: Math.max(0, completedM),
      phaseId: phase.id,
      phaseFromKm: phase.fromKm,
      phaseToKm: phase.toKm,
      temperatureC: phase.temperatureC,
      humidityPct: phase.humidityPct,
      windKmh: phase.windKmh,
      maxWindKmh: phase.maxWindKmh,
      precipitationMm: phase.precipitationMm,
      windEffect: phase.windEffect,
      feelLabel: phase.feelLabel,
      confidence: phase.confidence,
      nearestStationKm: phase.nearestStationKm,
      stationCount: phase.stationCount,
      riskLevel: phase.riskLevel,
      lightMarginMinutes: summary.lightMarginMinutes,
    });
  }, [completedM, onSample, payload?.ridePlan?.sourceLabel, summary, updatedAt]);

  if (!active) return null;
  const phase = summary.phase;
  const riskClasses = summary.overallRisk === 'red'
    ? 'border-red-500/30 bg-red-500/10'
    : summary.overallRisk === 'yellow'
      ? 'border-amber-500/30 bg-amber-500/10'
      : 'border-cyan-500/25 bg-cyan-500/5';

  return (
    <section className={`rounded-2xl border p-4 ${riskClasses}`} aria-label="Condiciones en ruta">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-cyan-300">
            <CloudSun className="h-4 w-4" /> Condiciones en ruta
          </p>
          <p className="mt-1 text-xs text-slate-400">
            {status === 'loading' && !payload
              ? 'Consultando meteo por tramos…'
              : status === 'error' && !payload
                ? 'Sin datos ahora; la grabación y navegación continúan.'
                : status === 'offline'
                  ? 'Sin cobertura · conservando la última lectura.'
                  : payload?.ridePlan?.sourceLabel || 'Esperando trazado GPS suficiente.'}
          </p>
        </div>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => setPro((value) => !value)}
            className="min-h-11 rounded-xl border border-white/10 bg-slate-950/60 px-3 text-[10px] font-black uppercase text-slate-300"
            aria-expanded={pro}
          >
            {pro ? 'Basic' : 'Pro'} <ChevronDown className={`ml-1 inline h-3 w-3 transition-transform ${pro ? 'rotate-180' : ''}`} />
          </button>
          <button
            type="button"
            onClick={() => { void refresh(true); }}
            disabled={status === 'loading'}
            className="grid h-11 w-11 place-items-center rounded-xl border border-white/10 bg-slate-950/60 text-slate-300 disabled:opacity-40"
            aria-label="Actualizar condiciones"
          >
            <RefreshCw className={`h-4 w-4 ${status === 'loading' ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-xl bg-slate-950/45 p-2.5">
          <CloudSun className="mx-auto h-4 w-4 text-orange-300" />
          <p className="mt-1 text-lg font-black">{phase?.temperatureC != null ? `${phase.temperatureC.toFixed(0)}°` : '—'}</p>
          <p className="text-[8px] uppercase text-slate-500">Temperatura</p>
        </div>
        <div className="rounded-xl bg-slate-950/45 p-2.5">
          <Wind className="mx-auto h-4 w-4 text-cyan-300" />
          <p className="mt-1 text-lg font-black">{phase?.windKmh != null ? `${phase.windKmh.toFixed(0)}` : '—'} <span className="text-[9px] text-slate-500">km/h</span></p>
          <p className="text-[8px] uppercase text-slate-500">{windLabel(phase?.windEffect)}</p>
        </div>
        <div className={`rounded-xl p-2.5 ${summary.lightRisk === 'red' ? 'bg-red-500/15' : summary.lightRisk === 'yellow' ? 'bg-amber-500/15' : 'bg-slate-950/45'}`}>
          <Sunset className="mx-auto h-4 w-4 text-amber-300" />
          <p className="mt-1 text-lg font-black">{formatMinutes(summary.lightMarginMinutes ?? summary.minutesUntilSunset)}</p>
          <p className="text-[8px] uppercase text-slate-500">{summary.lightMarginMinutes == null ? 'Hasta ocaso' : 'Margen al llegar'}</p>
        </div>
      </div>

      <p className={`mt-3 flex items-start gap-2 text-xs font-bold ${
        summary.overallRisk === 'red' ? 'text-red-300' : summary.overallRisk === 'yellow' ? 'text-amber-300' : 'text-slate-300'
      }`}>
        {summary.overallRisk !== 'green' && <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />}
        {phase?.feelLabel ? `${phase.feelLabel}. ` : ''}{summary.recommendation}
      </p>

      {pro && (
        <div className="mt-3 grid grid-cols-2 gap-2 border-t border-white/10 pt-3 sm:grid-cols-4">
          <div className="rounded-lg bg-slate-950/40 p-2">
            <p className="flex items-center gap-1 text-[8px] uppercase text-slate-500"><Droplets className="h-3 w-3" /> Humedad</p>
            <p className="mt-1 text-sm font-black">{phase?.humidityPct != null ? `${phase.humidityPct}%` : '—'}</p>
          </div>
          <div className="rounded-lg bg-slate-950/40 p-2">
            <p className="text-[8px] uppercase text-slate-500">Ráfaga</p>
            <p className="mt-1 text-sm font-black">{phase?.maxWindKmh != null ? `${phase.maxWindKmh.toFixed(0)} km/h` : '—'}</p>
          </div>
          <div className="rounded-lg bg-slate-950/40 p-2">
            <p className="text-[8px] uppercase text-slate-500">Lluvia</p>
            <p className="mt-1 text-sm font-black">{phase?.precipitationMm != null ? `${phase.precipitationMm.toFixed(1)} mm` : '—'}</p>
          </div>
          <div className="rounded-lg bg-slate-950/40 p-2">
            <p className="text-[8px] uppercase text-slate-500">Confianza</p>
            <p className="mt-1 text-sm font-black capitalize">{phase?.confidence ?? '—'}</p>
          </div>
          <p className="col-span-2 text-[9px] leading-relaxed text-slate-500 sm:col-span-4">
            Tramo {phase ? `${phase.fromKm.toFixed(1)}–${phase.toKm.toFixed(1)} km` : 'sin localizar'}
            {phase?.nearestStationKm != null ? ` · estación más cercana a ${phase.nearestStationKm.toFixed(1)} km` : ''}
            {updatedAt ? ` · actualizado ${updatedAt.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}` : ''}
            {' · '}inferencia de estaciones, no sensor sobre la bicicleta.
          </p>
        </div>
      )}
    </section>
  );
}
