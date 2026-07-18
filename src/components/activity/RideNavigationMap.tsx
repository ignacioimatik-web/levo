'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Map, { Layer, Marker, Source } from 'react-map-gl/mapbox';
import type { MapRef } from 'react-map-gl/mapbox';
import { CloudOff, Layers3, LocateFixed, MapPinned, Navigation2, Target } from 'lucide-react';
import 'mapbox-gl/dist/mapbox-gl.css';
import type { RidePoint } from '@/lib/activities/types';
import type { PlannedRoutePoint } from '@/lib/navigation/types';
import type { OfflineMapPackage } from '@/lib/navigation/offline-map-storage';
import { MAPBOX_ACCESS_TOKEN, OFFLINE_MAP_STYLE, OPEN_MAP_STYLES } from '@/lib/open-map-styles';
import { useTheme } from '@/components/theme/ThemeProvider';
import { cardinalForBearing } from '@/lib/navigation/progress';
import { formatTurnDistance } from '@/lib/navigation/turns';
import { summarizeOfflineMap } from '@/lib/navigation/offline-map-data';

type MapPoint = RidePoint | PlannedRoutePoint;
type FollowMode = 'north' | 'heading';

function bearingBetween(a: MapPoint, b: MapPoint): number {
  const lat1 = a.latitude * Math.PI / 180;
  const lat2 = b.latitude * Math.PI / 180;
  const deltaLng = (b.longitude - a.longitude) * Math.PI / 180;
  const y = Math.sin(deltaLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2)
    - Math.sin(lat1) * Math.cos(lat2) * Math.cos(deltaLng);
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}

function lineFeature(points: Array<Pick<MapPoint, 'latitude' | 'longitude'>>) {
  return {
    type: 'Feature' as const,
    properties: {},
    geometry: {
      type: 'LineString' as const,
      coordinates: points.map((point) => [point.longitude, point.latitude]),
    },
  };
}

function SchematicFallback({
  points,
  plannedPoints,
}: {
  points: RidePoint[];
  plannedPoints: PlannedRoutePoint[];
}) {
  const paths = useMemo(() => {
    const allPoints: MapPoint[] = [...plannedPoints, ...points];
    if (allPoints.length < 2) return { ridden: '', planned: '' };
    const lngs = allPoints.map((point) => point.longitude);
    const lats = allPoints.map((point) => point.latitude);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const lngRange = maxLng - minLng || 1;
    const latRange = maxLat - minLat || 1;
    const project = (routePoints: MapPoint[]) => routePoints.map((point, index) => {
      const x = 8 + (point.longitude - minLng) / lngRange * 84;
      const y = 92 - (point.latitude - minLat) / latRange * 84;
      return `${index === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
    }).join(' ');
    return {
      ridden: points.length > 1 ? project(points) : '',
      planned: plannedPoints.length > 1 ? project(plannedPoints) : '',
    };
  }, [plannedPoints, points]);

  return (
    <div className="relative h-full bg-[radial-gradient(circle_at_30%_20%,#334155_0,#0f172a_45%,#020617_100%)]">
      <div className="absolute inset-0 opacity-20 [background-image:linear-gradient(#94a3b8_1px,transparent_1px),linear-gradient(90deg,#94a3b8_1px,transparent_1px)] [background-size:28px_28px]" />
      {paths.ridden || paths.planned ? (
        <svg viewBox="0 0 100 100" className="relative h-full w-full p-5" role="img" aria-label="Trazado GPS sin cartografía">
          {paths.planned && <path d={paths.planned} fill="none" stroke="#94a3b8" strokeWidth="2.5" strokeDasharray="3 2" strokeLinecap="round" />}
          {paths.ridden && <path d={paths.ridden} fill="none" stroke="#fb923c" strokeWidth="4" strokeLinecap="round" />}
        </svg>
      ) : (
        <div className="relative flex h-full flex-col items-center justify-center text-center">
          <LocateFixed className="mb-2 h-8 w-8 text-slate-500" />
          <p className="text-sm font-bold text-slate-300">El trazado aparecerá al moverte</p>
          <p className="mt-1 text-xs text-slate-500">Esperando una posición GPS fiable</p>
        </div>
      )}
      <span className="absolute bottom-3 left-3 flex items-center gap-1.5 rounded-full bg-slate-950/85 px-3 py-1.5 text-[10px] font-bold text-slate-300">
        <MapPinned className="h-3.5 w-3.5 text-orange-400" /> Mapa offline esquemático
      </span>
    </div>
  );
}

export default function RideNavigationMap({
  points,
  plannedPoints = [],
  active,
  offRouteM,
  rejoinPoint,
  rejoinPoints = [],
  navigationCue,
  offlineMap,
  focused = false,
}: {
  points: RidePoint[];
  plannedPoints?: PlannedRoutePoint[];
  active: boolean;
  offRouteM?: number | null;
  rejoinPoint?: { latitude: number; longitude: number } | null;
  rejoinPoints?: PlannedRoutePoint[];
  navigationCue?: {
    label: string;
    distanceM: number;
    offRoute: boolean;
    bearingDeg?: number | null;
  } | null;
  offlineMap?: OfflineMapPackage | null;
  focused?: boolean;
}) {
  const mapRef = useRef<MapRef>(null);
  const { theme } = useTheme();
  const [following, setFollowing] = useState(true);
  const [followMode, setFollowMode] = useState<FollowMode>('north');
  const [selectedStyleIndex, setSelectedStyleIndex] = useState<number | null>(null);
  const styleIndex = selectedStyleIndex ?? (theme === 'dark' ? 2 : 0);
  const [online, setOnline] = useState(true);
  const [preferOffline, setPreferOffline] = useState(false);
  const currentPoint = points.at(-1);
  const initialPoint = currentPoint ?? plannedPoints[0];
  const heading = useMemo(() => {
    if (points.length < 2) return 0;
    return bearingBetween(points.at(-2)!, points.at(-1)!);
  }, [points]);
  const riddenRoute = useMemo(() => lineFeature(points), [points]);
  const plannedRoute = useMemo(() => lineFeature(plannedPoints), [plannedPoints]);
  const rejoinRoute = useMemo(
    () => rejoinPoints.length > 1
      ? lineFeature(rejoinPoints)
      : currentPoint && rejoinPoint
        ? lineFeature([currentPoint, rejoinPoint])
        : null,
    [currentPoint, rejoinPoint, rejoinPoints],
  );
  const routedRejoin = rejoinPoints.length > 1;
  const offlineActive = Boolean(offlineMap) && (!online || preferOffline);
  const offlineSummary = useMemo(
    () => offlineMap ? offlineMap.summary ?? summarizeOfflineMap(offlineMap.trails) : null,
    [offlineMap],
  );

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);

  useEffect(() => {
    if (!mapRef.current || !currentPoint || !following) return;
    mapRef.current.easeTo({
      center: [currentPoint.longitude, currentPoint.latitude],
      zoom: active ? 15.5 : 13,
      bearing: followMode === 'heading' ? heading : 0,
      pitch: followMode === 'heading' ? 42 : 0,
      duration: 500,
      essential: true,
    });
  }, [active, currentPoint, followMode, following, heading]);

  const recenter = () => {
    setFollowing(true);
    if (!currentPoint || !mapRef.current) return;
    mapRef.current.easeTo({
      center: [currentPoint.longitude, currentPoint.latitude],
      zoom: 15.5,
      bearing: followMode === 'heading' ? heading : 0,
      pitch: followMode === 'heading' ? 42 : 0,
      duration: 400,
    });
  };

  if (!initialPoint) {
    return (
      <div className={`overflow-hidden rounded-3xl border border-white/10 ${
        active ? focused ? 'h-[min(68svh,38rem)] min-h-56' : 'h-[min(55svh,26rem)] min-h-52' : 'h-56'
      }`}>
        <SchematicFallback points={points} plannedPoints={plannedPoints} />
      </div>
    );
  }

  return (
    <div className={`relative overflow-hidden rounded-3xl border bg-slate-900 ${
      (offRouteM ?? 0) > 75 ? 'border-red-500/60' : 'border-white/10'
    } ${focused ? 'ride-navigation-focused' : ''} ${active
      ? focused
        ? 'h-[min(68svh,38rem)] min-h-56'
        : 'h-[min(55svh,26rem)] min-h-52'
      : 'h-56 sm:h-64'
    }`}>
      <Map
        ref={mapRef}
        mapboxAccessToken={MAPBOX_ACCESS_TOKEN}
        initialViewState={{
          longitude: initialPoint.longitude,
          latitude: initialPoint.latitude,
          zoom: currentPoint ? 15.5 : 12,
        }}
        mapStyle={offlineActive ? OFFLINE_MAP_STYLE : OPEN_MAP_STYLES[styleIndex].style}
        attributionControl={false}
        dragRotate
        touchPitch
        touchZoomRotate
        onDragStart={() => setFollowing(false)}
        reuseMaps
      >
        {offlineMap && (
          <Source id="offline-trail-context" type="geojson" data={offlineMap.trails}>
            <Layer
              id="offline-water-areas"
              type="fill"
              filter={['all', ['==', ['geometry-type'], 'Polygon'], ['==', ['get', 'kind'], 'water']]}
              paint={{
                'fill-color': '#2563eb',
                'fill-opacity': offlineActive ? 0.42 : 0.16,
                'fill-outline-color': '#60a5fa',
              }}
            />
            <Layer
              id="offline-water-lines"
              type="line"
              filter={['all', ['==', ['geometry-type'], 'LineString'], ['==', ['get', 'kind'], 'water']]}
              paint={{
                'line-color': '#38bdf8',
                'line-width': ['interpolate', ['linear'], ['zoom'], 10, 1, 16, 3],
                'line-opacity': offlineActive ? 0.88 : 0.3,
              }}
              layout={{ 'line-cap': 'round', 'line-join': 'round' }}
            />
            <Layer
              id="offline-trail-shadow"
              type="line"
              filter={['any',
                ['==', ['get', 'kind'], 'trail'],
                ['all', ['!', ['has', 'kind']], ['has', 'highway']],
              ]}
              paint={{
                'line-color': '#020617',
                'line-width': ['interpolate', ['linear'], ['zoom'], 10, 1.5, 16, 7],
                'line-opacity': offlineActive ? 0.8 : 0.28,
              }}
              layout={{ 'line-cap': 'round', 'line-join': 'round' }}
            />
            <Layer
              id="offline-trail-lines"
              type="line"
              filter={['any',
                ['==', ['get', 'kind'], 'trail'],
                ['all', ['!', ['has', 'kind']], ['has', 'highway']],
              ]}
              paint={{
                'line-color': [
                  'match', ['get', 'highway'],
                  'path', '#fbbf24',
                  'footway', '#fbbf24',
                  'bridleway', '#fbbf24',
                  'track', '#cbd5e1',
                  'cycleway', '#34d399',
                  'primary', '#93c5fd',
                  'secondary', '#93c5fd',
                  'tertiary', '#93c5fd',
                  '#64748b',
                ],
                'line-width': ['interpolate', ['linear'], ['zoom'], 10, 0.8, 16, 3.5],
                'line-opacity': offlineActive ? 0.95 : 0.38,
              }}
              layout={{ 'line-cap': 'round', 'line-join': 'round' }}
            />
            <Layer
              id="offline-private-trails"
              type="line"
              filter={['all',
                ['any',
                  ['==', ['get', 'kind'], 'trail'],
                  ['all', ['!', ['has', 'kind']], ['has', 'highway']],
                ],
                ['in', ['get', 'access'], ['literal', ['private', 'no']]],
              ]}
              paint={{
                'line-color': '#ef4444',
                'line-width': 2,
                'line-dasharray': [2, 2],
                'line-opacity': 0.9,
              }}
            />
            <Layer
              id="offline-barriers"
              type="line"
              filter={['all', ['==', ['geometry-type'], 'LineString'], ['==', ['get', 'kind'], 'barrier']]}
              paint={{
                'line-color': '#f87171',
                'line-width': 1.5,
                'line-dasharray': [1, 1],
                'line-opacity': offlineActive ? 0.9 : 0.3,
              }}
            />
            <Layer
              id="offline-pois-halo"
              type="circle"
              filter={['==', ['get', 'kind'], 'poi']}
              paint={{
                'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 3, 16, 8],
                'circle-color': '#020617',
                'circle-opacity': offlineActive ? 0.9 : 0.35,
              }}
            />
            <Layer
              id="offline-pois"
              type="circle"
              filter={['==', ['get', 'kind'], 'poi']}
              paint={{
                'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 2, 16, 5],
                'circle-color': [
                  'match', ['get', 'poiType'],
                  'drinking_water', '#38bdf8',
                  'shelter', '#fbbf24',
                  'alpine_hut', '#fbbf24',
                  'wilderness_hut', '#fbbf24',
                  'viewpoint', '#a78bfa',
                  'peak', '#e2e8f0',
                  'parking', '#60a5fa',
                  'gate', '#f87171',
                  'lift_gate', '#f87171',
                  'cycle_barrier', '#f87171',
                  'trailhead', '#34d399',
                  'access_point', '#fb923c',
                  '#94a3b8',
                ],
                'circle-stroke-color': '#f8fafc',
                'circle-stroke-width': 1,
                'circle-opacity': offlineActive ? 1 : 0.48,
              }}
            />
          </Source>
        )}
        {plannedPoints.length > 1 && (
          <Source id="planned-ride-route" type="geojson" data={plannedRoute}>
            <Layer
              id="planned-ride-route-shadow"
              type="line"
              paint={{ 'line-color': '#020617', 'line-width': 9, 'line-opacity': 0.75 }}
              layout={{ 'line-cap': 'round', 'line-join': 'round' }}
            />
            <Layer
              id="planned-ride-route-line"
              type="line"
              paint={{ 'line-color': '#60a5fa', 'line-width': 5, 'line-opacity': 0.9, 'line-dasharray': [2, 1] }}
              layout={{ 'line-cap': 'round', 'line-join': 'round' }}
            />
          </Source>
        )}
        {points.length > 1 && (
          <Source id="ridden-route" type="geojson" data={riddenRoute}>
            <Layer
              id="ridden-route-shadow"
              type="line"
              paint={{ 'line-color': '#020617', 'line-width': 9, 'line-opacity': 0.7 }}
              layout={{ 'line-cap': 'round', 'line-join': 'round' }}
            />
            <Layer
              id="ridden-route-line"
              type="line"
              paint={{ 'line-color': '#fb923c', 'line-width': 5 }}
              layout={{ 'line-cap': 'round', 'line-join': 'round' }}
            />
          </Source>
        )}
        {(offRouteM ?? 0) > 75 && rejoinRoute && rejoinPoint && (
          <>
            <Source id="rejoin-route" type="geojson" data={rejoinRoute}>
              <Layer
                id="rejoin-route-line"
                type="line"
                paint={{
                  'line-color': '#f87171',
                  'line-width': routedRejoin ? 5 : 4,
                  'line-dasharray': routedRejoin ? [8, 1] : [1.5, 1.5],
                  'line-opacity': 0.95,
                }}
                layout={{ 'line-cap': 'round', 'line-join': 'round' }}
              />
            </Source>
            <Marker longitude={rejoinPoint.longitude} latitude={rejoinPoint.latitude} anchor="center">
              <span className="grid h-9 w-9 place-items-center rounded-full border-2 border-white bg-red-500 text-white shadow-[0_0_0_8px_rgba(239,68,68,.22)]" aria-label="Punto para volver al track">
                <Target className="h-5 w-5" />
              </span>
            </Marker>
          </>
        )}
        {currentPoint && (
          <Marker longitude={currentPoint.longitude} latitude={currentPoint.latitude} anchor="center">
            <span className="relative grid h-7 w-7 place-items-center rounded-full border-[3px] border-white bg-orange-500 shadow-[0_0_0_8px_rgba(251,146,60,.2)]" aria-label="Tu posición">
              {followMode === 'heading' && (
                <Navigation2 className="h-3.5 w-3.5 fill-slate-950 text-slate-950" style={{ transform: `rotate(${heading}deg)` }} />
              )}
            </span>
          </Marker>
        )}
      </Map>

      {active && navigationCue && (
        <div className={`pointer-events-none absolute left-3 top-3 z-10 max-w-[calc(100%-5.5rem)] rounded-2xl border px-3 py-2.5 shadow-xl backdrop-blur ${
          navigationCue.offRoute
            ? 'border-red-400/50 bg-red-950/90 text-red-100'
            : 'border-white/15 bg-slate-950/90 text-white'
        }`}>
          <p className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest">
            {navigationCue.offRoute
              ? <Target className="h-3.5 w-3.5" />
              : <Navigation2 className="h-3.5 w-3.5" />}
            {navigationCue.label}
          </p>
          <div className="mt-1 flex items-end gap-2">
            <p className={`text-xl font-black tabular-nums ${
              navigationCue.offRoute ? 'text-red-200' : 'text-orange-300'
            }`}>
              {formatTurnDistance(navigationCue.distanceM)}
            </p>
            {navigationCue.offRoute && navigationCue.bearingDeg != null && (
              <p className="pb-1 text-[9px] font-black uppercase">
                {Math.round(navigationCue.bearingDeg)}° {cardinalForBearing(navigationCue.bearingDeg)}
              </p>
            )}
          </div>
        </div>
      )}

      <div className="absolute right-3 top-3 z-10 flex flex-col gap-2">
        <button
          type="button"
          onClick={recenter}
          aria-label="Centrar mapa en mi posición"
          className={`grid h-11 w-11 place-items-center rounded-xl border shadow-lg backdrop-blur ${
            following ? 'border-orange-400/50 bg-orange-500 text-white' : 'border-white/15 bg-slate-950/85 text-slate-300'
          }`}
        >
          <LocateFixed className="h-5 w-5" />
        </button>
        <button
          type="button"
          aria-pressed={followMode === 'heading'}
          onClick={() => setFollowMode((mode) => mode === 'north' ? 'heading' : 'north')}
          className="flex h-11 min-w-11 items-center justify-center gap-1.5 rounded-xl border border-white/15 bg-slate-950/85 px-2.5 text-[9px] font-black uppercase text-white shadow-lg backdrop-blur"
        >
          <Navigation2 className="h-4 w-4" />
          <span>{followMode === 'heading' ? 'Rumbo' : 'Norte'}</span>
        </button>
        <button
          type="button"
          aria-label={offlineActive
            ? 'Mapa Offline activo'
            : `Mapa ${OPEN_MAP_STYLES[styleIndex].label}. Cambiar estilo`}
          disabled={offlineActive}
          onClick={() => setSelectedStyleIndex((styleIndex + 1) % OPEN_MAP_STYLES.length)}
          className="flex h-11 min-w-11 items-center justify-center gap-1.5 rounded-xl border border-white/15 bg-slate-950/85 px-2.5 text-[9px] font-black uppercase text-white shadow-lg backdrop-blur disabled:text-blue-300"
        >
          <Layers3 className="h-4 w-4" />
          <span>{offlineActive ? 'Offline' : OPEN_MAP_STYLES[styleIndex].label}</span>
        </button>
        {offlineMap && (
          <button
            type="button"
            aria-label={offlineActive ? 'Usar mapa online' : 'Usar mapa offline'}
            aria-pressed={offlineActive}
            disabled={!online}
            onClick={() => setPreferOffline((value) => !value)}
            className={`grid h-11 w-11 place-items-center rounded-xl border shadow-lg backdrop-blur disabled:opacity-80 ${
              offlineActive
                ? 'border-blue-400/50 bg-blue-500 text-white'
                : 'border-white/15 bg-slate-950/85 text-slate-300'
            }`}
          >
            <CloudOff className="h-4.5 w-4.5" />
          </button>
        )}
      </div>

      <div className="pointer-events-none absolute bottom-3 left-3 z-10 flex flex-wrap gap-2">
        <span className="rounded-full bg-slate-950/85 px-2.5 py-1 text-[9px] font-black uppercase text-blue-300 backdrop-blur">
          Azul · ruta
        </span>
        <span className="rounded-full bg-slate-950/85 px-2.5 py-1 text-[9px] font-black uppercase text-orange-300 backdrop-blur">
          Naranja · recorrido
        </span>
        {offlineMap && (
          <span className="rounded-full bg-blue-950/90 px-2.5 py-1 text-[9px] font-black uppercase text-blue-200 backdrop-blur">
            {!online
              ? 'Sin red · mapa offline'
              : preferOffline
                ? 'Mapa offline activo'
                : `Offline · ${offlineSummary?.trails ?? 0} caminos · ${offlineSummary?.pois ?? 0} puntos`}
          </span>
        )}
        {offlineActive && (offlineSummary?.water ?? 0) > 0 && (
          <span className="rounded-full bg-slate-950/85 px-2.5 py-1 text-[9px] font-black uppercase text-sky-300 backdrop-blur">
            Celeste · agua
          </span>
        )}
        {offlineActive && (offlineSummary?.pois ?? 0) > 0 && (
          <span className="rounded-full bg-slate-950/85 px-2.5 py-1 text-[9px] font-black uppercase text-amber-300 backdrop-blur">
            Puntos · refugio / fuente / acceso
          </span>
        )}
      </div>
    </div>
  );
}
