'use client';

import { useEffect, useMemo, useState } from 'react';
import type { KeyboardEventHandler, MouseEventHandler, ReactNode } from 'react';
import { CloudRain, Mountain, Wind, AlertTriangle, Gauge, ChevronDown } from 'lucide-react';
import type { RouteStatusPayload } from '@/lib/route-status';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useRouter } from 'next/navigation';

function hasEtaMinutes(segment: unknown): segment is { etaMinutes: { trail: number; enduro: number; ebike: number } } {
  if (!segment || typeof segment !== 'object') return false;
  const s = segment as { etaMinutes?: { trail?: number; enduro?: number; ebike?: number } };
  return !!s.etaMinutes && typeof s.etaMinutes.trail === 'number' && typeof s.etaMinutes.enduro === 'number' && typeof s.etaMinutes.ebike === 'number';
}

function hasRisk(segment: unknown): segment is { risk: { level: 'low' | 'medium' | 'high'; reason: string } } {
  if (!segment || typeof segment !== 'object') return false;
  const s = segment as { risk?: { level?: string; reason?: string } };
  return !!s.risk && typeof s.risk.reason === 'string' && (s.risk.level === 'low' || s.risk.level === 'medium' || s.risk.level === 'high');
}

function weatherEtaFactor(weather: RouteStatusPayload['weatherNow']): number {
  if (!weather || !('riskLevel' in weather)) return 1;
  let factor = 1;
  if (weather.riskLevel === 'yellow') factor += 0.15;
  if (weather.riskLevel === 'red') factor += 0.35;
  const rain = weather.precipitationMm ?? 0;
  const wind = weather.maxWindKmh ?? weather.windKmh ?? 0;
  if (rain > 0) factor += Math.min(0.2, rain * 0.04);
  if (wind >= 20) factor += Math.min(0.2, (wind - 20) * 0.01);
  return Math.min(1.8, factor);
}

type BikeMode = 'trail' | 'enduro' | 'ebike';
type TempSourceMode = 'nearest' | 'estimated';

export default function TrailNowInsights({
  slug,
  activeOverlayTypes,
}: {
  slug: string;
  activeOverlayTypes: { climb: boolean; descent: boolean; flat: boolean };
}) {
  const [data, setData] = useState<RouteStatusPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [bikeMode, setBikeMode] = useState<BikeMode>('trail');
  const [tempSource, setTempSource] = useState<TempSourceMode>('estimated');
  const [riskOpen, setRiskOpen] = useState(false);
  const sp = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Madrid';
    setLoading(true);
    fetch(`/api/forfait/route-status/${slug}?tz=${encodeURIComponent(tz)}`)
      .then((r) => r.json())
      .then((json) => setData(json))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [slug]);

  const weather = data?.weatherNow && 'riskLevel' in data.weatherNow ? data.weatherNow : null;
  const nearestTemp = weather?.temperatureC;
  const estimatedTemp = weather?.weightedRouteTempC;
  const shownTemp = tempSource === 'estimated' && estimatedTemp !== undefined ? estimatedTemp : nearestTemp;
  const riskClass = useMemo(() => {
    if (!weather) return 'text-slate-400 border-slate-700 bg-slate-800/40';
    if (weather.riskLevel === 'red') return 'text-red-300 border-red-500/40 bg-red-500/10';
    if (weather.riskLevel === 'yellow') return 'text-amber-300 border-amber-500/40 bg-amber-500/10';
    return 'text-green-300 border-green-500/40 bg-green-500/10';
  }, [weather]);
  const etaFactor = useMemo(() => weatherEtaFactor(data?.weatherNow), [data?.weatherNow]);

  const baseParams = useMemo(() => {
    const p = new URLSearchParams(sp.toString());
    p.delete('show');
    p.delete('segStart');
    p.delete('segEnd');
    return p;
  }, [sp]);

  const buildShowHref = (type: 'climb' | 'descent' | 'flat') => {
    const next = { ...activeOverlayTypes, [type]: !activeOverlayTypes[type] };
    const show = ['climb', 'descent', 'flat'].filter((t) => next[t as keyof typeof next]);
    const p = new URLSearchParams(baseParams.toString());
    p.set('show', show.join(','));
    return `/forfait/${slug}?${p.toString()}#trail-map`;
  };

  const buildCenterHref = (startKm: number, endKm: number) => {
    const p = new URLSearchParams(baseParams.toString());
    const show = ['climb', 'descent', 'flat'].filter((t) => activeOverlayTypes[t as keyof typeof activeOverlayTypes]);
    p.set('show', show.join(','));
    p.set('segStart', String(startKm));
    p.set('segEnd', String(endKm));
    return `/forfait/${slug}?${p.toString()}#trail-map`;
  };

  const savePreset = () => {
    const payload = {
      bikeMode,
      overlays: activeOverlayTypes,
      savedAt: new Date().toISOString(),
    };
    localStorage.setItem(`forfait-preset-${slug}`, JSON.stringify(payload));
  };

  const saveGlobalPreset = () => {
    const payload = {
      bikeMode,
      overlays: activeOverlayTypes,
      scope: 'global',
      savedAt: new Date().toISOString(),
    };
    localStorage.setItem('forfait-preset-global', JSON.stringify(payload));
  };

  const loadPreset = () => {
    const raw = localStorage.getItem(`forfait-preset-${slug}`);
    if (!raw) return;
    try {
      const p = JSON.parse(raw) as {
        bikeMode?: BikeMode;
        overlays?: { climb?: boolean; descent?: boolean; flat?: boolean };
      };
      if (p.bikeMode) setBikeMode(p.bikeMode);
      if (p.overlays) {
        const show = ['climb', 'descent', 'flat'].filter((k) => p.overlays?.[k as 'climb' | 'descent' | 'flat']);
        const qs = new URLSearchParams(sp.toString());
        qs.set('show', show.length ? show.join(',') : 'climb,descent,flat');
        router.push(`/forfait/${slug}?${qs.toString()}#trail-map`);
      }
    } catch {
      // ignore invalid preset
    }
  };

  const loadGlobalPreset = () => {
    const raw = localStorage.getItem('forfait-preset-global');
    if (!raw) return;
    try {
      const p = JSON.parse(raw) as {
        bikeMode?: BikeMode;
        overlays?: { climb?: boolean; descent?: boolean; flat?: boolean };
      };
      if (p.bikeMode) setBikeMode(p.bikeMode);
      if (p.overlays) {
        const show = ['climb', 'descent', 'flat'].filter((k) => p.overlays?.[k as 'climb' | 'descent' | 'flat']);
        const qs = new URLSearchParams(sp.toString());
        qs.set('show', show.length ? show.join(',') : 'climb,descent,flat');
        router.push(`/forfait/${slug}?${qs.toString()}#trail-map`);
      }
    } catch {
      // ignore invalid global preset
    }
  };

  if (loading) {
    return <div className="text-sm text-slate-500">Analizando track y meteo actual...</div>;
  }

  if (!data?.ok || !data.profile) {
    return <div className="text-sm text-slate-500">Sin datos de perfil avanzado para este sendero.</div>;
  }

  return (
    <div className="space-y-6">
      <div className="no-print flex flex-wrap items-center gap-2">
        <span className="text-xs uppercase tracking-wider text-slate-500 font-bold">Modo bici</span>
        {(['trail', 'enduro', 'ebike'] as BikeMode[]).map((mode) => (
          <button
            key={mode}
            onClick={() => setBikeMode(mode)}
            className={`px-3 py-1.5 rounded-md text-xs font-bold uppercase tracking-wider border transition-colors ${
              bikeMode === mode
                ? 'bg-orange-500/20 border-orange-500/40 text-orange-300'
                : 'bg-slate-900 border-white/10 text-slate-400 hover:text-slate-200'
            }`}
          >
            {mode}
          </button>
        ))}
        <span className="text-xs uppercase tracking-wider text-slate-500 font-bold ml-2">Temp</span>
        <button
          onClick={() => setTempSource('nearest')}
          className={`px-3 py-1.5 rounded-md text-xs font-bold uppercase tracking-wider border transition-colors ${
            tempSource === 'nearest'
              ? 'bg-sky-500/20 border-sky-500/40 text-sky-300'
              : 'bg-slate-900 border-white/10 text-slate-400 hover:text-slate-200'
          }`}
        >
          Estacion cercana
        </button>
        <button
          onClick={() => setTempSource('estimated')}
          className={`px-3 py-1.5 rounded-md text-xs font-bold uppercase tracking-wider border transition-colors ${
            tempSource === 'estimated'
              ? 'bg-sky-500/20 border-sky-500/40 text-sky-300'
              : 'bg-slate-900 border-white/10 text-slate-400 hover:text-slate-200'
          }`}
        >
          Temp ruta est.
        </button>
        <button
          onClick={() => window.print()}
          className="ml-auto px-3 py-1.5 rounded-md text-xs font-bold uppercase tracking-wider border bg-slate-900 border-white/10 text-slate-300 hover:bg-slate-800"
        >
          Exportar informe (PDF)
        </button>
        <button
          onClick={savePreset}
          className="px-3 py-1.5 rounded-md text-xs font-bold uppercase tracking-wider border bg-slate-900 border-white/10 text-slate-300 hover:bg-slate-800"
        >
          Guardar preset ruta
        </button>
        <button
          onClick={loadPreset}
          className="px-3 py-1.5 rounded-md text-xs font-bold uppercase tracking-wider border bg-slate-900 border-white/10 text-slate-300 hover:bg-slate-800"
        >
          Cargar preset ruta
        </button>
        <button
          onClick={saveGlobalPreset}
          className="px-3 py-1.5 rounded-md text-xs font-bold uppercase tracking-wider border bg-slate-900 border-white/10 text-slate-300 hover:bg-slate-800"
        >
          Guardar preset global
        </button>
        <button
          onClick={loadGlobalPreset}
          className="px-3 py-1.5 rounded-md text-xs font-bold uppercase tracking-wider border bg-slate-900 border-white/10 text-slate-300 hover:bg-slate-800"
        >
          Cargar preset global
        </button>
        <a
          href={`/api/forfait/route-status/${slug}/segmented-gpx`}
          className="px-3 py-1.5 rounded-md text-xs font-bold uppercase tracking-wider border bg-orange-500/20 border-orange-500/30 text-orange-300 hover:bg-orange-500/30"
        >
          GPX segmentado
        </a>
      </div>

      <div className="no-print bg-slate-900/60 border border-white/5 rounded-xl p-4">
        <h3 className="text-white font-bold mb-3">Leyenda de segmentos en mapa</h3>
        <div className="flex flex-wrap gap-2">
          <Link href={buildShowHref('climb')} className={`px-3 py-1.5 rounded-md text-xs font-bold uppercase tracking-wider border ${activeOverlayTypes.climb ? 'bg-green-500/15 border-green-500/40 text-green-300' : 'bg-slate-800 border-white/10 text-slate-500'}`}>
            Subidas
          </Link>
          <Link href={buildShowHref('descent')} className={`px-3 py-1.5 rounded-md text-xs font-bold uppercase tracking-wider border ${activeOverlayTypes.descent ? 'bg-red-500/15 border-red-500/40 text-red-300' : 'bg-slate-800 border-white/10 text-slate-500'}`}>
            Bajadas
          </Link>
          <Link href={buildShowHref('flat')} className={`px-3 py-1.5 rounded-md text-xs font-bold uppercase tracking-wider border ${activeOverlayTypes.flat ? 'bg-amber-500/15 border-amber-500/40 text-amber-300' : 'bg-slate-800 border-white/10 text-slate-500'}`}>
            Transicion
          </Link>
        </div>
      </div>

      <div className={`rounded-xl border px-4 py-3 ${riskClass}`}>
        <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider">
          <AlertTriangle className="w-4 h-4" />
          Estado de la ruta ahora
        </div>
        <p className="mt-2 text-sm font-semibold">{weather?.routeNowLabel ?? 'Sin conexion meteo en este momento'}</p>
        <p className="text-xs mt-1 opacity-90">{weather?.routeNowMessage ?? 'Configura AEMET_API_KEY para activar telemetria en vivo.'}</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-slate-900/70 border border-white/5 rounded-xl p-3">
          <p className="text-[11px] text-slate-500">Distancia real</p>
          <p className="text-white font-bold">{data.profile.distanceKm} km</p>
        </div>
        <div className="bg-slate-900/70 border border-white/5 rounded-xl p-3">
          <p className="text-[11px] text-slate-500">Desnivel +</p>
          <p className="text-green-400 font-bold">+{data.profile.gainM} m</p>
          <p className="text-[11px] text-slate-500 mt-0.5">{((data.profile.gainM / (data.profile.distanceKm * 1000)) * 100).toFixed(1)}% medio</p>
        </div>
        <div className="bg-slate-900/70 border border-white/5 rounded-xl p-3">
          <p className="text-[11px] text-slate-500">Altitud max</p>
          <p className="text-white font-bold">{data.profile.maxAltitudeM} m</p>
          {shownTemp !== undefined && (
            <p className="text-[11px] text-slate-500 mt-0.5">
              {tempSource === 'estimated' ? 'Temp ruta est.' : 'Temp estacion'}: {shownTemp} C
            </p>
          )}
        </div>
        <div className="bg-slate-900/70 border border-white/5 rounded-xl p-3">
          <p className="text-[11px] text-slate-500">Desnivel -</p>
          <p className="text-red-400 font-bold">-{data.profile.lossM} m</p>
          <p className="text-[11px] text-slate-500 mt-0.5">{((data.profile.lossM / (data.profile.distanceKm * 1000)) * 100).toFixed(1)}% medio</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-2 gap-3">
        <div className="bg-slate-900/70 border border-white/5 rounded-xl p-3">
          <p className="text-[11px] text-slate-500">Pendiente pico subida</p>
          <p className="text-orange-400 font-bold">+{data.profile.steepestClimbPct}%</p>
        </div>
        <div className="bg-slate-900/70 border border-white/5 rounded-xl p-3">
          <p className="text-[11px] text-slate-500">Pendiente pico bajada</p>
          <p className="text-orange-400 font-bold">{data.profile.steepestDescentPct}%</p>
        </div>
      </div>

      <ContinuousProfile series={data.profile.profileSeries ?? []} slug={slug} />

      {weather && (
        <div className="bg-slate-900/55 border border-white/10 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h4 className="text-xs uppercase tracking-wider text-slate-300 font-bold">Panel meteo en vivo</h4>
            <span className={`text-[11px] px-2 py-1 rounded border ${weather.dataIsStale ? 'bg-amber-500/10 border-amber-500/30 text-amber-300' : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'}`}>
              {weather.dataIsStale ? 'Dato no reciente' : 'Dato reciente'}
            </span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
            <Metric icon={<Mountain className="w-4 h-4" />} label="Estacion ref." value={`${weather.stationName} (${weather.stationDistanceKm} km)`} />
            <Metric icon={<CloudRain className="w-4 h-4" />} label="Lluvia" value={`${weather.precipitationMm ?? 0} mm`} />
            <Metric icon={<Wind className="w-4 h-4" />} label="Viento" value={`${weather.maxWindKmh ?? weather.windKmh ?? 0} km/h`} />
            <Metric icon={<Gauge className="w-4 h-4" />} label={tempSource === 'estimated' ? 'Temp ruta est.' : 'Temp estacion'} value={`${shownTemp ?? '--'} C`} />
            <Metric icon={<Gauge className="w-4 h-4" />} label="Humedad" value={`${weather.humidityPct ?? '--'} %`} />
          </div>

          <div className="flex flex-wrap items-center gap-2 text-[11px]">
            <span className="px-2.5 py-1 rounded bg-slate-950/60 border border-white/10 text-slate-300">
              Ultima obs.: {weather.updatedAt ?? 'sin hora'}{typeof weather.dataAgeMin === 'number' ? ` · hace ${weather.dataAgeMin} min` : ''}
            </span>
            {weather.temperatureRangeC && (
              <span className="px-2.5 py-1 rounded bg-slate-950/60 border border-white/10 text-slate-300">
                Rango termico cercano: {weather.temperatureRangeC.min.toFixed(1)} C - {weather.temperatureRangeC.max.toFixed(1)} C
              </span>
            )}
          </div>

          {weather.nearbyStations && weather.nearbyStations.length > 0 && (
            <div className="rounded-lg border border-white/5 overflow-hidden">
              <div className="grid grid-cols-12 gap-2 px-3 py-2 bg-slate-950/60 text-[10px] uppercase tracking-wider text-slate-500 font-bold">
                <span className="col-span-5">Estacion</span>
                <span className="col-span-2">Dist.</span>
                <span className="col-span-2">Temp</span>
                <span className="col-span-2">Alt</span>
                <span className="col-span-1">Ref</span>
              </div>
              {weather.nearbyStations.map((s, i) => (
                <div key={s.stationCode} className="grid grid-cols-12 gap-2 px-3 py-2 text-[11px] border-t border-white/5">
                  <span className="col-span-5 text-slate-300 truncate flex items-center gap-1.5" title={s.stationName}>
                    <span className="truncate">{s.stationName}</span>
                    {s.stationCode === weather.stationCode && (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded border border-orange-500/40 bg-orange-500/15 text-orange-300 text-[9px] font-bold uppercase tracking-wider">
                        Base
                      </span>
                    )}
                  </span>
                  <span className="col-span-2 text-slate-500">{s.distanceKm} km</span>
                  <span className="col-span-2 text-slate-100 font-semibold">{s.temperatureC ?? '--'} C</span>
                  <span className="col-span-2 text-slate-500">{s.altitudeM ?? '--'} m</span>
                  <span className="col-span-1 text-slate-500">{i + 1}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div>
        <h3 className="text-white font-bold mb-3">Segmentos relevantes del track</h3>
        <div className="space-y-2">
          {data.profile.segments.slice(0, 10).map((s) => (
            <div key={s.id} className="bg-slate-900/50 border border-white/5 rounded-lg p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm text-white font-semibold">{s.label}</p>
                <span className="text-[10px] uppercase tracking-wider text-slate-400">km {s.startKm}-{s.endKm}</span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                {s.type === 'climb' ? 'Subida' : s.type === 'descent' ? 'Bajada' : 'Transicion'} · {s.distanceKm} km · {s.elevationDeltaM > 0 ? '+' : ''}{s.elevationDeltaM} m · {s.avgSlopePct}% media
              </p>
              {hasEtaMinutes(s) && (
                <p className="text-[11px] text-slate-500 mt-1">
                  ETA {bikeMode.toUpperCase()}: {Math.round(s.etaMinutes[bikeMode] * etaFactor)} min
                  <span className="text-slate-600"> (base {s.etaMinutes[bikeMode]} min)</span>
                </p>
              )}
              <div className="mt-2">
                <Link
                  href={buildCenterHref(s.startKm, s.endKm)}
                  className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider px-2.5 py-1.5 rounded-md bg-orange-500/15 border border-orange-500/30 text-orange-300 hover:bg-orange-500/20 transition-colors"
                >
                  Centrar tramo en mapa
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-slate-900/60 border border-white/5 rounded-xl p-4">
        <button
          onClick={() => setRiskOpen((v) => !v)}
          className="w-full flex items-center justify-between gap-3"
          aria-expanded={riskOpen}
          aria-controls="risk-panel-content"
        >
          <h3 className="text-white font-bold">Riesgo por tramo</h3>
          <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${riskOpen ? 'rotate-180' : ''}`} />
        </button>
        {!riskOpen && (
          <p className="mt-2 text-xs text-slate-500">Panel plegado. Pulsa para ver el detalle de riesgo por segmentos.</p>
        )}
        {riskOpen && (
          <div id="risk-panel-content" className="mt-3 space-y-2">
            {data.profile.segments.slice(0, 12).map((s) => {
              const level = hasRisk(s) ? s.risk.level : 'low';
              const label = level === 'high' ? 'Alto' : level === 'medium' ? 'Medio' : 'Bajo';
              const cls = level === 'high' ? 'text-red-300 border-red-500/30 bg-red-500/10' : level === 'medium' ? 'text-amber-300 border-amber-500/30 bg-amber-500/10' : 'text-green-300 border-green-500/30 bg-green-500/10';
              return (
                <div key={`risk-${s.id}`} className="flex items-center justify-between gap-3 bg-slate-950/40 border border-white/5 rounded-lg p-3">
                  <div>
                    <p className="text-sm text-white font-semibold">{s.label}</p>
                    <p className="text-xs text-slate-400">km {s.startKm}-{s.endKm} · {s.avgSlopePct}% · {s.type === 'descent' ? 'bajada' : s.type === 'climb' ? 'subida' : 'transicion'}{hasRisk(s) ? ` · ${s.risk.reason}` : ''}</p>
                  </div>
                  <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded border ${cls}`}>{label}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {data.recommendedWindows && data.recommendedWindows.length > 0 && (
        <div className="bg-slate-900/60 border border-white/5 rounded-xl p-4">
          <h3 className="text-white font-bold mb-3">Salida recomendada hoy por franja</h3>
          <div className="space-y-2">
            {data.recommendedWindows.map((w) => (
              <div key={w.slot} className="flex items-start justify-between gap-3 bg-slate-950/40 border border-white/5 rounded-lg p-3">
                <div>
                  <p className="text-sm text-white font-semibold capitalize">{w.slot}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{w.reason}</p>
                </div>
                <span
                  className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md ${
                    w.riskLevel === 'red'
                      ? 'bg-red-500/15 text-red-300 border border-red-500/30'
                      : w.riskLevel === 'yellow'
                      ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                      : 'bg-green-500/15 text-green-300 border border-green-500/30'
                  }`}
                >
                  {w.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {data.routeNowRecommendation?.thirds && data.routeNowRecommendation.thirds.length > 0 && (
        <div className="bg-slate-900/60 border border-white/5 rounded-xl p-4">
          <h3 className="text-white font-bold mb-3">Recomendacion profesional por tramos (1/3 de ruta)</h3>
          <p className="text-xs text-slate-400 mb-3">
            Analisis en tiempo real con meteo actual + perfil GPX. Cada tramo representa aproximadamente el 33% del recorrido total.
          </p>
          <div className="space-y-3">
            {data.routeNowRecommendation.thirds.map((t) => (
              <div key={t.id} className="bg-slate-950/40 border border-white/5 rounded-lg p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm text-white font-semibold">{t.id} · km {t.rangeKm.from}-{t.rangeKm.to} ({t.rangePct.from}-{t.rangePct.to}%)</p>
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded border ${t.technicalDemand === 'alta' ? 'bg-red-500/15 border-red-500/30 text-red-300' : t.technicalDemand === 'media' ? 'bg-amber-500/15 border-amber-500/30 text-amber-300' : 'bg-green-500/15 border-green-500/30 text-green-300'}`}>
                      Tecnica {t.technicalDemand}
                    </span>
                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded border ${t.weatherRisk === 'alto' ? 'bg-red-500/15 border-red-500/30 text-red-300' : t.weatherRisk === 'medio' ? 'bg-amber-500/15 border-amber-500/30 text-amber-300' : 'bg-green-500/15 border-green-500/30 text-green-300'}`}>
                      Meteo {t.weatherRisk}
                    </span>
                  </div>
                </div>
                <p className="text-xs text-slate-400 mt-1">{t.keyTerrain}</p>
                <p className="text-sm text-slate-200 mt-2">{t.recommendation}</p>
                <div className="mt-2">
                  <Link
                    href={buildCenterHref(t.rangeKm.from, t.rangeKm.to)}
                    className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider px-2.5 py-1.5 rounded-md bg-orange-500/15 border border-orange-500/30 text-orange-300 hover:bg-orange-500/20 transition-colors"
                  >
                    Centrar este tercio en mapa
                  </Link>
                </div>
                <ul className="mt-2 space-y-1">
                  {t.checklist.map((item, idx) => (
                    <li key={`${t.id}-ck-${idx}`} className="text-xs text-slate-400">- {item}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="print-only hidden print:block bg-white text-black p-4 rounded-lg">
        <div className="border-b border-black/20 pb-3 mb-3">
          <p className="text-xs uppercase tracking-widest">Moreres · Forfait MTB</p>
          <h2 className="text-2xl font-black mt-1">Informe tecnico de ruta</h2>
          <p className="text-sm mt-1">{data.title ?? slug}</p>
          <p className="text-xs mt-2">Generado: {data.viewerNow} ({data.viewerTimeZone})</p>
        </div>
        <p className="text-sm mb-3">Distancia {data.profile.distanceKm} km | +{data.profile.gainM} m | -{data.profile.lossM} m | Factor meteo ETA x{etaFactor.toFixed(2)}</p>
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr>
              <th className="border p-1 text-left">Segmento</th>
              <th className="border p-1">Km</th>
              <th className="border p-1">Desnivel</th>
              <th className="border p-1">Pendiente</th>
              <th className="border p-1">ETA {bikeMode}</th>
            </tr>
          </thead>
          <tbody>
            {data.profile.segments.slice(0, 20).map((s) => (
              <tr key={`print-${s.id}`}>
                <td className="border p-1">{s.label}</td>
                <td className="border p-1 text-center">{s.startKm}-{s.endKm}</td>
                <td className="border p-1 text-center">{s.elevationDeltaM > 0 ? '+' : ''}{s.elevationDeltaM} m</td>
                <td className="border p-1 text-center">{s.avgSlopePct}%</td>
                <td className="border p-1 text-center">{hasEtaMinutes(s) ? `${Math.round(s.etaMinutes[bikeMode] * etaFactor)} min` : '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="text-[10px] mt-3 opacity-80">Nota: ETA ajustada con telemetria meteo en tiempo real (AEMET) para apoyo a la decision, no sustituye juicio en campo.</p>
      </div>
    </div>
  );
}

function MiniProfile({ segments }: { segments: NonNullable<RouteStatusPayload['profile']>['segments'] }) {
  if (!segments.length) {
    return <div className="text-xs text-slate-500">Sin segmentos suficientes para perfil resumido.</div>;
  }

  const maxAbs = Math.max(...segments.map((s) => Math.abs(s.elevationDeltaM)), 1);
  return (
    <div className="space-y-1.5">
      {segments.slice(0, 16).map((s) => {
        const width = Math.max(8, Math.round((Math.abs(s.elevationDeltaM) / maxAbs) * 100));
        const color = s.type === 'climb' ? 'bg-green-500/70' : s.type === 'descent' ? 'bg-red-500/70' : 'bg-slate-500/60';
        return (
          <div key={s.id} className="flex items-center gap-2">
            <span className="w-16 text-[10px] text-slate-500">km {s.startKm}</span>
            <div className="flex-1 h-2 bg-slate-800 rounded overflow-hidden">
              <div className={`h-full ${color}`} style={{ width: `${width}%` }} />
            </div>
            <span className="w-16 text-right text-[10px] text-slate-300">{s.elevationDeltaM > 0 ? '+' : ''}{s.elevationDeltaM} m</span>
          </div>
        );
      })}
    </div>
  );
}

function ContinuousProfile({ series, slug }: { series: Array<{ km: number; elevationM: number }>; slug: string }) {
  if (!series.length) return null;
  const width = 760;
  const height = 220;
  const padX = 46;
  const padTop = 20;
  const padBottom = 34;
  const minEle = Math.min(...series.map((p) => p.elevationM));
  const maxEle = Math.max(...series.map((p) => p.elevationM));
  const maxKm = Math.max(...series.map((p) => p.km), 1);
  const rangeEle = Math.max(1, maxEle - minEle);
  const scaleX = (km: number) => padX + (km / maxKm) * (width - padX * 2);
  const scaleY = (ele: number) => {
    if (maxEle === minEle) return height / 2;
    return padTop + ((maxEle - ele) / rangeEle) * (height - padTop - padBottom);
  };

  const highestPoint = series.reduce((best, p) => (p.elevationM > best.elevationM ? p : best), series[0]);
  const lowestPoint = series.reduce((best, p) => (p.elevationM < best.elevationM ? p : best), series[0]);

  const path = series
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${scaleX(p.km).toFixed(2)} ${scaleY(p.elevationM).toFixed(2)}`)
    .join(' ');

  const areaPath = `${path} L ${scaleX(series[series.length - 1].km).toFixed(2)} ${(height - padBottom).toFixed(2)} L ${scaleX(series[0].km).toFixed(2)} ${(height - padBottom).toFixed(2)} Z`;

  const yTicks = Array.from({ length: 4 }, (_, i) => {
    const pct = i / 3;
    const ele = maxEle - rangeEle * pct;
    const y = scaleY(ele);
    return { ele: Math.round(ele), y };
  });

  const xTicks = [0, 0.25, 0.5, 0.75, 1].map((ratio) => ({
    km: maxKm * ratio,
    x: scaleX(maxKm * ratio),
  }));

  const points = series.map((p) => ({ ...p, x: scaleX(p.km), y: scaleY(p.elevationM) }));
  const [hover, setHover] = useState<{ idx: number; x: number; y: number } | null>(null);
  const [lockedIdx, setLockedIdx] = useState<number | null>(null);

  const onMove: MouseEventHandler<SVGSVGElement> = (ev) => {
    const rect = ev.currentTarget.getBoundingClientRect();
    const relX = ((ev.clientX - rect.left) / rect.width) * width;
    let best = 0;
    let bestDist = Infinity;
    for (let i = 0; i < points.length; i++) {
      const d = Math.abs(points[i].x - relX);
      if (d < bestDist) {
        best = i;
        bestDist = d;
      }
    }
    setHover({ idx: best, x: points[best].x, y: points[best].y });
  };

  const onClick: MouseEventHandler<SVGSVGElement> = () => {
    if (!hover) return;
    setLockedIdx(hover.idx);
  };

  const onKeyDown: KeyboardEventHandler<HTMLDivElement> = (ev) => {
    if (!points.length) return;
    if (ev.key === 'Escape') {
      setLockedIdx(null);
      return;
    }
    if (ev.key !== 'ArrowLeft' && ev.key !== 'ArrowRight') return;
    ev.preventDefault();
    const step = Math.max(1, Math.floor(points.length / 120));
    const base = lockedIdx ?? hover?.idx ?? 0;
    const next = ev.key === 'ArrowRight' ? Math.min(points.length - 1, base + step) : Math.max(0, base - step);
    setLockedIdx(next);
    setHover({ idx: next, x: points[next].x, y: points[next].y });
  };

  // Keep live hover measurement even when a point is locked.
  const activeIdx = hover?.idx ?? lockedIdx ?? null;
  const hoveredPoint = activeIdx !== null ? points[activeIdx] : null;
  const prev = activeIdx !== null && activeIdx > 0 ? points[activeIdx - 1] : null;
  const trend = prev && hoveredPoint
    ? hoveredPoint.elevationM > prev.elevationM + 1
      ? 'subiendo'
      : hoveredPoint.elevationM < prev.elevationM - 1
      ? 'bajando'
      : 'llano'
    : 'llano';

  const localSlopePct = prev && hoveredPoint
    ? (() => {
        const dKm = Math.max(0.0001, hoveredPoint.km - prev.km);
        const dM = hoveredPoint.elevationM - prev.elevationM;
        return (dM / (dKm * 1000)) * 100;
      })()
    : 0;

  const cumulative = useMemo(() => {
    const out: Array<{ gainM: number; lossM: number }> = [];
    let gain = 0;
    let loss = 0;
    for (let i = 0; i < points.length; i++) {
      if (i > 0) {
        const d = points[i].elevationM - points[i - 1].elevationM;
        if (d > 0) gain += d;
        if (d < 0) loss += Math.abs(d);
      }
      out.push({ gainM: gain, lossM: loss });
    }
    return out;
  }, [points]);

  const activeCum = activeIdx !== null ? cumulative[activeIdx] : null;
  const activeKm = hoveredPoint?.km ?? 0;
  const gainPctAtPoint = activeCum && activeKm > 0 ? (activeCum.gainM / (activeKm * 1000)) * 100 : 0;
  const lossPctAtPoint = activeCum && activeKm > 0 ? (activeCum.lossM / (activeKm * 1000)) * 100 : 0;

  const clickedMax = useMemo(() => {
    if (activeIdx === null) return null;
    // Highest point from clicked point to route finish.
    const anchor = lockedIdx ?? activeIdx;
    const from = Math.max(0, anchor);
    const to = points.length - 1;
    let maxI = from;
    for (let i = from + 1; i <= to; i++) {
      if (points[i].elevationM > points[maxI].elevationM) maxI = i;
    }
    return { idx: maxI, ...points[maxI] };
  }, [activeIdx, lockedIdx, points]);

  return (
    <div className="bg-slate-900/60 border border-white/5 rounded-xl p-4" tabIndex={0} onKeyDown={onKeyDown}>
      <h3 className="text-white font-bold mb-3">Perfil altimetrico continuo</h3>
      <p className="text-xs text-slate-400 mb-3">
        Eje horizontal: kilometros. Eje vertical: altitud (m). Sirve para identificar donde estan las grandes subidas y bajadas.
      </p>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto cursor-crosshair" role="img" aria-label="Perfil altimetrico" onMouseMove={onMove} onMouseLeave={() => setHover(null)} onClick={onClick}>
        <defs>
          <linearGradient id="elevLine" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stopColor="#22c55e" />
            <stop offset="50%" stopColor="#f59e0b" />
            <stop offset="100%" stopColor="#ef4444" />
          </linearGradient>
          <linearGradient id="elevArea" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#f97316" stopOpacity="0.24" />
            <stop offset="100%" stopColor="#f97316" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        <rect x="0" y="0" width={width} height={height} fill="transparent" />

        {yTicks.map((t, i) => (
          <g key={`y-${i}`}>
            <line x1={padX} y1={t.y} x2={width - padX} y2={t.y} stroke="#334155" strokeWidth="1" strokeDasharray="4 4" />
            <text x={8} y={t.y + 4} fill="#94a3b8" fontSize="10">{t.ele} m</text>
          </g>
        ))}

        {xTicks.map((t, i) => (
          <g key={`x-${i}`}>
            <line x1={t.x} y1={height - padBottom} x2={t.x} y2={height - padBottom + 4} stroke="#64748b" strokeWidth="1" />
            <text x={t.x - 10} y={height - 8} fill="#94a3b8" fontSize="10">{t.km.toFixed(1)} km</text>
          </g>
        ))}

        <path d={areaPath} fill="url(#elevArea)" stroke="none" />
        <path d={path} fill="none" stroke="url(#elevLine)" strokeWidth="3" strokeLinecap="round" />

        <circle cx={scaleX(series[0].km)} cy={scaleY(series[0].elevationM)} r="3" fill="#22c55e" />
        <circle cx={scaleX(series[series.length - 1].km)} cy={scaleY(series[series.length - 1].elevationM)} r="3" fill="#f97316" />
        <circle cx={scaleX(highestPoint.km)} cy={scaleY(highestPoint.elevationM)} r="3.2" fill="#60a5fa" />
        <circle cx={scaleX(lowestPoint.km)} cy={scaleY(lowestPoint.elevationM)} r="3.2" fill="#f43f5e" />

        <text x={scaleX(highestPoint.km) + 6} y={scaleY(highestPoint.elevationM) - 8} fill="#93c5fd" fontSize="10">MAX {highestPoint.elevationM.toFixed(0)} m</text>
        <text x={scaleX(lowestPoint.km) + 6} y={scaleY(lowestPoint.elevationM) + 12} fill="#fda4af" fontSize="10">MIN {lowestPoint.elevationM.toFixed(0)} m</text>

        {hoveredPoint && (
          <g>
            <line x1={hoveredPoint.x} y1={padTop} x2={hoveredPoint.x} y2={height - padBottom} stroke="#e2e8f0" strokeDasharray="4 4" strokeWidth="1" />
            <circle cx={hoveredPoint.x} cy={hoveredPoint.y} r="4" fill="#f8fafc" stroke="#f97316" strokeWidth="2" />
          </g>
        )}

        {clickedMax && (
          <g>
            <circle cx={clickedMax.x} cy={clickedMax.y} r="4" fill="#38bdf8" stroke="#0ea5e9" strokeWidth="2" />
            <text x={clickedMax.x + 6} y={clickedMax.y - 8} fill="#7dd3fc" fontSize="10">MAX restante {clickedMax.elevationM.toFixed(0)} m</text>
          </g>
        )}
      </svg>
      <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-2 text-[11px]">
        <div className="bg-slate-950/50 border border-white/5 rounded px-2 py-1.5 text-slate-300">Inicio: {series[0].elevationM.toFixed(0)} m</div>
        <div className="bg-slate-950/50 border border-white/5 rounded px-2 py-1.5 text-slate-300">Final: {series[series.length - 1].elevationM.toFixed(0)} m</div>
        <div className="bg-slate-950/50 border border-white/5 rounded px-2 py-1.5 text-slate-300">Rango: {(maxEle - minEle).toFixed(0)} m</div>
        <div className="bg-slate-950/50 border border-white/5 rounded px-2 py-1.5 text-slate-300">Total: {maxKm.toFixed(1)} km</div>
      </div>
      {hoveredPoint && (
        <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px]">
          <span className="px-2 py-1 rounded bg-slate-950/60 border border-white/10 text-slate-200">km {hoveredPoint.km.toFixed(2)}</span>
          <span className="px-2 py-1 rounded bg-slate-950/60 border border-white/10 text-slate-200">altitud {hoveredPoint.elevationM.toFixed(0)} m</span>
          <span className="px-2 py-1 rounded bg-slate-950/60 border border-white/10 text-slate-200">{trend}</span>
          <span className="px-2 py-1 rounded bg-slate-950/60 border border-white/10 text-slate-200">pendiente punto {localSlopePct >= 0 ? '+' : ''}{localSlopePct.toFixed(1)}%</span>
          <span className="px-2 py-1 rounded bg-slate-950/60 border border-white/10 text-green-300">subida acum {gainPctAtPoint.toFixed(1)}%</span>
          <span className="px-2 py-1 rounded bg-slate-950/60 border border-white/10 text-red-300">descenso acum {lossPctAtPoint.toFixed(1)}%</span>
          {lockedIdx !== null && <span className="px-2 py-1 rounded bg-blue-500/15 border border-blue-500/30 text-blue-300">punto fijado</span>}
          <Link
            href={`/forfait/${slug}?pointKm=${hoveredPoint.km.toFixed(2)}#trail-map`}
            className="px-2.5 py-1 rounded bg-orange-500/20 border border-orange-500/30 text-orange-300 font-bold uppercase tracking-wider"
          >
            Sincronizar punto en mapa
          </Link>
        </div>
      )}
      <p className="mt-2 text-[11px] text-slate-500">Tip: click fija ancla para MAX restante; el hover sigue midiendo en vivo. Flechas izquierda/derecha para navegar, Escape para liberar.</p>
    </div>
  );
}

function Metric({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="bg-slate-900/70 border border-white/5 rounded-xl p-3">
      <div className="flex items-center gap-2 text-slate-500 text-[11px]">
        {icon}
        {label}
      </div>
      <p className="text-xs text-white font-semibold mt-1 truncate">{value}</p>
    </div>
  );
}
