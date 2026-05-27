'use client';

import { useRef, useEffect, useMemo, useCallback, useState, Fragment } from 'react';
import { Map, Source, Layer, useMap, useControl, NavigationControl, FullscreenControl, Marker } from 'react-map-gl/mapbox';
import type { MapMouseEvent } from 'react-map-gl/mapbox';
import 'mapbox-gl/dist/mapbox-gl.css';
import type { TrackMTB, TrackPoint, RutaConstruida } from '@/lib/forfait/types';

function distM(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371000;
  const dLat = (b.lat - a.lat) * Math.PI / 180;
  const dLng = (b.lng - a.lng) * Math.PI / 180;
  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);
  const h = sinDLat * sinDLat + Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * sinDLng * sinDLng;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function interpolarPuntoEnRuta(points: TrackPoint[], targetKm: number): { lat: number; lng: number } | null {
  if (points.length < 2) return null;
  const cums: number[] = [0];
  for (let i = 1; i < points.length; i++) {
    cums.push(cums[i - 1] + distM(points[i - 1], points[i]) / 1000);
  }
  const totalKm = cums[cums.length - 1];
  const clampedKm = Math.max(0, Math.min(targetKm, totalKm));
  for (let i = 1; i < points.length; i++) {
    const aKm = cums[i - 1];
    const bKm = cums[i];
    if (clampedKm >= aKm && clampedKm <= bKm) {
      const t = (bKm - aKm) > 0 ? (clampedKm - aKm) / (bKm - aKm) : 0;
      return {
        lat: points[i - 1].lat + (points[i].lat - points[i - 1].lat) * t,
        lng: points[i - 1].lng + (points[i].lng - points[i - 1].lng) * t,
      };
    }
  }
  return { lat: points[points.length - 1].lat, lng: points[points.length - 1].lng };
}

const DIFICULTAD_COLORS: Record<string, string> = {
  verde: '#009988',
  azul: '#0077BB',
  rojo: '#EE7733',
  negro: '#222222',
  'doble-negro': '#000000',
};

const ESTADO_DASH: Record<string, number[] | undefined> = {
  abierto: undefined,
  cerrado: [6, 6],
  precaucion: [4, 4],
  revision: [8, 4, 2, 4],
};

function toLngLat(points: TrackPoint[]): [number, number][] {
  return points.map(p => [p.lng, p.lat] as [number, number]);
}

function FitBounds({ tracks, routePoints }: { tracks: TrackMTB[]; routePoints: TrackPoint[] }) {
  const { current: mapRef } = useMap();
  const fitted = useRef(false);

  useEffect(() => {
    if (fitted.current || !mapRef) return;
    const allPoints = routePoints.length > 0 ? routePoints : tracks.flatMap(t => t.points);
    if (!allPoints.length) return;
    const lats = allPoints.map(p => p.lat);
    const lngs = allPoints.map(p => p.lng);
    mapRef.fitBounds(
      [[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]],
      { padding: 40 },
    );
    fitted.current = true;
  }, [tracks, routePoints, mapRef]);

  return null;
}

function FlyToTrack({ track }: { track: TrackMTB | null }) {
  const { current: mapRef } = useMap();

  useEffect(() => {
    if (!track || !track.points.length || !mapRef) return;
    const lats = track.points.map(p => p.lat);
    const lngs = track.points.map(p => p.lng);
    mapRef.fitBounds(
      [[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]],
      { padding: 50 },
    );
  }, [track, mapRef]);

  return null;
}

function PitchToggle() {
  const { current: map } = useMap();
  const [flat, setFlat] = useState(false);
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const first = useRef(true);

  useEffect(() => {
    if (first.current) { first.current = false; return; }
    if (!map) return;
    map.easeTo({ pitch: flat ? 0 : 40, duration: 300 });
    if (btnRef.current) {
      btnRef.current.querySelector('span')!.textContent = flat ? '3D' : '2D';
    }
  }, [flat, map]);

  useControl(() => ({
    onAdd() {
      const div = document.createElement('div');
      div.className = 'mapboxgl-ctrl mapboxgl-ctrl-group';
      div.innerHTML = `<button class="mapboxgl-ctrl-icon" type="button"
        style="width:29px;height:29px;display:flex;align-items:center;justify-content:center;cursor:pointer;background:#1e293b;border-radius:4px"
        aria-label="Alternar 3D">
        <span style="font-size:11px;font-weight:700;color:#f97316">2D</span>
      </button>`;
      (div.querySelector('button') as HTMLButtonElement).onclick = () => setFlat(p => !p);
      btnRef.current = div.querySelector('button');
      return div;
    },
    onRemove() {
      btnRef.current = null;
    }
  }), { position: 'top-right' });

  return null;
}

const MAP_STYLES = [
  { id: 'satellite', label: 'Satélite', url: 'mapbox://styles/mapbox/satellite-streets-v12' },
  { id: 'outdoors', label: 'Topo', url: 'mapbox://styles/mapbox/outdoors-v12' },
  { id: 'dark', label: 'Oscuro', url: 'mapbox://styles/mapbox/dark-v11' },
];

function StyleSwitcher({ current, onChange }: { current: string; onChange: (url: string) => void }) {
  return (
    <div className="mapboxgl-ctrl mapboxgl-ctrl-group flex flex-col">
      {MAP_STYLES.map(s => (
        <button
          key={s.id}
          onClick={() => onChange(s.url)}
          className="mapboxgl-ctrl-icon"
          style={{
            width: 32, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', background: current === s.url ? '#1e293b' : '#0f172a',
            borderBottom: '1px solid rgba(255,255,255,0.06)', fontSize: 10, fontWeight: 700,
            color: current === s.url ? '#f97316' : '#94a3b8',
          }}
          title={s.label}
        >
          {s.label}
        </button>
      ))}
    </div>
  );
}

export default function MTBMap({
  tracks,
  selectedTrackIds,
  previewTrackIds = [],
  hoveredTrackId = null,
  fitToTrackId = null,
  recommendedIds,
  cautionIds,
  notRecommendedIds,
  builtRoute,
  hoveredRouteKm,
  onTrackClick,
}: {
  tracks: TrackMTB[];
  selectedTrackIds: string[];
  previewTrackIds: string[];
  hoveredTrackId: string | null;
  fitToTrackId: string | null;
  recommendedIds: string[];
  cautionIds: string[];
  notRecommendedIds: string[];
  builtRoute: RutaConstruida | null;
  hoveredRouteKm: number | null;
  onTrackClick: (track: TrackMTB) => void;
}) {
  const [mapStyle, setMapStyle] = useState(MAP_STYLES[0].url);
  const hasSelection = selectedTrackIds.length > 0 || previewTrackIds.length > 0;
  const fitTrack = fitToTrackId ? tracks.find(t => t.id === fitToTrackId) || null : null;

  const lineLayerIds = useMemo(() => tracks.map(t => `track-line-${t.id}`), [tracks]);

  const onClick = useCallback((e: MapMouseEvent) => {
    const feature = e.features?.[0];
    if (!feature) return;
    const trackId = feature.properties?.trackId;
    if (!trackId) return;
    const track = tracks.find(t => t.id === trackId);
    if (track) onTrackClick(track);
  }, [tracks, onTrackClick]);

  return (
    <Map
      mapStyle={mapStyle}
      mapboxAccessToken={process.env.NEXT_PUBLIC_MAPBOX_TOKEN}
      initialViewState={{ latitude: 40.6, longitude: -0.02, zoom: 13, pitch: 40 }}
      terrain={{ source: 'mapbox-dem', exaggeration: 1.0 }}
      interactiveLayerIds={lineLayerIds}
      onClick={onClick}
      style={{ width: '100%', height: '100%', borderRadius: '12px', overflow: 'hidden' }}
    >
      <Source id="mapbox-dem" type="raster-dem" url="mapbox://mapbox.mapbox-terrain-dem-v1" />

      <NavigationControl visualizePitch={true} position="top-right" />
      <FullscreenControl position="top-right" />
      <PitchToggle />
      <div className="absolute top-2 left-2 z-10">
        <StyleSwitcher current={mapStyle} onChange={setMapStyle} />
      </div>

      <FitBounds tracks={tracks} routePoints={builtRoute?.pointsCombinados ?? []} />
      <FlyToTrack track={fitTrack} />

      {tracks.flatMap(track => {
        const isInRoute = selectedTrackIds.includes(track.id);
        const isPreview = previewTrackIds.includes(track.id) && !isInRoute;
        const isHovered = hoveredTrackId === track.id;
        const isRecommended = recommendedIds.includes(track.id);
        const isCaution = cautionIds.includes(track.id);
        const isNotRec = notRecommendedIds.includes(track.id);
        const isClosed = track.estado === 'cerrado';
        const isAttenuated = hasSelection && !isInRoute && !isPreview && !isHovered;

        let color = DIFICULTAD_COLORS[track.dificultad] || '#64748b';
        let weight = 3;
        let opacity = 1;
        let dashArray: number[] | undefined;

        if (isClosed) { color = '#64748b'; opacity = 0.35; dashArray = [6, 6]; }
        else if (isNotRec) { color = '#CC3311'; opacity = 0.45; }
        else if (isAttenuated) { opacity = 0.2; }
        else if (isHovered) { weight = 5; opacity = 0.9; }
        else if (isCaution) { color = '#EE7733'; weight = 4; }
        else if (isRecommended) { color = '#009988'; weight = 4; }
        else if (isInRoute) { color = '#0077BB'; weight = 5; }
        else if (isPreview) { opacity = 0.7; weight = 4; dashArray = [8, 4]; }

        if (!dashArray && ESTADO_DASH[track.estado]) {
          dashArray = ESTADO_DASH[track.estado];
        }

        const lineCoords = toLngLat(track.points);

        return (
          <Fragment key={track.id}>
            <Source id={`track-source-${track.id}`} type="geojson" data={{
              type: 'Feature',
              geometry: { type: 'LineString', coordinates: lineCoords },
              properties: { trackId: track.id },
            }}>
              <Layer
                id={`track-glow-${track.id}`}
                type="line"
                source={`track-source-${track.id}`}
                paint={{
                  'line-color': '#ffffff',
                  'line-width': 8,
                  'line-opacity': isHovered ? 0.12 : 0,
                }}
              />
              <Layer
                id={`track-preview-${track.id}`}
                type="line"
                source={`track-source-${track.id}`}
                paint={{
                  'line-color': '#ffffff',
                  'line-width': 6,
                  'line-opacity': isPreview ? 0.15 : 0,
                }}
              />
              <Layer
                id={`track-line-${track.id}`}
                type="line"
                source={`track-source-${track.id}`}
                paint={{
                  'line-color': color,
                  'line-width': weight,
                  'line-opacity': opacity,
                  ...(dashArray ? { 'line-dasharray': dashArray } : {}),
                }}
              />
            </Source>
            <Source id={`track-start-${track.id}`} type="geojson" data={{
              type: 'Feature',
              geometry: { type: 'Point', coordinates: [track.startPoint.lng, track.startPoint.lat] },
              properties: { trackId: track.id },
            }}>
              <Layer
                id={`track-start-${track.id}`}
                type="circle"
                source={`track-start-${track.id}`}
                paint={{
                  'circle-color': '#009988',
                  'circle-radius': isInRoute ? 5 : isPreview ? 4 : 3,
                  'circle-opacity': 0.8,
                  'circle-stroke-color': '#009988',
                  'circle-stroke-width': 1,
                }}
              />
            </Source>
            <Source id={`track-end-${track.id}`} type="geojson" data={{
              type: 'Feature',
              geometry: { type: 'Point', coordinates: [track.endPoint.lng, track.endPoint.lat] },
              properties: { trackId: track.id },
            }}>
              <Layer
                id={`track-end-${track.id}`}
                type="circle"
                source={`track-end-${track.id}`}
                paint={{
                  'circle-color': '#CC3311',
                  'circle-radius': isInRoute ? 5 : isPreview ? 4 : 3,
                  'circle-opacity': 0.8,
                  'circle-stroke-color': '#CC3311',
                  'circle-stroke-width': 1,
                }}
              />
            </Source>
          </Fragment>
        );
      })}

      {builtRoute && builtRoute.pointsCombinados.length > 0 && (
        <Source id="built-route-source" type="geojson" data={{
          type: 'Feature',
          geometry: { type: 'LineString', coordinates: toLngLat(builtRoute.pointsCombinados) },
          properties: null,
        }}>
          <Layer
            id="built-route-line"
            type="line"
            source="built-route-source"
            paint={{
              'line-color': '#0077BB',
              'line-width': 5,
              'line-opacity': 0.8,
            }}
          />
        </Source>
      )}

      {hoveredRouteKm !== null && builtRoute && (() => {
        const pt = interpolarPuntoEnRuta(builtRoute.pointsCombinados, hoveredRouteKm);
        if (!pt) return null;
        return (
          <Marker longitude={pt.lng} latitude={pt.lat} anchor="center">
            <div style={{
              width: 14,
              height: 14,
              borderRadius: '50%',
              background: '#f97316',
              border: '3px solid #fff',
              boxShadow: '0 0 8px rgba(249,115,22,0.6)',
              pointerEvents: 'none',
            }} />
          </Marker>
        );
      })()}
    </Map>
  );
}
