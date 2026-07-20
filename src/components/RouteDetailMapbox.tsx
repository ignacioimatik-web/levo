'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Map, {
  FullscreenControl, GeolocateControl, Layer, Marker, NavigationControl, Source,
} from 'react-map-gl/mapbox';
import type { MapRef } from 'react-map-gl/mapbox';
import { Layers3 } from 'lucide-react';
import 'mapbox-gl/dist/mapbox-gl.css';
import { useTheme } from '@/components/theme/ThemeProvider';
import useResilientMapStyle from '@/components/map/useResilientMapStyle';
import { MapProviderBadge } from '@/components/map/MapProviderBadge';
import { MAPBOX_ACCESS_TOKEN, OPEN_MAP_STYLES } from '@/lib/open-map-styles';
import { buildRouteDistanceIndex, pointAtRouteDistance } from '@/lib/route-sampling';

type RoutePoint = { lat: number; lng: number };
type SegmentOverlay = { startKm: number; endKm: number; type: 'climb' | 'descent' | 'flat' };

function routeFeature(points: RoutePoint[]) {
  return {
    type: 'Feature' as const,
    properties: {},
    geometry: {
      type: 'LineString' as const,
      coordinates: points.map((point) => [point.lng, point.lat]),
    },
  };
}

function segmentFeature(points: RoutePoint[], segment: SegmentOverlay) {
  const distanceIndex = buildRouteDistanceIndex(points);
  const start = Math.max(0, Math.min(distanceIndex.totalKm, segment.startKm));
  const end = Math.max(start, Math.min(distanceIndex.totalKm, segment.endKm));
  const coordinates: Array<[number, number]> = [[
    pointAtRouteDistance(points, distanceIndex, start).lng,
    pointAtRouteDistance(points, distanceIndex, start).lat,
  ]];
  points.forEach((point, index) => {
    const distance = distanceIndex.cumulativeKm[index];
    if (distance > start && distance < end) coordinates.push([point.lng, point.lat]);
  });
  const finish = pointAtRouteDistance(points, distanceIndex, end);
  coordinates.push([finish.lng, finish.lat]);
  return {
    type: 'Feature' as const,
    properties: { type: segment.type },
    geometry: { type: 'LineString' as const, coordinates },
  };
}

export default function RouteDetailMapbox({
  points,
  title,
  segmentOverlays = [],
}: {
  points: RoutePoint[];
  title: string;
  segmentOverlays?: SegmentOverlay[];
}) {
  const mapRef = useRef<MapRef>(null);
  const { theme } = useTheme();
  const [selectedStyleIndex, setSelectedStyleIndex] = useState<number | null>(null);
  const styleIndex = selectedStyleIndex ?? 1;
  const resilientStyle = useResilientMapStyle(styleIndex);
  const route = useMemo(() => routeFeature(points), [points]);
  const segmentRoutes = useMemo(() => ({
    type: 'FeatureCollection' as const,
    features: segmentOverlays
      .filter((segment) => segment.endKm > segment.startKm)
      .map((segment) => segmentFeature(points, segment)),
  }), [points, segmentOverlays]);
  const first = points[0];

  const fitRoute = useCallback(() => {
    if (!mapRef.current || points.length < 2) return;
    const lngs = points.map((point) => point.lng);
    const lats = points.map((point) => point.lat);
    mapRef.current.fitBounds(
      [[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]],
      { padding: 56, duration: 450, maxZoom: 15 },
    );
    mapRef.current.setPitch(48);
    mapRef.current.setBearing(18);
  }, [points]);

  useEffect(() => fitRoute(), [fitRoute]);

  if (!first || points.length < 2) {
    return (
      <div className="flex h-[min(55svh,28rem)] min-h-72 items-center justify-center rounded-2xl border border-white/5 bg-slate-900/80 text-sm font-bold text-slate-500">
        No hay un trazado GPS disponible para esta ruta.
      </div>
    );
  }

  return (
    <div className="relative h-[min(55svh,28rem)] min-h-72 overflow-hidden rounded-2xl border border-white/10 bg-slate-950 shadow-xl">
      <Map
        ref={mapRef}
        mapboxAccessToken={MAPBOX_ACCESS_TOKEN}
        initialViewState={{ longitude: first.lng, latitude: first.lat, zoom: 12, pitch: 68, bearing: 18 }}
        mapStyle={resilientStyle.mapStyle}
        terrain={MAPBOX_ACCESS_TOKEN ? { source: 'route-detail-terrain', exaggeration: 1.25 } : undefined}
        onError={resilientStyle.handleMapError}
        dragRotate
        touchPitch
        touchZoomRotate
        reuseMaps
        onLoad={fitRoute}
      >
        {MAPBOX_ACCESS_TOKEN && (
          <>
            <Source id="route-detail-terrain" type="raster-dem" url="mapbox://mapbox.mapbox-terrain-dem-v1" tileSize={512} maxzoom={14} />
            <Source id="route-detail-buildings" type="vector" url="mapbox://mapbox.mapbox-streets-v8">
              <Layer
                id="route-detail-3d-buildings"
                type="fill-extrusion"
                source="route-detail-buildings"
                source-layer="building"
                minzoom={11}
                filter={['!', ['has', 'underground']]}
                paint={{
                  'fill-extrusion-color': '#8995a6',
                  'fill-extrusion-height': ['coalesce', ['get', 'height'], 8],
                  'fill-extrusion-base': ['coalesce', ['get', 'min_height'], 0],
                  'fill-extrusion-opacity': 0.52,
                }}
              />
            </Source>
          </>
        )}
        <Source id="route-detail-line" type="geojson" data={route}>
          <Layer id="route-detail-shadow" type="line" paint={{ 'line-color': '#020617', 'line-width': 10, 'line-opacity': 0.75 }} layout={{ 'line-cap': 'round', 'line-join': 'round' }} />
          <Layer id="route-detail-color" type="line" paint={{ 'line-color': '#fb923c', 'line-width': 5 }} layout={{ 'line-cap': 'round', 'line-join': 'round' }} />
        </Source>
        {segmentRoutes.features.length > 0 && (
          <Source id="route-detail-segments" type="geojson" data={segmentRoutes}>
            <Layer
              id="route-detail-segment-colors"
              type="line"
              paint={{
                'line-color': [
                  'match',
                  ['get', 'type'],
                  'climb', '#22c55e',
                  'descent', '#ef4444',
                  '#f59e0b',
                ],
                'line-width': 6,
                'line-opacity': 0.94,
              }}
              layout={{ 'line-cap': 'round', 'line-join': 'round' }}
            />
          </Source>
        )}
        <Marker longitude={first.lng} latitude={first.lat} anchor="center">
          <span className="grid h-7 w-7 place-items-center rounded-full border-[3px] border-white bg-emerald-500 text-[9px] font-black text-slate-950 shadow-xl" aria-label={`Inicio de ${title}`}>A</span>
        </Marker>
        <Marker longitude={points.at(-1)!.lng} latitude={points.at(-1)!.lat} anchor="center">
          <span className="grid h-7 w-7 place-items-center rounded-full border-[3px] border-white bg-orange-500 text-[9px] font-black text-slate-950 shadow-xl" aria-label={`Final de ${title}`}>B</span>
        </Marker>
        <NavigationControl position="top-right" showCompass visualizePitch />
        <GeolocateControl position="top-right" positionOptions={{ enableHighAccuracy: true }} trackUserLocation />
        <FullscreenControl position="top-right" />
      </Map>
      <div className="pointer-events-none absolute left-3 top-3 z-10">
        <span className="rounded-full border border-white/15 bg-slate-950/88 px-3 py-1.5 text-[10px] font-black uppercase text-white shadow-lg backdrop-blur">{title}</span>
      </div>
      <div className="absolute bottom-3 left-3 z-10">
        <MapProviderBadge
          usingFallback={resilientStyle.usingFallback}
          providerName={resilientStyle.providerName}
          styleLabel={resilientStyle.styleLabel}
          canRetry={resilientStyle.canRetryMapbox}
          onRetry={resilientStyle.retryMapbox}
        />
      </div>
      <button
        type="button"
        aria-label={`Mapa ${OPEN_MAP_STYLES[styleIndex].label}. Cambiar estilo`}
        onClick={() => setSelectedStyleIndex((styleIndex + 1) % OPEN_MAP_STYLES.length)}
        className="absolute bottom-3 right-3 z-10 flex min-h-11 items-center gap-2 rounded-xl border border-white/15 bg-slate-950/90 px-3 text-[10px] font-black uppercase text-white shadow-xl backdrop-blur"
      >
        <Layers3 className="h-4 w-4 text-orange-400" /> {OPEN_MAP_STYLES[styleIndex].label}
      </button>
    </div>
  );
}
