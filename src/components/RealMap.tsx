'use client';

import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { Map, Source, Layer, useMap, NavigationControl, FullscreenControl } from 'react-map-gl/mapbox';
import type { MapMouseEvent } from 'react-map-gl/mapbox';
import 'mapbox-gl/dist/mapbox-gl.css';
import { MTBTrail, TrailDifficulty } from '@/data/trails';
import { getTrailDifficultyLabel } from '@/lib/trail-utils';

const DIFFICULTY_COLORS: Record<TrailDifficulty, string> = {
  green: '#22c55e',
  blue: '#60a5fa',
  red: '#f87171',
  black: '#cbd5e1',
  'double-black': '#f1f5f9',
  unclassified: '#64748b',
};

const DEFAULT_CENTER: [number, number] = [40.622, -0.125];
const DEFAULT_ZOOM = 12;

function toGeoJSON(trail: MTBTrail): GeoJSON.Feature<GeoJSON.LineString> {
  return {
    type: 'Feature',
    geometry: {
      type: 'LineString',
      coordinates: (trail.coordinates ?? []).map(p => [p.lng, p.lat] as [number, number]),
    },
    properties: {
      trailId: trail.id,
      difficulty: trail.difficulty,
      name: trail.name,
    },
  };
}

interface RealMapProps {
  trails: MTBTrail[];
  selectedTrailId?: string | null;
  onTrailSelect?: (trailId: string | null) => void;
}

function MapController({ trails, selectedTrailId }: { trails: MTBTrail[]; selectedTrailId: string | null | undefined }) {
  const { current: mapRef } = useMap();
  const fitted = useRef(false);
  const prevSelected = useRef<string | null>(null);

  useEffect(() => {
    if (!mapRef) return;

    // Fly to selected trail
    if (selectedTrailId && selectedTrailId !== prevSelected.current) {
      const trail = trails.find(t => t.id === selectedTrailId);
      if (trail && trail.coordinates && trail.coordinates.length > 1) {
        const lats = trail.coordinates.map(p => p.lat);
        const lngs = trail.coordinates.map(p => p.lng);
        mapRef.fitBounds(
          [[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]],
          { padding: 60, maxZoom: 15, duration: 1000 },
        );
      }
      prevSelected.current = selectedTrailId;
    }
  }, [selectedTrailId, trails, mapRef]);

  // Initial fit to bounds
  useEffect(() => {
    if (fitted.current || !mapRef) return;
    const withCoords = trails.filter(t => t.coordinates && t.coordinates.length > 1);
    if (withCoords.length === 0) return;
    const lats = withCoords.flatMap(t => t.coordinates!.map(p => p.lat));
    const lngs = withCoords.flatMap(t => t.coordinates!.map(p => p.lng));
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);
    if (!isFinite(minLat)) return;
    mapRef.fitBounds(
      [[minLng, minLat], [maxLng, maxLat]],
      { padding: 40, maxZoom: 14, duration: 0 },
    );
    fitted.current = true;
  }, [trails, mapRef]);

  return null;
}

function DifficultyLegend() {
  const difficulties: TrailDifficulty[] = ['green', 'blue', 'red', 'black'];
  return (
    <div className="absolute bottom-4 left-4 z-[1000] bg-[#0a0e1a]/90 border border-white/10 rounded-lg px-3 py-2 shadow-2xl">
      <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest mb-1.5">Leyenda</p>
      <div className="space-y-1">
        {difficulties.map(d => (
          <div key={d} className="flex items-center gap-2">
            <span className="inline-block w-4 h-0.5 rounded-full" style={{ backgroundColor: DIFFICULTY_COLORS[d] }} />
            <span className="text-[10px] text-slate-400 font-bold">{getTrailDifficultyLabel(d)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function RealMap({ trails, selectedTrailId, onTrailSelect }: RealMapProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [mapStyle, setMapStyle] = useState('mapbox://styles/mapbox/outdoors-v12');

  const handleSelect = useCallback((id: string | null) => {
    onTrailSelect?.(selectedTrailId === id ? null : id);
  }, [selectedTrailId, onTrailSelect]);

  const hasPlaceholderTrails = trails.some(t => t.dataStatus === 'placeholder');

  const onClick = useCallback((e: MapMouseEvent) => {
    const feature = e.features?.[0];
    if (!feature?.properties?.trailId) return;
    handleSelect(feature.properties.trailId);
  }, [handleSelect]);

  const geoJSONFeatures = useMemo(() => trails.map(toGeoJSON), [trails]);

  const layerIds = useMemo(() => ['trails-line'], []);

  return (
    <div className="relative w-full h-[500px] lg:h-[600px] rounded-3xl overflow-hidden border border-white/5 shadow-2xl ring-1 ring-white/[0.02]">
      <Map
        mapStyle={mapStyle}
        mapboxAccessToken={process.env.NEXT_PUBLIC_MAPBOX_TOKEN}
        initialViewState={{ latitude: DEFAULT_CENTER[0], longitude: DEFAULT_CENTER[1], zoom: DEFAULT_ZOOM, pitch: 45 }}
        terrain={{ source: 'mapbox-dem', exaggeration: 1.2 }}
        interactiveLayerIds={layerIds}
        onClick={onClick}
        style={{ width: '100%', height: '100%' }}
        cursor="pointer"
      >
        <Source id="mapbox-dem" type="raster-dem" url="mapbox://mapbox.mapbox-terrain-dem-v1" />
        <Source id="trails-source" type="geojson" data={{ type: 'FeatureCollection', features: geoJSONFeatures }}>
          <Layer
            id="trails-line"
            type="line"
            source="trails-source"
            layout={{
              'line-cap': 'round',
              'line-join': 'round',
            }}
            paint={{
              'line-color': ['case',
                ['==', ['get', 'trailId'], selectedTrailId || ''], '#f97316',
                ['==', ['get', 'trailId'], hoveredId || ''], '#fbbf24',
                ['match', ['get', 'difficulty'],
                  'green', '#22c55e',
                  'blue', '#60a5fa',
                  'red', '#f87171',
                  'black', '#cbd5e1',
                  'double-black', '#f1f5f9',
                  '#64748b',
                ],
              ],
              'line-width': ['case',
                ['==', ['get', 'trailId'], selectedTrailId || ''], 6,
                ['==', ['get', 'trailId'], hoveredId || ''], 5,
                2.5,
              ],
              'line-opacity': ['case',
                ['==', ['get', 'trailId'], selectedTrailId || ''], 1,
                ['==', ['get', 'trailId'], hoveredId || ''], 1,
                0.7,
              ],
            }}
          />
        </Source>

        <NavigationControl visualizePitch={true} position="top-right" />
        <FullscreenControl position="top-right" />
        <MapController trails={trails} selectedTrailId={selectedTrailId} />
      </Map>

      <DifficultyLegend />

      {hasPlaceholderTrails && (
        <div className="absolute top-4 right-4 z-[1000] bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-lg pointer-events-none">
          Algunos senderos son datos demo
        </div>
      )}
    </div>
  );
}
