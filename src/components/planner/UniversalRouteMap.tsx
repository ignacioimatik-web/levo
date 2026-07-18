'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Map, {
  FullscreenControl, GeolocateControl, Layer, Marker, NavigationControl, Source,
} from 'react-map-gl/mapbox';
import type { MapRef } from 'react-map-gl/mapbox';
import { Layers3, MapPinned } from 'lucide-react';
import 'mapbox-gl/dist/mapbox-gl.css';
import type { PlannedRoutePoint } from '@/lib/navigation/types';

function routeFeature(points: PlannedRoutePoint[]) {
  return {
    type: 'Feature' as const,
    properties: {},
    geometry: {
      type: 'LineString' as const,
      coordinates: points.map((point) => [point.longitude, point.latitude]),
    },
  };
}

const MAP_STYLES = [
  { label: 'Topo', url: 'mapbox://styles/mapbox/outdoors-v12' },
  { label: 'Satélite', url: 'mapbox://styles/mapbox/satellite-streets-v12' },
  { label: 'Oscuro', url: 'mapbox://styles/mapbox/dark-v11' },
] as const;

export default function UniversalRouteMap({
  points,
  drawing,
  onAddPoint,
}: {
  points: PlannedRoutePoint[];
  drawing: boolean;
  onAddPoint: (point: PlannedRoutePoint) => void;
}) {
  const mapRef = useRef<MapRef>(null);
  const [styleIndex, setStyleIndex] = useState(0);
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  const route = useMemo(() => routeFeature(points), [points]);

  useEffect(() => {
    if (!mapRef.current || points.length < 2) return;
    const lngs = points.map((point) => point.longitude);
    const lats = points.map((point) => point.latitude);
    const fit = () => mapRef.current?.fitBounds(
      [[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]],
      { padding: 56, duration: 450, maxZoom: 15 },
    );
    if (mapRef.current.isStyleLoaded()) fit();
    else mapRef.current.once('load', fit);
  }, [points]);

  if (!token) {
    return (
      <div className="grid h-full place-items-center bg-slate-900 px-8 text-center">
        <div>
          <MapPinned className="mx-auto h-9 w-9 text-orange-400" />
          <p className="mt-3 font-black">Mapbox no está configurado</p>
          <p className="mt-1 text-xs text-slate-500">Todavía puedes importar un GPX y analizarlo.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-full">
      <Map
      ref={mapRef}
      mapboxAccessToken={token}
      initialViewState={{ longitude: -3.7, latitude: 40.25, zoom: 5.4 }}
      mapStyle={MAP_STYLES[styleIndex].url}
      attributionControl={false}
      cursor={drawing ? 'crosshair' : 'grab'}
      onClick={(event) => {
        if (!drawing) return;
        onAddPoint({
          latitude: event.lngLat.lat,
          longitude: event.lngLat.lng,
          elevation: null,
        });
      }}
      touchPitch
      touchZoomRotate
      dragRotate
      reuseMaps
    >
      {points.length > 1 && (
        <Source id="custom-route-line" type="geojson" data={route}>
          <Layer
            id="custom-route-shadow"
            type="line"
            paint={{ 'line-color': '#020617', 'line-width': 10, 'line-opacity': 0.75 }}
            layout={{ 'line-cap': 'round', 'line-join': 'round' }}
          />
          <Layer
            id="custom-route-color"
            type="line"
            paint={{ 'line-color': '#fb923c', 'line-width': 5 }}
            layout={{ 'line-cap': 'round', 'line-join': 'round' }}
          />
        </Source>
      )}
      {points[0] && (
        <Marker longitude={points[0].longitude} latitude={points[0].latitude} anchor="center">
          <span className="grid h-6 w-6 place-items-center rounded-full border-[3px] border-white bg-emerald-500 text-[8px] font-black text-slate-950 shadow-xl" aria-label="Inicio">A</span>
        </Marker>
      )}
      {points.length > 1 && (
        <Marker longitude={points.at(-1)!.longitude} latitude={points.at(-1)!.latitude} anchor="center">
          <span className="grid h-6 w-6 place-items-center rounded-full border-[3px] border-white bg-orange-500 text-[8px] font-black text-slate-950 shadow-xl" aria-label="Final">B</span>
        </Marker>
      )}
      <NavigationControl position="top-right" showCompass visualizePitch />
      <GeolocateControl
        position="top-right"
        positionOptions={{ enableHighAccuracy: true }}
        trackUserLocation
        showUserHeading
      />
      <FullscreenControl position="top-right" />
      </Map>
      <button
        type="button"
        aria-label={`Mapa ${MAP_STYLES[styleIndex].label}. Cambiar estilo`}
        onClick={() => setStyleIndex((index) => (index + 1) % MAP_STYLES.length)}
        className="absolute bottom-3 right-3 z-10 flex min-h-11 items-center gap-2 rounded-xl border border-white/15 bg-slate-950/90 px-3 text-[10px] font-black uppercase text-white shadow-xl backdrop-blur"
      >
        <Layers3 className="h-4 w-4 text-orange-400" /> {MAP_STYLES[styleIndex].label}
      </button>
    </div>
  );
}
