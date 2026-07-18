'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Bike, Flame, Layers3, Loader2, LockKeyhole, Map, Mountain, Route, Sparkles,
} from 'lucide-react';
import MapboxMap, { Layer, NavigationControl, Source } from 'react-map-gl/mapbox';
import type { MapRef } from 'react-map-gl/mapbox';
import 'mapbox-gl/dist/mapbox-gl.css';
import { getActivities } from '@/lib/activities/storage';
import { pullActivities } from '@/lib/activities/sync';
import {
  downsampleRoute, filterHeatmapActivities, summarizeHeatmap,
} from '@/lib/activities/heatmap';
import type {
  HeatmapPeriod, HeatmapSportFilter,
} from '@/lib/activities/heatmap';
import type { RideActivity, RidePoint } from '@/lib/activities/types';

type MapMode = 'heat' | 'routes';

function SchematicHeatmap({ activities }: { activities: RideActivity[] }) {
  const paths = useMemo(() => {
    const allPoints = activities.flatMap((activity) => activity.points);
    if (allPoints.length < 2) return [];
    const minLat = Math.min(...allPoints.map((point) => point.latitude));
    const maxLat = Math.max(...allPoints.map((point) => point.latitude));
    const minLng = Math.min(...allPoints.map((point) => point.longitude));
    const maxLng = Math.max(...allPoints.map((point) => point.longitude));
    const latRange = Math.max(maxLat - minLat, 0.0001);
    const lngRange = Math.max(maxLng - minLng, 0.0001);
    return activities.map((activity) => ({
      id: activity.id,
      sportType: activity.sportType,
      path: downsampleRoute(activity.points, 400).map((point, index) => {
        const x = 4 + (point.longitude - minLng) / lngRange * 92;
        const y = 96 - (point.latitude - minLat) / latRange * 92;
        return `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`;
      }).join(' '),
    }));
  }, [activities]);

  return (
    <div className="relative h-full bg-[radial-gradient(circle_at_30%_20%,#1e293b,#020617_70%)]">
      <div className="absolute inset-0 opacity-20 [background-image:linear-gradient(#64748b_1px,transparent_1px),linear-gradient(90deg,#64748b_1px,transparent_1px)] [background-size:32px_32px]" />
      <svg viewBox="0 0 100 100" className="relative h-full w-full p-5" role="img" aria-label="Mapa esquemático de recorridos personales">
        {paths.map((item) => (
          <path
            key={item.id}
            d={item.path}
            fill="none"
            stroke={item.sportType === 'ebike' ? '#fb923c' : '#60a5fa'}
            strokeWidth="2.2"
            strokeOpacity="0.48"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}
      </svg>
      <span className="absolute bottom-3 left-3 rounded-full bg-slate-950/85 px-3 py-1.5 text-[10px] font-bold text-slate-400">
        Vista esquemática · configura Mapbox para el mapa topográfico
      </span>
    </div>
  );
}

function PersonalRoutesMap({ activities, mode }: { activities: RideActivity[]; mode: MapMode }) {
  const mapRef = useRef<MapRef>(null);
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  const routeCollection = useMemo(() => ({
    type: 'FeatureCollection' as const,
    features: activities.map((activity) => ({
      type: 'Feature' as const,
      properties: { sport: activity.sportType },
      geometry: {
        type: 'LineString' as const,
        coordinates: downsampleRoute(activity.points).map((point) => [point.longitude, point.latitude]),
      },
    })),
  }), [activities]);
  const pointCollection = useMemo(() => ({
    type: 'FeatureCollection' as const,
    features: activities.flatMap((activity) => downsampleRoute(activity.points, 350).map((point: RidePoint) => ({
      type: 'Feature' as const,
      properties: {},
      geometry: {
        type: 'Point' as const,
        coordinates: [point.longitude, point.latitude],
      },
    }))),
  }), [activities]);

  useEffect(() => {
    const points = activities.flatMap((activity) => activity.points);
    if (!mapRef.current || points.length < 2) return;
    mapRef.current.fitBounds(
      [
        [Math.min(...points.map((point) => point.longitude)), Math.min(...points.map((point) => point.latitude))],
        [Math.max(...points.map((point) => point.longitude)), Math.max(...points.map((point) => point.latitude))],
      ],
      { padding: 48, duration: 450, maxZoom: 14 },
    );
  }, [activities]);

  if (!token) return <SchematicHeatmap activities={activities} />;

  return (
    <MapboxMap
      ref={mapRef}
      mapboxAccessToken={token}
      initialViewState={{ longitude: -0.1, latitude: 40.62, zoom: 10 }}
      mapStyle="mapbox://styles/mapbox/outdoors-v12"
      terrain={{ source: 'personal-map-dem', exaggeration: 1.1 }}
      attributionControl={false}
    >
      <Source id="personal-map-dem" type="raster-dem" url="mapbox://mapbox.mapbox-terrain-dem-v1" tileSize={512} />
      <Source id="personal-heat-points" type="geojson" data={pointCollection}>
        <Layer
          id="personal-heat"
          type="heatmap"
          layout={{ visibility: mode === 'heat' ? 'visible' : 'none' }}
          paint={{
            'heatmap-weight': 1,
            'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 7, 0.7, 14, 1.7],
            'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 7, 8, 14, 22],
            'heatmap-opacity': 0.82,
            'heatmap-color': [
              'interpolate', ['linear'], ['heatmap-density'],
              0, 'rgba(2,6,23,0)',
              0.18, '#2563eb',
              0.4, '#22d3ee',
              0.62, '#facc15',
              0.82, '#f97316',
              1, '#ef4444',
            ],
          }}
        />
      </Source>
      <Source id="personal-route-lines" type="geojson" data={routeCollection}>
        <Layer
          id="personal-route-shadow"
          type="line"
          layout={{ visibility: mode === 'routes' ? 'visible' : 'none', 'line-cap': 'round', 'line-join': 'round' }}
          paint={{ 'line-color': '#020617', 'line-width': 6, 'line-opacity': 0.55 }}
        />
        <Layer
          id="personal-route-color"
          type="line"
          layout={{ visibility: mode === 'routes' ? 'visible' : 'none', 'line-cap': 'round', 'line-join': 'round' }}
          paint={{
            'line-color': ['match', ['get', 'sport'], 'ebike', '#fb923c', '#60a5fa'],
            'line-width': 3,
            'line-opacity': 0.56,
          }}
        />
      </Source>
      <NavigationControl position="top-right" showCompass visualizePitch />
    </MapboxMap>
  );
}

export default function PersonalHeatmap() {
  const [activities, setActivities] = useState<RideActivity[]>([]);
  const [sport, setSport] = useState<HeatmapSportFilter>('all');
  const [period, setPeriod] = useState<HeatmapPeriod>('all');
  const [mode, setMode] = useState<MapMode>('heat');
  const [nowMs, setNowMs] = useState(0);
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(() => setActivities(getActivities()), []);

  useEffect(() => {
    const initialRead = window.setTimeout(() => {
      setNowMs(Date.now());
      refresh();
      setLoaded(true);
    }, 0);
    void pullActivities().then(refresh);
    return () => window.clearTimeout(initialRead);
  }, [refresh]);

  const filtered = useMemo(
    () => nowMs ? filterHeatmapActivities(activities, sport, period, nowMs) : [],
    [activities, nowMs, period, sport],
  );
  const summary = useMemo(() => summarizeHeatmap(filtered), [filtered]);

  return (
    <main className="min-h-screen bg-slate-950 pb-28 text-white md:pb-16">
      <div className="mx-auto max-w-7xl px-4 py-7 sm:px-6 md:py-12">
        <header className="mb-6 flex flex-wrap items-end justify-between gap-5">
          <div>
            <p className="mb-2 flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-orange-400">
              <Flame className="h-4 w-4" /> Tus huellas
            </p>
            <h1 className="text-3xl font-black tracking-tight sm:text-4xl">Mapa personal</h1>
            <p className="mt-2 max-w-xl text-sm text-slate-400">Descubre tus zonas más rodadas y los senderos que aún te quedan por explorar.</p>
          </div>
          <Link href="/grabar" className="flex items-center gap-2 rounded-xl bg-orange-500 px-4 py-3 text-xs font-black uppercase">
            <Bike className="h-4 w-4" /> Añadir huella
          </Link>
        </header>

        <section className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-slate-900/60 p-3">
          <div className="flex flex-wrap gap-1.5">
            {([
              ['all', 'Todo'],
              ['ebike', 'E-bike'],
              ['mtb', 'MTB'],
            ] as const).map(([value, label]) => (
              <button key={value} onClick={() => setSport(value)}
                className={`rounded-lg px-3 py-2 text-[10px] font-black uppercase ${sport === value ? 'bg-orange-500 text-white' : 'text-slate-500 hover:bg-white/5'}`}>
                {label}
              </button>
            ))}
            <span className="mx-1 hidden w-px bg-white/10 sm:block" />
            {([
              ['30d', '30 días'],
              ['90d', '90 días'],
              ['year', 'Este año'],
              ['all', 'Siempre'],
            ] as const).map(([value, label]) => (
              <button key={value} onClick={() => setPeriod(value)}
                className={`rounded-lg px-3 py-2 text-[10px] font-black ${period === value ? 'bg-white text-slate-950' : 'text-slate-500 hover:bg-white/5'}`}>
                {label}
              </button>
            ))}
          </div>
          <div className="flex rounded-xl bg-slate-950 p-1">
            <button onClick={() => setMode('heat')} aria-pressed={mode === 'heat'}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-[10px] font-black ${mode === 'heat' ? 'bg-orange-500 text-white' : 'text-slate-500'}`}>
              <Flame className="h-3.5 w-3.5" /> Calor
            </button>
            <button onClick={() => setMode('routes')} aria-pressed={mode === 'routes'}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-[10px] font-black ${mode === 'routes' ? 'bg-orange-500 text-white' : 'text-slate-500'}`}>
              <Layers3 className="h-3.5 w-3.5" /> Rutas
            </button>
          </div>
        </section>

        {!loaded ? (
          <div className="grid min-h-[520px] place-items-center rounded-3xl border border-white/10 bg-slate-900/30">
            <Loader2 className="h-7 w-7 animate-spin text-orange-400" />
          </div>
        ) : filtered.length === 0 ? (
          <section className="grid min-h-[520px] place-items-center rounded-3xl border border-dashed border-white/15 bg-slate-900/30 px-6 text-center">
            <div>
              <Map className="mx-auto h-11 w-11 text-slate-600" />
              <h2 className="mt-4 text-xl font-black">Aún no hay huellas en este filtro</h2>
              <p className="mx-auto mt-2 max-w-sm text-sm text-slate-500">Cambia el periodo o graba una salida para empezar a dibujar tu territorio.</p>
              <Link href="/grabar" className="mt-6 inline-flex rounded-xl bg-orange-500 px-5 py-3 text-xs font-black uppercase">Grabar salida</Link>
            </div>
          </section>
        ) : (
          <>
            <section className="h-[58vh] min-h-[480px] overflow-hidden rounded-3xl border border-white/10 lg:h-[68vh]">
              <PersonalRoutesMap activities={filtered} mode={mode} />
            </section>
            <section className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
              <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-4">
                <p className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-slate-500"><Route className="h-4 w-4" /> Distancia</p>
                <p className="mt-2 text-2xl font-black">{(summary.distanceM / 1000).toFixed(1)} <span className="text-xs text-slate-500">km</span></p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-4">
                <p className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-slate-500"><Mountain className="h-4 w-4" /> Desnivel</p>
                <p className="mt-2 text-2xl font-black">{Math.round(summary.elevationM).toLocaleString('es-ES')} <span className="text-xs text-slate-500">m</span></p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-4">
                <p className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-slate-500"><Sparkles className="h-4 w-4" /> Zonas exploradas</p>
                <p className="mt-2 text-2xl font-black">{summary.exploredCells} <span className="text-xs text-slate-500">áreas</span></p>
              </div>
              <div className="rounded-2xl border border-orange-500/20 bg-orange-500/5 p-4">
                <p className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-orange-300"><Flame className="h-4 w-4" /> Zona favorita</p>
                <p className="mt-2 text-2xl font-black">{summary.mostRepeatedRides} <span className="text-xs text-slate-500">salidas</span></p>
              </div>
            </section>
          </>
        )}

        <p className="mt-4 flex items-start gap-2 text-[10px] leading-relaxed text-slate-600">
          <LockKeyhole className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Este mapa combina tus actividades privadas y públicas únicamente para ti. Los recorridos privados no aparecen en la Comunidad.
        </p>
      </div>
    </main>
  );
}
