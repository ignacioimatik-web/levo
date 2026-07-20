'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Map, { FullscreenControl, GeolocateControl, Layer, Marker, NavigationControl, Source } from 'react-map-gl/mapbox';
import type { MapRef } from 'react-map-gl/mapbox';
import 'mapbox-gl/dist/mapbox-gl.css';
import type { RidePoint } from '@/lib/activities/types';
import { MapPinned } from 'lucide-react';
import { MAPBOX_ACCESS_TOKEN, OPEN_MAP_STYLES } from '@/lib/open-map-styles';
import useResilientMapStyle from '@/components/map/useResilientMapStyle';
import { MapProviderBadge } from '@/components/map/MapProviderBadge';

function SchematicMap({ points }: { points: RidePoint[] }) {
  const path = useMemo(() => {
    const minLat = Math.min(...points.map((point) => point.latitude));
    const maxLat = Math.max(...points.map((point) => point.latitude));
    const minLng = Math.min(...points.map((point) => point.longitude));
    const maxLng = Math.max(...points.map((point) => point.longitude));
    const latRange = Math.max(maxLat - minLat, 0.0001);
    const lngRange = Math.max(maxLng - minLng, 0.0001);
    return points.map((point, index) => {
      const x = 5 + (point.longitude - minLng) / lngRange * 90;
      const y = 95 - (point.latitude - minLat) / latRange * 90;
      return `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`;
    }).join(' ');
  }, [points]);

  return (
    <div className="relative h-full bg-[radial-gradient(circle_at_top,#334155,#020617_70%)]">
      <div className="absolute inset-0 opacity-20 [background-image:linear-gradient(#94a3b8_1px,transparent_1px),linear-gradient(90deg,#94a3b8_1px,transparent_1px)] [background-size:32px_32px]" />
      <svg viewBox="0 0 100 100" className="relative h-full w-full p-8" role="img" aria-label="Trazado de la actividad">
        <path d={path} fill="none" stroke="#fb923c" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span className="absolute bottom-3 left-3 flex items-center gap-1.5 rounded-full bg-slate-950/80 px-3 py-1.5 text-[10px] font-bold text-slate-300">
        <MapPinned className="h-3.5 w-3.5 text-orange-400" /> Mapa esquemático
      </span>
    </div>
  );
}

export default function ActivityMap({ points }: { points: RidePoint[] }) {
  const mapRef = useRef<MapRef>(null);
  const [mapFailed, setMapFailed] = useState(false);
  const [styleIndex, setStyleIndex] = useState(0);
  const resilientStyle = useResilientMapStyle(styleIndex);
  const route = useMemo(() => ({
    type: 'Feature' as const,
    properties: {},
    geometry: {
      type: 'LineString' as const,
      coordinates: points.map((point) => [point.longitude, point.latitude]),
    },
  }), [points]);

  useEffect(() => {
    if (!mapRef.current || points.length < 2) return;
    const lngs = points.map((point) => point.longitude);
    const lats = points.map((point) => point.latitude);
    mapRef.current.fitBounds(
      [[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]],
      { padding: 48, duration: 0, pitch: 46, bearing: 18 },
    );
  }, [points]);

  if (points.length < 2) {
    return (
      <div className="grid h-full place-items-center bg-slate-900 text-center text-sm text-slate-500">
        No hay suficientes puntos GPS para dibujar el recorrido.
      </div>
    );
  }

  if (mapFailed) return <SchematicMap points={points} />;

  return (
    <Map
      ref={mapRef}
      mapboxAccessToken={MAPBOX_ACCESS_TOKEN}
      initialViewState={{
        longitude: points[0].longitude,
        latitude: points[0].latitude,
        zoom: 12,
        pitch: 46,
        bearing: 18,
      }}
      mapStyle={resilientStyle.mapStyle}
      onLoad={({ target }) => {
        if (resilientStyle.usingFallback || target.getSource('activity-terrain')) return;
        target.addSource('activity-terrain', {
          type: 'raster-dem',
          url: 'mapbox://mapbox.mapbox-terrain-dem-v1',
          tileSize: 512,
          maxzoom: 14,
        });
        target.setTerrain({ source: 'activity-terrain', exaggeration: 1.15 });
        if (target.getSource('composite') && !target.getLayer('activity-3d-buildings')) {
          target.addLayer({
            id: 'activity-3d-buildings',
            source: 'composite',
            'source-layer': 'building',
            type: 'fill-extrusion',
            minzoom: 14,
            paint: {
              'fill-extrusion-color': '#64748b',
              'fill-extrusion-height': ['coalesce', ['get', 'height'], 0],
              'fill-extrusion-base': ['coalesce', ['get', 'min_height'], 0],
              'fill-extrusion-opacity': 0.52,
            },
          });
        }
      }}
      onError={event => {
        if (resilientStyle.usingFallback) {
          setMapFailed(true);
          return;
        }
        resilientStyle.handleMapError(event);
      }}
    >
      <Source id="activity-route" type="geojson" data={route}>
        <Layer
          id="activity-route-shadow"
          type="line"
          paint={{ 'line-color': '#020617', 'line-width': 8, 'line-opacity': 0.6 }}
          layout={{ 'line-cap': 'round', 'line-join': 'round' }}
        />
        <Layer
          id="activity-route-line"
          type="line"
          paint={{ 'line-color': '#fb923c', 'line-width': 5 }}
          layout={{ 'line-cap': 'round', 'line-join': 'round' }}
        />
      </Source>
      <Marker longitude={points[0].longitude} latitude={points[0].latitude} anchor="center">
        <span className="grid h-5 w-5 place-items-center rounded-full border-2 border-white bg-emerald-500 shadow-lg" aria-label="Inicio" />
      </Marker>
      <Marker longitude={points.at(-1)!.longitude} latitude={points.at(-1)!.latitude} anchor="center">
        <span className="grid h-5 w-5 place-items-center rounded-full border-2 border-white bg-orange-500 shadow-lg" aria-label="Final" />
      </Marker>
      <NavigationControl position="top-right" showCompass visualizePitch />
      <GeolocateControl position="top-right" trackUserLocation />
      <FullscreenControl position="top-right" />
      <div className="absolute left-3 top-3 z-10 flex gap-1 rounded-xl border border-white/10 bg-slate-950/85 p-1 backdrop-blur">
        {OPEN_MAP_STYLES.map((option, index) => (
          <button
            key={option.label}
            type="button"
            onClick={() => { setMapFailed(false); setStyleIndex(index); }}
            className={`rounded-lg px-2.5 py-2 text-[9px] font-black uppercase tracking-wide transition ${styleIndex === index ? 'bg-orange-500 text-white' : 'text-slate-300 hover:bg-white/10'}`}
            aria-label={`Mapa ${option.label}`}
            aria-pressed={styleIndex === index}
          >
            {option.label}
          </button>
        ))}
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
    </Map>
  );
}
