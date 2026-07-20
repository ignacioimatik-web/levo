'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Map, { Layer, NavigationControl, Source } from 'react-map-gl/mapbox';
import type { MapRef, MapMouseEvent } from 'react-map-gl/mapbox';
import { Layers3 } from 'lucide-react';
import 'mapbox-gl/dist/mapbox-gl.css';
import type { MTBTrail, TrailDifficulty } from '@/data/trails';
import { MAPBOX_ACCESS_TOKEN, OPEN_MAP_STYLES } from '@/lib/open-map-styles';
import useResilientMapStyle from '@/components/map/useResilientMapStyle';
import { MapProviderBadge } from '@/components/map/MapProviderBadge';

const COLORS: Record<TrailDifficulty, string> = {
  green: '#22c55e',
  blue: '#60a5fa',
  red: '#f87171',
  black: '#cbd5e1',
  'double-black': '#f8fafc',
  unclassified: '#94a3b8',
};

function routeFeature(trail: MTBTrail) {
  return {
    type: 'Feature' as const,
    properties: { trailId: trail.id, difficulty: trail.difficulty },
    geometry: {
      type: 'LineString' as const,
      coordinates: (trail.coordinates ?? []).map((point) => [point.lng, point.lat]),
    },
  };
}

function getBounds(trails: MTBTrail[]): [[number, number], [number, number]] | null {
  const points = trails.flatMap((trail) => trail.coordinates ?? []);
  if (points.length === 0) return null;
  const lats = points.map((point) => point.lat);
  const lngs = points.map((point) => point.lng);
  return [[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]];
}

export default function RealMap({
  trails,
  selectedTrailId,
  onTrailSelect,
}: {
  trails: MTBTrail[];
  selectedTrailId?: string | null;
  onTrailSelect?: (trailId: string | null) => void;
}) {
  const mapRef = useRef<MapRef>(null);
  const [styleIndex, setStyleIndex] = useState(0);
  const resilientStyle = useResilientMapStyle(styleIndex);
  const featureCollection = useMemo(() => ({
    type: 'FeatureCollection' as const,
    features: trails.filter((trail) => (trail.coordinates?.length ?? 0) > 1).map(routeFeature),
  }), [trails]);
  const bounds = useMemo(() => getBounds(trails), [trails]);
  const firstPoint = trails.find((trail) => trail.coordinates?.length)?.coordinates?.[0];

  const fitBounds = useCallback(() => {
    if (!mapRef.current || !bounds) return;
    mapRef.current.fitBounds(bounds, { padding: 48, maxZoom: 14, duration: 450 });
    mapRef.current.setPitch(42);
    mapRef.current.setBearing(18);
  }, [bounds]);

  useEffect(() => {
    fitBounds();
  }, [fitBounds]);

  const handleClick = useCallback((event: MapMouseEvent) => {
    const trailId = event.features?.[0]?.properties?.trailId as string | undefined;
    if (!trailId) return;
    onTrailSelect?.(trailId === selectedTrailId ? null : trailId);
  }, [onTrailSelect, selectedTrailId]);

  if (!firstPoint || featureCollection.features.length === 0) {
    return (
      <div className="flex h-[min(55svh,34rem)] min-h-72 items-center justify-center rounded-3xl border border-white/5 bg-slate-900/80 text-sm font-bold text-slate-500">
        No hay trazados GPS disponibles todavía.
      </div>
    );
  }

  return (
    <div className="relative h-[min(55svh,34rem)] min-h-72 overflow-hidden rounded-3xl border border-white/10 bg-slate-950 shadow-2xl">
      <Map
        ref={mapRef}
        mapboxAccessToken={MAPBOX_ACCESS_TOKEN}
        initialViewState={{ longitude: firstPoint.lng, latitude: firstPoint.lat, zoom: 12, pitch: 42, bearing: 18 }}
        mapStyle={resilientStyle.mapStyle}
        terrain={MAPBOX_ACCESS_TOKEN ? { source: 'route-library-terrain', exaggeration: 1.25 } : undefined}
        interactiveLayerIds={['route-library-lines']}
        onClick={handleClick}
        onLoad={fitBounds}
        onError={resilientStyle.handleMapError}
        dragRotate
        touchPitch
        touchZoomRotate
        reuseMaps
      >
        {MAPBOX_ACCESS_TOKEN && (
          <Source id="route-library-terrain" type="raster-dem" url="mapbox://mapbox.mapbox-terrain-dem-v1" tileSize={512} maxzoom={14} />
        )}
        <Source id="route-library-routes" type="geojson" data={featureCollection}>
          <Layer
            id="route-library-shadow"
            type="line"
            paint={{ 'line-color': '#020617', 'line-width': ['case', ['==', ['get', 'trailId'], selectedTrailId ?? ''], 11, 8], 'line-opacity': 0.72 }}
            layout={{ 'line-cap': 'round', 'line-join': 'round' }}
          />
          <Layer
            id="route-library-lines"
            type="line"
            paint={{
              'line-color': ['match', ['get', 'difficulty'], 'green', COLORS.green, 'blue', COLORS.blue, 'red', COLORS.red, 'black', COLORS.black, 'double-black', COLORS['double-black'], COLORS.unclassified],
              'line-width': ['case', ['==', ['get', 'trailId'], selectedTrailId ?? ''], 6, 3.5],
              'line-opacity': 0.92,
            }}
            layout={{ 'line-cap': 'round', 'line-join': 'round' }}
          />
        </Source>
        <NavigationControl position="top-right" showCompass visualizePitch />
      </Map>
      <div className="pointer-events-none absolute left-3 top-3 z-10">
        <span className="rounded-full border border-white/15 bg-slate-950/88 px-3 py-1.5 text-[10px] font-black uppercase text-white shadow-lg backdrop-blur">
          Mapbox · terreno 3D
        </span>
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
        onClick={() => setStyleIndex((current) => (current + 1) % OPEN_MAP_STYLES.length)}
        className="absolute bottom-3 right-3 z-10 flex min-h-11 items-center gap-2 rounded-xl border border-white/15 bg-slate-950/90 px-3 text-[10px] font-black uppercase text-white shadow-xl backdrop-blur"
      >
        <Layers3 className="h-4 w-4 text-orange-400" /> {OPEN_MAP_STYLES[styleIndex].label}
      </button>
    </div>
  );
}
