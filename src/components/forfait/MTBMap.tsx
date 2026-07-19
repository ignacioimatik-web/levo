'use client';

import { useRef, useEffect, useMemo, useCallback, useState, Fragment } from 'react';
import { Map, Source, Layer, useMap, useControl, NavigationControl, FullscreenControl, Marker } from 'react-map-gl/mapbox';
import type { MapMouseEvent } from 'react-map-gl/mapbox';
import 'mapbox-gl/dist/mapbox-gl.css';
import type { TrackMTB, TrackPoint, RutaConstruida } from '@/lib/forfait/types';
import type { RouteHoverData } from '@/components/forfait/ContinuousProfile';
import { MapPinned } from 'lucide-react';
import { MAPBOX_ACCESS_TOKEN, OPEN_MAP_STYLES } from '@/lib/open-map-styles';
import useResilientMapStyle from '@/components/map/useResilientMapStyle';

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
    const fit = () => {
      mapRef.fitBounds(
        [[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]],
        { padding: 40 },
      );
      fitted.current = true;
    };
    if (mapRef.isStyleLoaded()) fit();
    else mapRef.once('load', fit);
    return () => { mapRef.off('load', fit); };
  }, [tracks, routePoints, mapRef]);

  return null;
}

function FlyToTrack({ track }: { track: TrackMTB | null }) {
  const { current: mapRef } = useMap();

  useEffect(() => {
    if (!track || !track.points.length || !mapRef) return;
    const lats = track.points.map(p => p.lat);
    const lngs = track.points.map(p => p.lng);
    const fit = () => mapRef.fitBounds(
        [[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]],
        { padding: 50 },
      );
    if (mapRef.isStyleLoaded()) fit();
    else mapRef.once('load', fit);
    return () => { mapRef.off('load', fit); };
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

function StyleSwitcherControl({ current, onChange }: { current: number; onChange: (styleIndex: number) => void }) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  useControl(() => ({
    onAdd() {
      const div = document.createElement('div');
      div.className = 'mapboxgl-ctrl mapboxgl-ctrl-group';
      div.style.position = 'relative';
      div.innerHTML = `<button class="mapboxgl-ctrl-icon" type="button"
        style="width:29px;height:29px;display:flex;align-items:center;justify-content:center;cursor:pointer;background:#1e293b"
        aria-label="Cambiar estilo de mapa">
        <span style="font-size:14px;font-weight:700;color:#f97316">🗺</span>
      </button>`;
      (div.querySelector('button') as HTMLButtonElement).onclick = () => setOpen(p => !p);
      btnRef.current = div.querySelector('button');

      const panel = document.createElement('div');
      panel.style.cssText = 'position:absolute;top:0;right:34px;display:none;flex-direction:column;background:#0f172a;border:1px solid rgba(255,255,255,0.1);border-radius:4px;overflow:hidden';
      OPEN_MAP_STYLES.forEach((s, styleIndex) => {
        const b = document.createElement('button');
        b.textContent = s.label;
        b.style.cssText = 'padding:6px 10px;font-size:10px;font-weight:700;cursor:pointer;border:none;border-bottom:1px solid rgba(255,255,255,0.06);color:#94a3b8;background:transparent;text-align:left;white-space:nowrap';
        b.onmouseenter = () => { b.style.background = '#1e293b'; };
        b.onmouseleave = () => { b.style.background = 'transparent'; };
        b.onclick = () => { onChange(styleIndex); setOpen(false); };
        panel.appendChild(b);
      });
      div.appendChild(panel);
      panelRef.current = panel;

      document.addEventListener('click', (e: MouseEvent) => {
        if (!div.contains(e.target as Node)) setOpen(false);
      });

      return div;
    },
    onRemove() { btnRef.current = null; panelRef.current = null; }
  }), { position: 'top-right' });

  useEffect(() => {
    if (!panelRef.current) return;
    panelRef.current.style.display = open ? 'flex' : 'none';
    if (open) {
      const btns = panelRef.current.querySelectorAll('button');
      OPEN_MAP_STYLES.forEach((_, i) => {
        (btns[i] as HTMLButtonElement).style.color = i === current ? '#f97316' : '#94a3b8';
      });
    }
  }, [open, current]);

  return null;
}

function BasicTrackMap({
  tracks,
  selectedTrackIds,
  builtRoute,
}: {
  tracks: TrackMTB[];
  selectedTrackIds: string[];
  builtRoute: RutaConstruida | null;
}) {
  const allPoints = tracks.flatMap(track => track.points);
  if (allPoints.length === 0) {
    return (
      <div className="flex h-full items-center justify-center bg-slate-950 text-sm text-slate-500">
        No hay geometría disponible.
      </div>
    );
  }

  const minLat = Math.min(...allPoints.map(point => point.lat));
  const maxLat = Math.max(...allPoints.map(point => point.lat));
  const minLng = Math.min(...allPoints.map(point => point.lng));
  const maxLng = Math.max(...allPoints.map(point => point.lng));
  const latRange = Math.max(maxLat - minLat, 0.001);
  const lngRange = Math.max(maxLng - minLng, 0.001);
  const project = (point: TrackPoint) => {
    const x = 40 + ((point.lng - minLng) / lngRange) * 920;
    const y = 30 + ((maxLat - point.lat) / latRange) * 640;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  };
  const toPolyline = (points: TrackPoint[]) => {
    const step = Math.max(1, Math.ceil(points.length / 220));
    return points.filter((_, index) => index % step === 0 || index === points.length - 1)
      .map(project)
      .join(' ');
  };

  return (
    <div className="relative h-full overflow-hidden rounded-xl bg-slate-950 topo-pattern-subtle">
      <svg
        viewBox="0 0 1000 700"
        className="h-full w-full"
        role="img"
        aria-label="Mapa básico de tracks"
        preserveAspectRatio="xMidYMid meet"
      >
        {tracks.map(track => {
          const selected = selectedTrackIds.includes(track.id);
          return (
            <polyline
              key={track.id}
              points={toPolyline(track.points)}
              fill="none"
              stroke={selected ? '#3b82f6' : DIFICULTAD_COLORS[track.dificultad] || '#64748b'}
              strokeWidth={selected ? 7 : 2.5}
              strokeOpacity={selected ? 1 : selectedTrackIds.length > 0 ? 0.2 : 0.65}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          );
        })}
        {builtRoute && (
          <polyline
            points={toPolyline(builtRoute.pointsCombinados)}
            fill="none"
            stroke="#ffffff"
            strokeWidth="3"
            strokeOpacity="0.9"
            strokeDasharray="10 7"
            strokeLinecap="round"
          />
        )}
      </svg>
      <div className="absolute left-3 top-3 flex max-w-[260px] items-start gap-2 rounded-xl border border-orange-500/20 bg-slate-950/90 px-3 py-2 text-[10px] text-slate-400 shadow-xl backdrop-blur">
        <MapPinned className="mt-0.5 h-4 w-4 shrink-0 text-orange-400" />
        <span>
          Mapa básico activo. Añade el token de Mapbox para terreno 3D, satélite y controles avanzados.
        </span>
      </div>
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
  hoveredRouteKm: RouteHoverData | null;
  onTrackClick: (track: TrackMTB) => void;
}) {
  const [mapStyleIndex, setMapStyleIndex] = useState(0);
  const [mapFailed, setMapFailed] = useState(false);
  const resilientStyle = useResilientMapStyle(mapStyleIndex);
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

  if (mapFailed) {
    return (
      <BasicTrackMap
        tracks={tracks}
        selectedTrackIds={selectedTrackIds}
        builtRoute={builtRoute}
      />
    );
  }

  return (
    <Map
      mapboxAccessToken={MAPBOX_ACCESS_TOKEN}
      mapStyle={resilientStyle.mapStyle}
      initialViewState={{ latitude: 40.6, longitude: -0.02, zoom: 13, pitch: 40 }}
      interactiveLayerIds={lineLayerIds}
      onClick={onClick}
      onError={() => {
        if (resilientStyle.usingFallback) {
          setMapFailed(true);
          return;
        }
        resilientStyle.handleMapError();
      }}
      style={{ width: '100%', height: '100%', borderRadius: '12px', overflow: 'hidden' }}
    >
      <NavigationControl visualizePitch={true} position="top-right" />
      <FullscreenControl position="top-right" />
      <PitchToggle />
      <StyleSwitcherControl current={mapStyleIndex} onChange={setMapStyleIndex} />

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
        const pt = interpolarPuntoEnRuta(builtRoute.pointsCombinados, hoveredRouteKm.km);
        if (!pt) return null;
        const arrow = hoveredRouteKm.trend === 'subiendo' ? '▲' : hoveredRouteKm.trend === 'bajando' ? '▼' : '◆';
        const color = hoveredRouteKm.slopePct >= 5 ? '#ef4444' : hoveredRouteKm.slopePct <= -5 ? '#22c55e' : '#f97316';
        return (
          <Marker longitude={pt.lng} latitude={pt.lat} anchor="bottom">
            <div className="flex flex-col items-center gap-0.5" style={{ pointerEvents: 'none' }}>
              <div className="px-2 py-1 rounded-lg bg-slate-950/85 border border-white/15 shadow-lg backdrop-blur-sm min-w-[90px]">
                <div className="text-xs font-bold whitespace-nowrap flex items-center gap-1.5 justify-center" style={{ color }}>
                  <span>{arrow}</span>
                  <span>{hoveredRouteKm.slopePct >= 0 ? '+' : ''}{hoveredRouteKm.slopePct.toFixed(1)}%</span>
                </div>
                <div className="flex items-center gap-2 text-[9px] text-slate-400 justify-center mt-0.5">
                  <span className="text-green-400">+{hoveredRouteKm.cumulativeGainM.toFixed(0)}m</span>
                  <span className="text-red-400">-{hoveredRouteKm.cumulativeLossM.toFixed(0)}m</span>
                </div>
              </div>
              <div style={{
                width: 12, height: 12, borderRadius: '50%',
                background: '#f97316', border: '2.5px solid #fff',
                boxShadow: '0 0 8px rgba(249,115,22,0.6)',
              }} />
            </div>
          </Marker>
        );
      })()}
    </Map>
  );
}
