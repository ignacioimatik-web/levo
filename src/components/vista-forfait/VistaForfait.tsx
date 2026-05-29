'use client';

import { useMemo, useState, useCallback, useEffect, useRef, Fragment } from 'react';
import Link from 'next/link';
import { Map as MapboxMap, Source, Layer, NavigationControl } from 'react-map-gl/mapbox';
import type { MapRef, MapMouseEvent } from 'react-map-gl/mapbox';
import 'mapbox-gl/dist/mapbox-gl.css';
import type { TrackMTB, DificultadMTB } from '@/lib/forfait/types';
import { buildProfileSeries } from '@/lib/forfait/geo-utils';
import { splitIntoSendas, type SendaSegment, type CameraView } from '@/lib/forfait/senda-utils';

/* ─── Types ─── */
interface Bounds {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}

/* ─── Constants ─── */
const STORAGE_KEY = 'forfait-builder-route';
const SENDA_VIEWS_KEY = 'vista-forfait-senda-views';

const DIF_COLORS: Record<string, string> = {
  verde: '#10b981', azul: '#3b82f6', rojo: '#ef4444', negro: '#1e293b',
  'doble-negro': '#f97316', naranja: '#f97316', gris: '#64748b',
};

interface VisualConfig { label: string; color: string; text: string; line: string; badge: string; }
const DIF_CONFIG: Record<string, VisualConfig> = {
  verde: { label: 'Fácil', color: 'bg-emerald-500', text: 'text-emerald-400', line: 'stroke-emerald-500', badge: 'bg-emerald-500/10 border-emerald-500/30' },
  azul: { label: 'Media', color: 'bg-blue-500', text: 'text-blue-400', line: 'stroke-blue-500', badge: 'bg-blue-500/10 border-blue-500/30' },
  rojo: { label: 'Difícil', color: 'bg-red-500', text: 'text-red-400', line: 'stroke-red-500', badge: 'bg-red-500/10 border-red-500/30' },
  negro: { label: 'Experto', color: 'bg-slate-700', text: 'text-slate-200', line: 'stroke-slate-200', badge: 'bg-slate-700/30 border-slate-600/30' },
  'doble-negro': { label: 'Enduro', color: 'bg-orange-500', text: 'text-orange-400', line: 'stroke-orange-500', badge: 'bg-orange-500/10 border-orange-500/30' },
  naranja: { label: 'Enduro', color: 'bg-orange-500', text: 'text-orange-400', line: 'stroke-orange-500', badge: 'bg-orange-500/10 border-orange-500/30' },
  gris: { label: 'Cerrado', color: 'bg-slate-500', text: 'text-slate-400', line: 'stroke-slate-500', badge: 'bg-slate-500/10 border-slate-500/30' },
};

const ALL_DIFICULTADES = ['verde', 'azul', 'rojo', 'negro', 'doble-negro'] as const;

function getVisualConfig(track: TrackMTB): VisualConfig {
  if (track.estado === 'cerrado') return DIF_CONFIG.gris;
  if (track.dificultad === 'doble-negro') return DIF_CONFIG.naranja;
  return DIF_CONFIG[track.dificultad] || DIF_CONFIG.naranja;
}

function getVisualColor(track: TrackMTB): string {
  if (track.estado === 'cerrado') return DIF_COLORS.gris;
  if (track.dificultad === 'doble-negro') return DIF_COLORS.naranja;
  return DIF_COLORS[track.dificultad] || DIF_COLORS.naranja;
}

function computeBounds(tracks: TrackMTB[]): Bounds {
  let minLat = 90, maxLat = -90, minLng = 180, maxLng = -180;
  for (const t of tracks) for (const p of t.points) {
    minLat = Math.min(minLat, p.lat); maxLat = Math.max(maxLat, p.lat);
    minLng = Math.min(minLng, p.lng); maxLng = Math.max(maxLng, p.lng);
  }
  const padLat = (maxLat - minLat) * 0.15 || 0.01;
  const padLng = (maxLng - minLng) * 0.15 || 0.01;
  return { minLat: minLat - padLat, maxLat: maxLat + padLat, minLng: minLng - padLng, maxLng: maxLng + padLng };
}

/* ─── Sector card ─── */
function SectorCard({ name, trackCount, difficulties, totalKm, onClick }: {
  name: string; trackCount: number; difficulties: DificultadMTB[]; totalKm: number; onClick: () => void;
}) {
  return (
    <button onClick={onClick}
      className="relative flex flex-col items-start p-6 sm:p-8 rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 border border-white/[0.06] hover:border-orange-500/30 transition-all text-left group cursor-pointer shadow-xl"
    >
      <h3 className="text-base sm:text-lg font-bold text-white group-hover:text-orange-400 transition-colors">{name}</h3>
      <p className="text-sm text-slate-400 mt-1.5">
        {trackCount} {trackCount === 1 ? 'senda' : 'sendas'}
        <span className="text-slate-600 mx-2">·</span>
        {totalKm.toFixed(0)} km
      </p>
      <div className="flex items-center gap-1.5 mt-3">
        {difficulties.map(d => (
          <span key={d} className={`w-2.5 h-2.5 rounded-full ${DIF_CONFIG[d]?.color || 'bg-slate-500'}`} />
        ))}
      </div>
    </button>
  );
}

/* ─── Badge styles ─── */
const ESTADO_STYLES: Record<string, string> = {
  abierto: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
  cerrado: 'bg-slate-500/10 text-slate-400 border-slate-500/30',
  precaucion: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
  revision: 'bg-orange-500/10 text-orange-400 border-orange-500/30',
};

/* ─── Main component ─── */
export default function VistaForfait({ tracks }: { tracks: TrackMTB[] }) {
  const [difFilter, setDifFilter] = useState<DificultadMTB | null>(null);
  const [hoveredTrackId, setHoveredTrackId] = useState<string | null>(null);
  const [activeTrackId, setActiveTrackId] = useState<string | null>(null);
  const [selectedTrackIds, setSelectedTrackIds] = useState<string[]>([]);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);
  const [activeSector, setActiveSector] = useState<string | null>(null);
  const [activeSendaId, setActiveSendaId] = useState<string | null>(null);
  const [expandedTrackId, setExpandedTrackId] = useState<string | null>(null);
  const [cameraView, setCameraView] = useState<CameraView | null>(null);
  const [showPanel, setShowPanel] = useState(true);
  const mapRef = useRef<MapRef>(null);
  const panoramaRef = useRef<HTMLDivElement>(null);

  /* ── Computed sector data ── */
  const sectorsData = useMemo(() => {
    const bySector = new Map<string, TrackMTB[]>();
    for (const t of tracks) {
      const s = t.sector || 'Otros';
      if (!bySector.has(s)) bySector.set(s, []);
      bySector.get(s)!.push(t);
    }
    return Array.from(bySector.entries())
      .map(([name, st]) => ({ name, count: st.length, tracks: st,
        difficulties: [...new Set(st.map(t => t.dificultad))] as DificultadMTB[],
        totalKm: st.reduce((sum, t) => sum + t.distanciaKm, 0),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [tracks]);

  /* ── Active sector derived data ── */
  const sectorTracks = useMemo(
    () => (activeSector ? tracks.filter(t => t.sector === activeSector) : []),
    [tracks, activeSector],
  );
  const sectorBounds = useMemo(
    () => (sectorTracks.length > 0 ? computeBounds(sectorTracks) : null),
    [sectorTracks],
  );
  const sectorCenter = useMemo(() => {
    if (!sectorBounds) return { lat: 40.6, lng: -0.02, zoom: 15.3 };
    return { lat: (sectorBounds.minLat + sectorBounds.maxLat) / 2, lng: (sectorBounds.minLng + sectorBounds.maxLng) / 2, zoom: 15.3 };
  }, [sectorBounds]);

  /* ── Sendas ── */
  const allSendas = useMemo(() => {
    const map = new Map<string, SendaSegment[]>();
    for (const t of sectorTracks) {
      map.set(t.id, splitIntoSendas(t));
    }
    return map;
  }, [sectorTracks]);

  const allSendaList = useMemo(
    () => Array.from(allSendas.values()).flat(),
    [allSendas],
  );

  /* ── Auto-expand first track + show first senda ── */
  useEffect(() => {
    if (sectorTracks.length > 0) {
      const firstTrack = sectorTracks[0];
      setExpandedTrackId(firstTrack.id);
      setActiveTrackId(firstTrack.id);
      const sendas = allSendas.get(firstTrack.id);
      if (sendas && sendas.length > 0) {
        setActiveSendaId(sendas[0].id);
      }
    }
  }, [activeSector]);

  const activeSenda = useMemo(
    () => allSendaList.find(s => s.id === activeSendaId) || null,
    [allSendaList, activeSendaId],
  );

  /* ── Track line layer IDs ── */
  const trackLineIds = useMemo(
    () => sectorTracks.map(t => `line-${t.id}`),
    [sectorTracks],
  );

  const trackMap = useMemo(() => {
    const m = new Map<string, TrackMTB>();
    for (const t of tracks) m.set(t.id, t);
    return m;
  }, [tracks]);

  /* ── Filtered tracks ── */
  const filtered = useMemo(() => {
    let result = activeSector ? tracks.filter(t => t.sector === activeSector) : [];
    if (difFilter) result = result.filter(t => t.dificultad === difFilter);
    return result;
  }, [tracks, difFilter, activeSector]);

  /* ── localStorage sync ── */
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        if (Array.isArray(saved.trackIds) && saved.trackIds.length > 0)
          setSelectedTrackIds(saved.trackIds);
      }
    } catch {}
  }, []);

  useEffect(() => {
    try {
      if (selectedTrackIds.length > 0) {
        const raw = localStorage.getItem(STORAGE_KEY);
        const existing = raw ? JSON.parse(raw) : { routeName: 'Mi ruta Forfait' };
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ trackIds: selectedTrackIds, routeName: existing.routeName || 'Mi ruta Forfait' }));
      } else localStorage.removeItem(STORAGE_KEY);
    } catch {}
  }, [selectedTrackIds]);

  // Load saved senda views
  useEffect(() => {
    try {
      const raw = localStorage.getItem(SENDA_VIEWS_KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        // Apply saved views to sendas
        for (const [sendaId, view] of Object.entries(saved)) {
          const s = allSendaList.find(s => s.id === sendaId);
          if (s) s.customView = view as CameraView;
        }
      }
    } catch {}
  }, [allSendaList]);

  /* ── Fit map to sector bounds ── */
  useEffect(() => {
    if (!sectorBounds || !mapRef.current) return;
    const map = mapRef.current;
    const doFit = () => {
      map.fitBounds(
        [[sectorBounds.minLng, sectorBounds.minLat], [sectorBounds.maxLng, sectorBounds.maxLat]],
        { padding: 50, pitch: 78, bearing: 170, duration: 800 },
      );
    };
    if (map.isStyleLoaded()) doFit();
    else map.once('style.load', doFit);
  }, [sectorBounds]);

  /* ── Fly to senda ── */
  const flyToSenda = useCallback((senda: SendaSegment) => {
    if (!mapRef.current) return;
    const view = senda.customView || senda.suggestedView;
    mapRef.current.flyTo({
      center: [view.lng, view.lat],
      zoom: view.zoom,
      pitch: view.pitch,
      bearing: view.bearing,
      duration: 1000,
    });
    setActiveSendaId(senda.id);
    setExpandedTrackId(senda.trackId);
  }, []);

  /* ── Save current view to senda ── */
  const saveViewToSenda = useCallback((sendaId: string) => {
    if (!mapRef.current || !cameraView) return;
    const s = allSendaList.find(s => s.id === sendaId);
    if (!s) return;
    s.customView = { ...cameraView };
    try {
      const raw = localStorage.getItem(SENDA_VIEWS_KEY);
      const saved = raw ? JSON.parse(raw) : {};
      saved[sendaId] = cameraView;
      localStorage.setItem(SENDA_VIEWS_KEY, JSON.stringify(saved));
    } catch {}
  }, [cameraView, allSendaList]);

  /* ── Handlers ── */
  const handleMapHover = useCallback((e: MapMouseEvent) => {
    const feature = e.features?.[0];
    if (!feature) { setHoveredTrackId(null); setTooltipPos(null); return; }
    const trackId = feature.properties?.trackId as string;
    if (!trackId) return;
    setHoveredTrackId(trackId);
    const rect = panoramaRef.current?.getBoundingClientRect();
    if (rect) setTooltipPos({
      x: ((e.originalEvent.clientX - rect.left) / rect.width) * 100,
      y: ((e.originalEvent.clientY - rect.top) / rect.height) * 100,
    });
  }, []);

  const handleMapLeave = useCallback(() => { setHoveredTrackId(null); setTooltipPos(null); }, []);
  const handleMapClick = useCallback((e: MapMouseEvent) => {
    const feature = e.features?.[0];
    if (!feature) return;
    const trackId = feature.properties?.trackId as string;
    if (!trackId) return;
    setActiveTrackId(prev => (prev === trackId ? null : trackId));
    setExpandedTrackId(trackId);
  }, []);

  const handleMoveEnd = useCallback(() => {
    if (!mapRef.current) return;
    const m = mapRef.current;
    const c = m.getCenter();
    setCameraView({
      lat: +c.lat.toFixed(6), lng: +c.lng.toFixed(6),
      zoom: +m.getZoom().toFixed(1),
      pitch: +m.getPitch().toFixed(0),
      bearing: +m.getBearing().toFixed(0),
    });
  }, []);

  const handleSelectTrack = useCallback((id: string) => {
    setActiveTrackId(prev => (prev === id ? null : id));
    setSelectedTrackIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id],
    );
  }, []);

  const handleBackToSectors = useCallback(() => {
    setActiveSector(null); setActiveTrackId(null); setHoveredTrackId(null);
    setDifFilter(null); setActiveSendaId(null); setExpandedTrackId(null);
  }, []);

  /* ── Compute selected route GeoJSON for overview ── */
  const routeOverview = useMemo(() => {
    // Build combined route from selected tracks, ordered by proximity
    const sel = selectedTrackIds.map(id => tracks.find(t => t.id === id)).filter(Boolean) as TrackMTB[];
    if (sel.length === 0) return null;

    // Simple chain: sort selected tracks by end -> next start proximity
    const ordered: TrackMTB[] = [sel[0]];
    const remaining = sel.slice(1);
    while (remaining.length > 0) {
      const last = ordered[ordered.length - 1];
      const lastPt = last.points[last.points.length - 1];
      let bestIdx = 0, bestDist = Infinity;
      for (let i = 0; i < remaining.length; i++) {
        const firstPt = remaining[i].points[0];
        const d = Math.sqrt(
          ((firstPt.lat - lastPt.lat) * 111320) ** 2 +
          ((firstPt.lng - lastPt.lng) * 111320 * Math.cos(firstPt.lat * Math.PI / 180)) ** 2
        );
        if (d < bestDist) { bestDist = d; bestIdx = i; }
      }
      ordered.push(remaining[bestIdx]);
      remaining.splice(bestIdx, 1);
    }

    const coords: [number, number][] = ordered.flatMap(t => t.points.map(p => [p.lng, p.lat] as [number, number]));
    return coords;
  }, [selectedTrackIds, tracks]);

  /* ── Render: Sector cards ── */
  if (!activeSector) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col">
        <nav className="relative z-20 bg-slate-950/90 backdrop-blur-md border-b border-white/5">
          <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-12 sm:h-14 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <Link href="/forfait"
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 sm:px-2.5 sm:py-1 rounded text-[10px] font-bold uppercase tracking-widest transition-colors bg-orange-500/10 text-orange-400 border border-orange-500/25 hover:bg-orange-500/20 flex-shrink-0"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
                <span className="hidden sm:inline">Volver a Forfait</span>
              </Link>
              <span className="ml-2 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-widest bg-orange-500/15 text-orange-400">Vista Forfait</span>
            </div>
            <span className="text-[11px] text-slate-500">{tracks.length} sendas · {sectorsData.length} sectores</span>
          </div>
        </nav>
        <main className="flex-1 max-w-5xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
          <div className="mb-8 sm:mb-10">
            <h1 className="text-xl sm:text-2xl font-bold text-white">Selecciona un sector</h1>
            <p className="text-sm text-slate-400 mt-1">Explora las sendas de cada sector del bike resort</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
            {sectorsData.map(s => (
              <SectorCard key={s.name} name={s.name} trackCount={s.count}
                difficulties={s.difficulties} totalKm={s.totalKm}
                onClick={() => setActiveSector(s.name)}
              />
            ))}
          </div>
        </main>
      </div>
    );
  }

  /* ── Render: Sector detail ── */
  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      <style>{`.mapboxgl-ctrl-attrib { display: none !important; }`}</style>

      {/* ── NAV ── */}
      <nav className="relative z-20 bg-slate-950/90 backdrop-blur-md border-b border-white/5">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-12 sm:h-14 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <button onClick={handleBackToSectors}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 sm:px-2.5 sm:py-1 rounded text-[10px] font-bold uppercase tracking-widest transition-colors bg-orange-500/10 text-orange-400 border border-orange-500/25 hover:bg-orange-500/20 flex-shrink-0"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
              <span className="hidden sm:inline">Sectores</span>
            </button>
            <span className="hidden sm:inline text-sm font-bold text-white ml-2 truncate">{activeSector}</span>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-slate-500 flex-shrink-0">
            <span>{sectorTracks.length} sendas</span>
            <span className="hidden xs:inline">·</span>
            <span className="hidden xs:inline">{sectorTracks.reduce((s, t) => s + t.distanciaKm, 0).toFixed(0)} km</span>
          </div>
        </div>
      </nav>

      {/* ── MAPA 3D ── */}
      <section ref={panoramaRef}
        className="panorama-container relative w-full overflow-hidden bg-slate-900 max-h-[50vh] sm:max-h-[55vh] lg:max-h-none"
      >
        <div className="relative w-full aspect-[2/1] min-h-[300px]">
          {sectorBounds ? (
            <MapboxMap ref={mapRef}
              mapStyle="mapbox://styles/mapbox/satellite-streets-v12"
              mapboxAccessToken={process.env.NEXT_PUBLIC_MAPBOX_TOKEN}
              initialViewState={{ latitude: sectorCenter.lat, longitude: sectorCenter.lng, zoom: sectorCenter.zoom, pitch: 78, bearing: 170 }}
              terrain={{ source: 'mapbox-dem', exaggeration: 1.5 }}
              interactiveLayerIds={trackLineIds}
              onMouseMove={handleMapHover}
              onClick={handleMapClick}
              onMouseLeave={handleMapLeave}
              onMoveEnd={handleMoveEnd}
              onLoad={handleMoveEnd}
              style={{ width: '100%', height: '100%' }}
              attributionControl={false}
            >
              <Source id="mapbox-dem" type="raster-dem" url="mapbox://mapbox.mapbox-terrain-dem-v1" />
              <NavigationControl visualizePitch={true} position="top-right" />

              {/* Track layers */}
              {sectorTracks.filter(t => !difFilter || t.dificultad === difFilter).map(track => {
                const isClosed = track.estado === 'cerrado';
                const isHov = hoveredTrackId === track.id;
                const isAct = activeTrackId === track.id;
                const isSel = selectedTrackIds.includes(track.id);
                const hasActiveSenda = activeSenda && activeSenda.trackId === track.id;
                const isDimmed = activeSendaId !== null && !hasActiveSenda;

                const color = getVisualColor(track);
                let weight = isAct ? 5 : isHov ? 4.5 : isSel ? 3.5 : 2.5;
                let opacity = isClosed ? 0.2 : isAct ? 1 : isHov ? 0.9 : isSel ? 0.75 : isDimmed ? 0.12 : 0.45;
                const dash = isClosed ? [5, 5] as number[] : isSel ? [8, 5] as number[] : null;

                const coords: [number, number][] = track.points.map(p => [p.lng, p.lat]);

                return (
                  <Fragment key={track.id}>
                    <Source id={`src-${track.id}`} type="geojson" data={{
                      type: 'Feature', geometry: { type: 'LineString', coordinates: coords }, properties: { trackId: track.id },
                    }}>
                      <Layer id={`glow-${track.id}`} type="line" source={`src-${track.id}`}
                        paint={{ 'line-color': color, 'line-width': weight + 10, 'line-opacity': isHov || isAct ? 0.4 : 0, 'line-blur': 5 }}
                      />
                      <Layer id={`line-${track.id}`} type="line" source={`src-${track.id}`}
                        paint={{ 'line-color': color, 'line-width': weight, 'line-opacity': opacity, ...(dash ? { 'line-dasharray': dash } : {}) }}
                      />
                    </Source>
                    <Source id={`start-${track.id}`} type="geojson" data={{
                      type: 'Feature', geometry: { type: 'Point', coordinates: [track.startPoint.lng, track.startPoint.lat] }, properties: {},
                    }}>
                      <Layer id={`start-${track.id}`} type="circle" source={`start-${track.id}`}
                        paint={{ 'circle-color': '#22c55e', 'circle-radius': isAct || isHov ? 5 : 3.5, 'circle-opacity': 0.85, 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 1.5 }}
                      />
                    </Source>
                  </Fragment>
                );
              })}

              {/* Active senda highlight */}
              {activeSenda && (() => {
                const coords: [number, number][] = activeSenda.points.map(p => [p.lng, p.lat]);
                return (
                  <Source id="active-senda" type="geojson" data={{
                    type: 'Feature', geometry: { type: 'LineString', coordinates: coords }, properties: {},
                  }}>
                    <Layer id="active-senda-glow" type="line" source="active-senda"
                      paint={{ 'line-color': '#f97316', 'line-width': 8, 'line-opacity': 0.5, 'line-blur': 6 }}
                    />
                    <Layer id="active-senda-line" type="line" source="active-senda"
                      paint={{ 'line-color': '#ffffff', 'line-width': 4, 'line-opacity': 0.9 }}
                    />
                    <Layer id="active-senda-dash" type="line" source="active-senda"
                      paint={{ 'line-color': '#f97316', 'line-width': 4, 'line-opacity': 1, 'line-dasharray': [6, 4] }}
                    />
                  </Source>
                );
              })()}

              {/* Selected route overview (flag style) */}
              {routeOverview && routeOverview.length > 1 && (
                <Source id="route-overview" type="geojson" data={{
                  type: 'Feature', geometry: { type: 'LineString', coordinates: routeOverview }, properties: {},
                }}>
                  <Layer id="route-blue-glow" type="line" source="route-overview"
                    paint={{ 'line-color': '#3b82f6', 'line-width': 10, 'line-opacity': 0.25, 'line-blur': 8 }}
                  />
                  <Layer id="route-white" type="line" source="route-overview"
                    paint={{ 'line-color': '#ffffff', 'line-width': 5, 'line-opacity': 0.85 }}
                  />
                  <Layer id="route-black-dash" type="line" source="route-overview"
                    paint={{ 'line-color': '#1e293b', 'line-width': 5, 'line-opacity': 0.9, 'line-dasharray': [6, 6] }}
                  />
                </Source>
              )}
            </MapboxMap>
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-900">
              <p className="text-slate-500 text-sm">Cargando mapa...</p>
            </div>
          )}

          {/* Sector badge */}
          <div className="absolute top-2 left-2 z-10 pointer-events-none">
            <span className="px-2.5 py-1 rounded-full bg-slate-950/70 backdrop-blur-sm text-[11px] font-bold text-orange-400 border border-orange-500/30">
              {activeSector}
            </span>
          </div>

          {/* Camera view coordinates */}
          {cameraView && (
            <div className="absolute top-2 right-12 z-10 pointer-events-none hidden sm:block">
              <div className="px-2 py-1 rounded-md bg-slate-950/75 backdrop-blur-sm border border-white/5 text-[9px] font-mono text-slate-400 leading-relaxed">
                <div>lat {cameraView.lat} lng {cameraView.lng}</div>
                <div>zoom {cameraView.zoom} pitch {cameraView.pitch}° bear {cameraView.bearing}°</div>
              </div>
            </div>
          )}

          {/* Tooltip */}
          {hoveredTrackId && tooltipPos && (() => {
            const track = trackMap.get(hoveredTrackId);
            if (!track) return null;
            const cfg = getVisualConfig(track);
            return (
              <div className="absolute z-30 px-2.5 py-1.5 rounded-lg bg-slate-950/85 backdrop-blur-md border border-white/10 shadow-xl pointer-events-none text-[11px] whitespace-nowrap"
                style={{ left: `${tooltipPos.x}%`, top: `${tooltipPos.y}%`, transform: 'translate(-50%, -110%)' }}
              >
                <div className="flex items-center gap-2 font-semibold text-white">{track.nombre}</div>
                <div className="text-slate-400 mt-0.5">{track.sector} · {track.distanciaKm.toFixed(1)} km</div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className={`text-[10px] font-bold uppercase ${cfg.text}`}>{cfg.label}</span>
                  <span className="text-emerald-400">+{track.desnivelPositivo}m</span>
                  <span className="text-red-400">-{track.desnivelNegativo}m</span>
                </div>
              </div>
            );
          })()}

          {/* ── Floating senda panel inside map ── */}
          {showPanel && (
            <div className="absolute bottom-2 left-2 right-2 sm:left-2 sm:right-auto sm:bottom-2 sm:w-72 z-20 max-h-[40%] overflow-y-auto rounded-xl bg-slate-950/85 backdrop-blur-md border border-white/10 shadow-xl">
              <div className="sticky top-0 z-10 flex items-center justify-between px-3 py-2 bg-slate-950/90 backdrop-blur-sm border-b border-white/5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Sendas</span>
                <button onClick={() => setShowPanel(false)}
                  className="p-0.5 text-slate-500 hover:text-white transition-colors"
                >
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="py-1">
                {filtered.map(t => {
                  const sendas = allSendas.get(t.id) || [];
                  const isExpanded = expandedTrackId === t.id;
                  const cfg = getVisualConfig(t);
                  return (
                    <div key={t.id}>
                      {/* Track header */}
                      <button onClick={() => setExpandedTrackId(isExpanded ? null : t.id)}
                        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-white/[0.04] transition-colors"
                      >
                        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${cfg.color}`} />
                        <span className={`flex-1 text-[11px] font-semibold truncate ${
                          selectedTrackIds.includes(t.id) ? 'text-orange-400' : 'text-white'
                        }`}>
                          {t.nombre}
                        </span>
                        <span className="text-[9px] text-slate-500">{t.distanciaKm.toFixed(1)} km</span>
                        <svg className={`w-2.5 h-2.5 text-slate-500 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                        </svg>
                      </button>
                      {/* Sendas */}
                      {isExpanded && sendas.map(s => {
                        const isActive = activeSendaId === s.id;
                        return (
                          <button key={s.id} onClick={() => flyToSenda(s)}
                            className={`w-full flex items-center gap-2 pl-8 pr-3 py-1.5 text-left transition-colors ${
                              isActive ? 'bg-orange-500/10' : 'hover:bg-white/[0.03]'
                            }`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                              isActive ? 'bg-orange-400' : 'bg-slate-600'
                            }`} />
                            <span className={`flex-1 text-[11px] truncate ${isActive ? 'text-orange-400 font-semibold' : 'text-slate-400'}`}>
                              {s.name}
                            </span>
                            <span className="text-[9px] text-slate-600">{s.distanceKm.toFixed(1)} km</span>
                            {/* Save view button */}
                            <button onClick={e => { e.stopPropagation(); saveViewToSenda(s.id); }}
                              className="p-0.5 text-slate-600 hover:text-orange-400 transition-colors"
                              title="Guardar vista actual"
                            >
                              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                              </svg>
                            </button>
                          </button>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Toggle panel button */}
          {!showPanel && (
            <button onClick={() => setShowPanel(true)}
              className="absolute bottom-2 left-2 z-20 px-2.5 py-1.5 rounded-lg bg-slate-950/80 backdrop-blur-sm border border-white/10 text-[10px] font-bold text-orange-400 hover:bg-slate-950 transition-colors"
            >
              Sendas
            </button>
          )}
        </div>
      </section>

      {/* ── ACTIVE TRACK DETAIL ── */}
      {activeTrackId && (() => {
        const track = trackMap.get(activeTrackId);
        if (!track) return null;
        const cfg = getVisualConfig(track);
        const hrs = Math.floor(track.tiempoEstimadoMin / 60);
        const mins = track.tiempoEstimadoMin % 60;
        return (
          <div className="border-b border-white/5 bg-slate-950/60 backdrop-blur-sm">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className={`w-3 h-3 rounded-full flex-shrink-0 ${cfg.color}`} />
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-white truncate">{track.nombre}</span>
                    <span className={`text-[10px] font-bold uppercase ${cfg.text}`}>{cfg.label}</span>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    {track.sector} · {track.distanciaKm.toFixed(1)} km · +{track.desnivelPositivo}m / -{track.desnivelNegativo}m
                    <span className="ml-2 text-slate-600">T{track.nivelTecnico}/F{track.exigenciaFisica}</span>
                    <span className="ml-2">{hrs > 0 ? `${hrs}h ${mins}min` : `${mins}min`}</span>
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button onClick={() => handleSelectTrack(activeTrackId)}
                  className={`px-3 py-1 rounded text-[10px] font-bold uppercase tracking-wider transition-colors ${
                    selectedTrackIds.includes(activeTrackId)
                      ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                      : 'bg-slate-800 text-slate-300 border border-white/5 hover:bg-orange-500/15 hover:text-orange-400'
                  }`}
                >
                  {selectedTrackIds.includes(activeTrackId) ? 'Seleccionado' : 'Añadir a ruta'}
                </button>
                <button onClick={() => setActiveTrackId(null)}
                  className="p-1 text-slate-500 hover:text-white transition-colors" aria-label="Cerrar detalle"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── FILTERS + LEGEND ── */}
      <div className={`${activeTrackId ? '' : 'sticky top-0'} z-10 bg-slate-950/90 backdrop-blur-md border-b border-white/5`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2.5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 flex-wrap">
            <button onClick={() => setDifFilter(null)}
              className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider transition-colors ${
                !difFilter ? 'bg-orange-500/15 text-orange-400 border border-orange-500/30'
                  : 'text-slate-500 border border-white/5 hover:text-slate-300'
              }`}
            >Todas</button>
            {ALL_DIFICULTADES.map(d => {
              const cfg = DIF_CONFIG[d];
              const active = difFilter === d;
              return (
                <button key={d} onClick={() => setDifFilter(active ? null : d)}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider transition-colors ${
                    active ? `${cfg.color}/15 ${cfg.text} border ${cfg.color}/30`
                      : 'text-slate-500 border border-white/5 hover:text-slate-300'
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${cfg.color}`} />
                  {cfg.label}
                </button>
              );
            })}
          </div>
          {/* Legend */}
          <div className="flex items-center gap-2 text-[9px] text-slate-500 flex-wrap">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" /> Fácil</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500" /> Media</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500" /> Difícil</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-slate-700 border border-white/20" /> Experto</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-orange-500" /> Enduro</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-slate-500" /> Cerrado</span>
          </div>
        </div>
      </div>
    </div>
  );
}
