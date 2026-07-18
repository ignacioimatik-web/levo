'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Map, {
  FullscreenControl, GeolocateControl, Layer, Marker, NavigationControl, Source,
} from 'react-map-gl/maplibre';
import type { MapRef } from 'react-map-gl/maplibre';
import { Layers3 } from 'lucide-react';
import 'maplibre-gl/dist/maplibre-gl.css';
import PlaceSearch from '@/components/planner/PlaceSearch';
import type { GeocodingResult } from '@/lib/geocoding';
import type { PlannedRoutePoint } from '@/lib/navigation/types';
import { OPEN_MAP_STYLES } from '@/lib/open-map-styles';
import { useTheme } from '@/components/theme/ThemeProvider';

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

export default function UniversalRouteMap({
  points,
  controlPoints,
  drawing,
  onAddPoint,
}: {
  points: PlannedRoutePoint[];
  controlPoints: PlannedRoutePoint[];
  drawing: boolean;
  onAddPoint: (point: PlannedRoutePoint) => void;
}) {
  const mapRef = useRef<MapRef>(null);
  const { theme } = useTheme();
  const [selectedStyleIndex, setSelectedStyleIndex] = useState<number | null>(null);
  const styleIndex = selectedStyleIndex ?? (theme === 'dark' ? 2 : 0);
  const route = useMemo(() => routeFeature(points), [points]);

  const showPlace = (result: GeocodingResult) => {
    if (result.boundingBox) {
      const [west, south, east, north] = result.boundingBox;
      mapRef.current?.fitBounds([[west, south], [east, north]], {
        padding: 72,
        duration: 650,
        maxZoom: 15,
      });
      return;
    }
    mapRef.current?.flyTo({
      center: [result.longitude, result.latitude],
      zoom: 13,
      duration: 650,
    });
  };

  const usePlaceAsPoint = (result: GeocodingResult) => {
    showPlace(result);
    onAddPoint({
      latitude: result.latitude,
      longitude: result.longitude,
      elevation: null,
    });
  };

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

  return (
    <div className="relative h-full">
      <Map
      ref={mapRef}
      initialViewState={{ longitude: -3.7, latitude: 40.25, zoom: 5.4 }}
      mapStyle={OPEN_MAP_STYLES[styleIndex].style}
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
      {controlPoints.map((point, index) => {
        const first = index === 0;
        const last = index === controlPoints.length - 1;
        return (
          <Marker
            key={`${point.longitude}-${point.latitude}-${index}`}
            longitude={point.longitude}
            latitude={point.latitude}
            anchor="center"
          >
            <span
              className={`grid place-items-center rounded-full border-[3px] border-white font-black text-slate-950 shadow-xl ${
                first
                  ? 'h-7 w-7 bg-emerald-500 text-[9px]'
                  : last
                    ? 'h-7 w-7 bg-orange-500 text-[9px]'
                    : 'h-5 w-5 bg-blue-400 text-[7px]'
              }`}
              aria-label={first ? 'Inicio' : last ? 'Final' : `Control ${index + 1}`}
            >
              {first ? 'A' : last ? 'B' : index + 1}
            </span>
          </Marker>
        );
      })}
      <NavigationControl position="top-right" showCompass visualizePitch />
      <GeolocateControl
        position="top-right"
        positionOptions={{ enableHighAccuracy: true }}
        trackUserLocation
      />
      <FullscreenControl position="top-right" />
      </Map>
      <div className="pointer-events-none absolute left-3 top-3 z-10">
        <PlaceSearch onSelect={showPlace} onUseAsStart={usePlaceAsPoint} />
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
