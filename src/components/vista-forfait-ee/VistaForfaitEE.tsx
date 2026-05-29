'use client';

import { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import Link from 'next/link';
import { Map as MapboxMap, Source, Layer } from 'react-map-gl/mapbox';
import type { MapRef, MapMouseEvent } from 'react-map-gl/mapbox';
import 'mapbox-gl/dist/mapbox-gl.css';
import type { TrackMTB, DificultadMTB } from '@/lib/forfait/types';
import type { SendaSegment, CameraView } from '@/lib/forfait/senda-utils';
import { splitIntoSendas } from '@/lib/forfait/senda-utils';

const SENDA_VIEWS_KEY = 'vista-forfait-senda-views';

/* ─── Types ─── */
interface Bounds {
  minLat: number; maxLat: number; minLng: number; maxLng: number;
}

/* ─── Constants ─── */
const DIF_COLORS: Record<string, string> = {
  verde: '#10b981', azul: '#3b82f6', rojo: '#ef4444', negro: '#1e293b',
  'doble-negro': '#f97316', naranja: '#f97316', gris: '#64748b',
};

interface VisualConfig { label: string; color: string; text: string; }
const DIF_CONFIG: Record<string, VisualConfig> = {
  verde: { label: 'Fácil', color: '#10b981', text: 'text-emerald-400' },
  azul: { label: 'Media', color: '#3b82f6', text: 'text-blue-400' },
  rojo: { label: 'Difícil', color: '#ef4444', text: 'text-red-400' },
  negro: { label: 'Experto', color: '#1e293b', text: 'text-slate-200' },
  'doble-negro': { label: 'Enduro', color: '#f97316', text: 'text-orange-400' },
  naranja: { label: 'Enduro', color: '#f97316', text: 'text-orange-400' },
  gris: { label: 'Cerrado', color: '#64748b', text: 'text-slate-400' },
};

const ALL_DIFICULTADES = ['verde', 'azul', 'rojo', 'negro', 'doble-negro'] as const;

const MINIMAL_STYLE = {
  version: 8 as const,
  sources: {},
  layers: [],
};

const GOOGLE_SATELLITE_URL = 'https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}';
const GOOGLE_LABELS_URL = 'https://mt1.google.com/vt/lyrs=h&x={x}&y={y}&z={z}';

function getVisualCfg(track: TrackMTB): VisualConfig {
  if (track.estado === 'cerrado') return DIF_CONFIG.gris;
  if (track.dificultad === 'doble-negro') return DIF_CONFIG.naranja;
  return DIF_CONFIG[track.dificultad] || DIF_CONFIG.naranja;
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

/* ─── Main component ─── */
export default function VistaForfaitEE({ tracks }: { tracks: TrackMTB[] }) {
  const [difFilter, setDifFilter] = useState<DificultadMTB | null>(null);
  const [hoveredTrackId, setHoveredTrackId] = useState<string | null>(null);
  const [activeTrackId, setActiveTrackId] = useState<string | null>(null);
  const [selectedTrackIds, setSelectedTrackIds] = useState<string[]>([]);
  const [activeSector, setActiveSector] = useState<string | null>(null);
  const [activeSendaId, setActiveSendaId] = useState<string | null>(null);
  const [expandedTrackId, setExpandedTrackId] = useState<string | null>(null);
  const [pitch, setPitch] = useState(60);
  const [bearing, setBearing] = useState(0);
  const [zoom, setZoom] = useState(15.3);
  const [viewState, setViewState] = useState({ latitude: 40.6, longitude: -0.02, zoom: 15.3, pitch: 60, bearing: 0 });
  const mapRef = useRef<MapRef>(null);
  const [mapReady, setMapReady] = useState(false);
  const [eeTileUrl, setEeTileUrl] = useState<string | null>(null);
  const [eeStatus, setEeStatus] = useState<'loading' | 'ok' | 'error'>('loading');
  const [cameraView, setCameraView] = useState<CameraView | null>(null);
  const [showPanel, setShowPanel] = useState(true);

  /* ── Fetch EE satellite layer on mount ── */
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch('/api/ee/map');
        if (!res.ok) throw new Error('EE API error');
        const data = await res.json();
        if (!cancelled && data.tileUrlTemplate) {
          setEeTileUrl(data.tileUrlTemplate);
          setEeStatus('ok');
        }
      } catch {
        if (!cancelled) setEeStatus('error');
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  /* ── Sector data ── */
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

  const sectorTracks = useMemo(
    () => (activeSector ? tracks.filter(t => t.sector === activeSector) : []),
    [tracks, activeSector],
  );

  const sectorBounds = useMemo(
    () => (sectorTracks.length > 0 ? computeBounds(sectorTracks) : null),
    [sectorTracks],
  );

  const sectorCenter = useMemo(() => {
    if (!sectorBounds) return { latitude: 40.6, longitude: -0.02 };
    return { latitude: (sectorBounds.minLat + sectorBounds.maxLat) / 2, longitude: (sectorBounds.minLng + sectorBounds.maxLng) / 2 };
  }, [sectorBounds]);

  /* ── Sendas ── */
  const allSendas = useMemo(() => {
    const map = new Map<string, SendaSegment[]>();
    for (const t of sectorTracks) map.set(t.id, splitIntoSendas(t));
    return map;
  }, [sectorTracks]);

  const allSendaList = useMemo(() => Array.from(allSendas.values()).flat(), [allSendas]);

  const activeSenda = useMemo(
    () => allSendaList.find(s => s.id === activeSendaId) || null,
    [allSendaList, activeSendaId],
  );

  const filtered = useMemo(() => {
    let result = activeSector ? tracks.filter(t => t.sector === activeSector) : [];
    if (difFilter) result = result.filter(t => t.dificultad === difFilter);
    return result;
  }, [tracks, difFilter, activeSector]);

  const trackMap = useMemo(() => {
    const m = new Map<string, TrackMTB>();
    for (const t of tracks) m.set(t.id, t);
    return m;
  }, [tracks]);

  /* ── Auto-select first sector ── */
  useEffect(() => {
    if (!activeSector && sectorsData.length > 0) setActiveSector(sectorsData[0].name);
  }, [sectorsData, activeSector]);

  /* ── Auto-expand first track + senda ── */
  useEffect(() => {
    if (sectorTracks.length > 0) {
      setExpandedTrackId(sectorTracks[0].id);
      setActiveTrackId(sectorTracks[0].id);
      const sendas = allSendas.get(sectorTracks[0].id);
      if (sendas && sendas.length > 0) setActiveSendaId(sendas[0].id);
    }
  }, [activeSector]);

  /* ── Fly to sector bounds ── */
  useEffect(() => {
    if (sectorBounds && mapReady) {
      mapRef.current?.flyTo({
        center: [sectorCenter.longitude, sectorCenter.latitude],
        zoom: 15.3, pitch: 60, bearing: 0, duration: 1500,
      });
    }
  }, [sectorBounds, mapReady]);

  /* ── Restore saved senda views ── */
  useEffect(() => {
    try {
      const raw = localStorage.getItem(SENDA_VIEWS_KEY);
      if (!raw) return;
      const saved: Record<string, CameraView> = JSON.parse(raw);
      for (const [id, cv] of Object.entries(saved)) {
        const s = allSendaList.find(s => s.id === id);
        if (s) s.customView = cv;
      }
    } catch {}
  }, [allSendaList]);

  const handleSelectSector = useCallback((name: string) => {
    setActiveSector(name); setActiveTrackId(null); setHoveredTrackId(null);
    setDifFilter(null); setActiveSendaId(null); setExpandedTrackId(null);
  }, []);

  const flyToSenda = useCallback((senda: SendaSegment) => {
    const view = senda.customView || senda.suggestedView;
    if (mapRef.current) {
      mapRef.current.flyTo({
        center: [view.lng, view.lat], zoom: view.zoom, pitch: view.pitch ?? 60, bearing: view.bearing ?? 0, duration: 1200,
      });
    }
    setActiveSendaId(senda.id);
    setExpandedTrackId(senda.trackId);
    setActiveTrackId(senda.trackId);
  }, []);

  /* ── Preset fly ── */
  const flyPreset = useCallback((z: number, p: number, b: number) => {
    if (!mapRef.current) return;
    const c = mapRef.current.getCenter();
    mapRef.current.flyTo({ center: c, zoom: z, pitch: p, bearing: b, duration: 1000 });
    setPitch(p); setBearing(b); setZoom(z);
  }, []);

  /* ── Camera view tracking ── */
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

  /* ── Save view to senda ── */
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

  /* ── GeoJSON data ── */
  const trackLineIds = useMemo(() => filtered.map(t => `${t.id}-line`), [filtered]);

  const trackGeoJsons = useMemo(() => filtered.map(t => ({
    id: t.id,
    data: { type: 'Feature' as const, geometry: { type: 'LineString' as const, coordinates: t.points.map(p => [p.lng, p.lat]) }, properties: { trackId: t.id } },
  })), [filtered]);

  const activeSendaGeoJson = useMemo(() => activeSenda ? {
    data: { type: 'Feature' as const, geometry: { type: 'LineString' as const, coordinates: activeSenda.points.map(p => [p.lng, p.lat]) }, properties: {} },
  } : null, [activeSenda]);

  /* ── Layer paint/layout helpers ── */
  const trackPaint = useCallback((track: TrackMTB) => {
    const isClosed = track.estado === 'cerrado';
    const isHov = hoveredTrackId === track.id;
    const isAct = activeTrackId === track.id;
    const isSel = selectedTrackIds.includes(track.id);
    const hasActiveSenda = activeSenda && activeSenda.trackId === track.id;
    const isDimmed = activeSendaId !== null && !hasActiveSenda;
    const color = isClosed ? DIF_COLORS.gris : track.dificultad === 'doble-negro' ? DIF_COLORS.naranja : DIF_COLORS[track.dificultad] || DIF_COLORS.naranja;
    const weight = isAct ? 5 : isHov ? 4.5 : isSel ? 3.5 : 2.5;
    const opacity = isClosed ? 0.2 : isAct ? 1 : isHov ? 0.9 : isSel ? 0.75 : isDimmed ? 0.12 : 0.45;
    return {
      'line-color': color,
      'line-width': weight,
      'line-opacity': opacity,
      'line-dasharray': isClosed ? [5, 5] as [number, number] : isSel ? [8, 5] as [number, number] : undefined,
    };
  }, [hoveredTrackId, activeTrackId, selectedTrackIds, activeSendaId, activeSenda]);

  const sendaPaint = {
    'line-color': '#f97316',
    'line-width': 4,
    'line-opacity': 0.9,
    'line-dasharray': [6, 4] as [number, number],
  };

  /* ── Route overview (flag style) ── */
  const routeOverview = useMemo(() => {
    const sel = selectedTrackIds.map(id => tracks.find(t => t.id === id)).filter(Boolean) as TrackMTB[];
    if (sel.length === 0) return null;
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
    return ordered.flatMap(t => t.points.map(p => [p.lng, p.lat] as [number, number]));
  }, [selectedTrackIds, tracks]);

  /* ── Render ── */
  if (!activeSector) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center">
        <p className="text-slate-400 text-sm">Cargando...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      {/* NAV */}
      <nav className="z-20 bg-slate-950/90 backdrop-blur-md border-b border-white/5">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-12 sm:h-14 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Link href="/forfait"
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded text-[10px] font-bold uppercase tracking-widest transition-colors bg-orange-500/10 text-orange-400 border border-orange-500/25 hover:bg-orange-500/20"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
              <span className="hidden sm:inline">Volver a Forfait</span>
            </Link>
            <span className="px-2 py-1 rounded text-[10px] font-bold uppercase tracking-widest bg-orange-500/15 text-orange-400 hidden sm:inline">Earth Engine</span>
            <div className="relative ml-2">
              <select value={activeSector} onChange={e => handleSelectSector(e.target.value)}
                className="px-2 py-1 rounded text-[11px] font-bold text-white bg-white/[0.06] border border-white/10 appearance-none cursor-pointer pr-6"
              >
                {sectorsData.map(s => (
                  <option key={s.name} value={s.name} className="bg-slate-900">{s.name}</option>
                ))}
              </select>
              <svg className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-slate-500">
            <span>{sectorTracks.length} tracks</span>
            <span className="hidden xs:inline">·</span>
            <span className="hidden xs:inline">{sectorTracks.reduce((s, t) => s + t.distanciaKm, 0).toFixed(0)} km</span>
          </div>
        </div>
      </nav>

      {/* MAP */}
      <section className="relative mx-3 sm:mx-6 lg:mx-8 overflow-hidden rounded-xl bg-slate-900 flex-1 min-h-[300px]">
        <MapboxMap
          ref={mapRef}
          mapStyle={MINIMAL_STYLE}
          mapboxAccessToken={process.env.NEXT_PUBLIC_MAPBOX_TOKEN}
          initialViewState={{ latitude: sectorCenter.latitude, longitude: sectorCenter.longitude, zoom: 15.3, pitch: 60, bearing: 0 }}
          terrain={{ source: 'mapbox-dem', exaggeration: 1.5 }}
          onMove={e => {
            setViewState(e.viewState);
            setZoom(e.viewState.zoom);
            setPitch(e.viewState.pitch);
            setBearing(e.viewState.bearing);
          }}
          onMoveEnd={handleMoveEnd}
          interactiveLayerIds={trackLineIds}
          onMouseMove={e => {
            if (!e.features || e.features.length === 0) { setHoveredTrackId(null); return; }
            const trackId = e.features[0].properties?.trackId as string;
            if (trackId) setHoveredTrackId(trackId);
            else setHoveredTrackId(null);
          }}
          onClick={(e: MapMouseEvent) => {
            if (!e.features || e.features.length === 0) return;
            const trackId = e.features[0].properties?.trackId as string;
            if (trackId) {
              setActiveTrackId(trackId);
              setExpandedTrackId(trackId);
              setSelectedTrackIds([trackId]);
            }
          }}
          onLoad={() => setMapReady(true)}
          style={{ width: '100%', height: '100%', position: 'absolute', inset: 0 }}
          attributionControl={false}
          scrollZoom={{ around: 'center' }}
          dragRotate={true}
          touchPitch={true}
          touchZoomRotate={true}
          doubleClickZoom={true}
          keyboard={true}
        >
          {/* 3D terrain */}
          <Source id="mapbox-dem" type="raster-dem" url="mapbox://mapbox.mapbox-terrain-dem-v1" />

          {/* Base satellite layer (Earth Engine or Google fallback) */}
          <Source id="satellite" type="raster"
            tiles={[eeTileUrl || GOOGLE_SATELLITE_URL]}
            tileSize={256}
          >
            <Layer id="satellite-layer" type="raster" />
          </Source>

          {/* Labels overlay (transparent Google hybrid labels) */}
          <Source id="labels" type="raster"
            tiles={[GOOGLE_LABELS_URL]}
            tileSize={256}
          >
            <Layer id="labels-layer" type="raster" />
          </Source>

          {/* Track layers */}
          {trackGeoJsons.map(t => (
            <Source key={t.id} id={t.id} type="geojson" data={t.data}>
              <Layer id={`${t.id}-line`} type="line" source={t.id}
                paint={trackPaint(trackMap.get(t.id)!) as any}
              />
            </Source>
          ))}

          {/* Active senda highlight */}
          {activeSendaGeoJson && (
            <Source id="active-senda" type="geojson" data={activeSendaGeoJson.data}>
              <Layer id="active-senda-line" type="line" source="active-senda"
                paint={sendaPaint as any}
              />
            </Source>
          )}

          {/* Selected route overview (flag style) */}
          {routeOverview && routeOverview.length > 1 && (
            <Source id="route-overview" type="geojson" data={{
              type: 'Feature' as const, geometry: { type: 'LineString' as const, coordinates: routeOverview }, properties: {},
            }}>
              <Layer id="route-blue-glow" type="line" source="route-overview"
                paint={{ 'line-color': '#3b82f6', 'line-width': 10, 'line-opacity': 0.25, 'line-blur': 8 } as any}
              />
              <Layer id="route-white" type="line" source="route-overview"
                paint={{ 'line-color': '#ffffff', 'line-width': 5, 'line-opacity': 0.85 } as any}
              />
              <Layer id="route-black-dash" type="line" source="route-overview"
                paint={{ 'line-color': '#1e293b', 'line-width': 5, 'line-opacity': 0.9, 'line-dasharray': [6, 6] } as any}
              />
            </Source>
          )}
        </MapboxMap>

        {/* Sector badge */}
        <div className="absolute top-2 left-2 z-[1000] pointer-events-none flex items-center gap-2">
          <span className="px-2.5 py-1 rounded-full bg-slate-950/70 backdrop-blur-sm text-[11px] font-bold text-orange-400 border border-orange-500/30">
            {activeSector}
          </span>
          <span className={`px-2 py-0.5 rounded-full backdrop-blur-sm text-[9px] font-mono border ${
            eeStatus === 'ok' ? 'bg-emerald-950/60 text-emerald-400 border-emerald-500/30' :
            eeStatus === 'loading' ? 'bg-slate-950/60 text-slate-500 border-white/5' :
            'bg-amber-950/60 text-amber-400 border-amber-500/30'
          }`}>
            {eeStatus === 'ok' ? 'EE ✓' : eeStatus === 'loading' ? 'EE …' : 'Google'}
          </span>
        </div>

        {/* ── Floating senda panel inside map ── */}
        {showPanel && (
          <div className="absolute bottom-0 left-0 right-0 sm:left-2 sm:right-auto sm:bottom-2 sm:w-72 z-20 max-h-[30%] sm:max-h-[40%] overflow-y-auto rounded-none sm:rounded-xl bg-slate-950/85 backdrop-blur-md border-t sm:border border-white/10 shadow-xl">
            <div className="sticky top-0 z-10 flex items-center justify-between px-3 py-2 bg-slate-950/90 backdrop-blur-sm border-b border-white/5">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Sendas</span>
                {([
                  { zoom: 13, pitch: 75, bearing: 80, label: 'Vista 1' },
                  { zoom: 15, pitch: 78, bearing: 120, label: 'Vista 2' },
                  { zoom: 16, pitch: 81, bearing: 170, label: 'Vista 3' },
                ] as const).map((p, i) => (
                  <div key={i} className="group relative">
                    <button onClick={e => {
                      e.stopPropagation();
                      if (!mapRef.current) return;
                      const c = mapRef.current.getCenter();
                      mapRef.current.flyTo({
                        center: [c.lng, c.lat],
                        zoom: p.zoom,
                        pitch: p.pitch,
                        bearing: p.bearing,
                        duration: 800,
                      });
                    }}
                      className="px-1 py-0.5 rounded text-[8px] font-bold font-mono text-white bg-slate-950/80 backdrop-blur-sm border border-white/10 hover:bg-orange-500/20 hover:text-orange-400 hover:border-orange-500/30 transition-colors"
                    >
                      V{i + 1}
                    </button>
                    <span className="absolute left-1/2 -top-4 -translate-x-1/2 text-[7px] font-bold uppercase tracking-wider text-slate-400 bg-slate-950/90 backdrop-blur-sm px-1 py-0.5 rounded border border-white/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
                      {p.label}
                    </span>
                  </div>
                ))}
              </div>
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
                const cfg = getVisualCfg(t);
                return (
                  <div key={t.id}>
                    {/* Track header */}
                    <button onClick={() => {
                      setExpandedTrackId(isExpanded ? null : t.id);
                      setActiveTrackId(t.id);
                      setShowPanel(false);
                    }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-white/[0.04] transition-colors"
                    >
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: cfg.color }} />
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
                        <button key={s.id} onClick={() => {
                          flyToSenda(s);
                          setActiveTrackId(s.trackId);
                          setShowPanel(false);
                        }}
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

        {/* Camera view coordinates + Pitch/bearing controls at top */}
        <div className="absolute top-2 right-2 left-2 sm:left-auto z-[1000] flex flex-col sm:items-end gap-1">
          {cameraView && (
            <div className="hidden sm:block px-2 py-1 rounded bg-slate-950/70 backdrop-blur-sm border border-white/10 text-[8px] font-mono text-slate-400 leading-tight pointer-events-none whitespace-nowrap">
              <div>lat {cameraView.lat} lng {cameraView.lng}</div>
              <div>zoom {cameraView.zoom} pitch {cameraView.pitch}° bear {cameraView.bearing}°</div>
            </div>
          )}
          <div className="flex flex-wrap justify-end gap-1">
            <div className="flex items-center gap-1 px-2 py-1 rounded bg-slate-950/80 backdrop-blur-sm border border-white/10">
              <span className="text-[8px] font-bold uppercase text-slate-500">P</span>
              <input type="range" min={0} max={85} step={1} value={pitch}
                onChange={e => {
                  const v = +e.target.value;
                  setPitch(v);
                  if (mapRef.current) mapRef.current.setPitch(v);
                }}
                className="w-12 sm:w-16 h-1 accent-orange-500 cursor-pointer"
              />
              <span className="text-[9px] font-mono text-slate-400 w-5 sm:w-6 text-right">{Math.round(pitch)}°</span>
              <button onClick={() => { setPitch(0); if (mapRef.current) mapRef.current.setPitch(0); }}
                className="px-1 py-0.5 rounded text-[8px] font-bold text-slate-500 hover:text-white transition-colors"
              >0</button>
            </div>
            <div className="flex items-center gap-1 px-2 py-1 rounded bg-slate-950/80 backdrop-blur-sm border border-white/10">
              <span className="text-[8px] font-bold uppercase text-slate-500 hidden sm:inline">Bear</span>
              <span className="text-[8px] font-bold uppercase text-slate-500 sm:hidden">B</span>
              <input type="range" min={-180} max={180} step={1} value={bearing > 180 ? bearing - 360 : bearing}
                onChange={e => {
                  const v = +e.target.value < 0 ? +e.target.value + 360 : +e.target.value;
                  setBearing(v);
                  if (mapRef.current) mapRef.current.setBearing(+e.target.value);
                }}
                className="w-12 sm:w-16 h-1 accent-orange-500 cursor-pointer"
              />
              <span className="text-[9px] font-mono text-slate-400 w-7 sm:w-8 text-right">{Math.round(bearing)}°</span>
              <button onClick={() => { setBearing(0); if (mapRef.current) mapRef.current.setBearing(0); }}
                className="px-1 py-0.5 rounded text-[8px] font-bold text-slate-500 hover:text-white transition-colors"
              >0</button>
            </div>
          </div>
        </div>

        {/* ── Track detail + Filters inside map at bottom ── */}
        <div className="absolute bottom-0 left-0 right-0 z-30 flex flex-col pointer-events-none">
          {activeTrackId && (() => {
            const track = trackMap.get(activeTrackId);
            if (!track) return null;
            const cfg = getVisualCfg(track);
            return (
              <div className="bg-slate-950/85 backdrop-blur-md border-t border-white/10 px-3 sm:px-6 py-2 sm:py-2.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pointer-events-auto">
                <div className="flex items-center gap-2 sm:gap-3 min-w-0 w-full sm:w-auto">
                  <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full flex-shrink-0" style={{ backgroundColor: cfg.color }} />
                  <div className="min-w-0 flex-1 sm:flex-initial">
                    <div className="flex items-center gap-2">
                      <span className="text-xs sm:text-sm font-bold text-white truncate max-w-[160px] sm:max-w-none">{track.nombre}</span>
                      <span className={`text-[9px] sm:text-[10px] font-bold uppercase ${cfg.text} whitespace-nowrap`}>{cfg.label}</span>
                    </div>
                    <p className="text-[10px] sm:text-[11px] text-slate-500 truncate">
                      {track.sector} · {track.distanciaKm.toFixed(1)} km · +{track.desnivelPositivo}m / -{track.desnivelNegativo}m
                    </p>
                  </div>
                </div>
                <button onClick={() => setSelectedTrackIds(prev => prev.includes(activeTrackId) ? [] : [activeTrackId])}
                  className={`w-full sm:w-auto px-3 py-1 rounded text-[10px] font-bold uppercase tracking-wider transition-colors pointer-events-auto ${
                    selectedTrackIds.includes(activeTrackId)
                      ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                      : 'bg-slate-800 text-slate-300 border border-white/5 hover:bg-orange-500/15 hover:text-orange-400'
                  }`}
                >
                  {selectedTrackIds.includes(activeTrackId) ? 'Seleccionado' : 'Añadir a ruta'}
                </button>
              </div>
            );
          })()}
          <div className="bg-slate-950/85 backdrop-blur-md border-t border-white/10 px-3 sm:px-6 py-1.5 sm:py-2 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-1.5 sm:gap-2 pointer-events-auto">
            <div className="flex items-center gap-1 flex-wrap w-full sm:w-auto">
              <button onClick={() => setDifFilter(null)}
                className={`px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full text-[9px] sm:text-[10px] font-bold uppercase tracking-wider transition-colors ${
                  !difFilter ? 'bg-orange-500/15 text-orange-400 border border-orange-500/30'
                    : 'text-slate-500 border border-white/5 hover:text-slate-300'
                }`}
              >Todas</button>
              {ALL_DIFICULTADES.map(d => {
                const cfg = DIF_CONFIG[d];
                const active = difFilter === d;
                return (
                  <button key={d} onClick={() => setDifFilter(active ? null : d)}
                    className={`inline-flex items-center gap-1.5 px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full text-[9px] sm:text-[10px] font-bold uppercase tracking-wider transition-colors ${
                      active ? `${cfg.color}/15 ${cfg.text} border ${cfg.color}/30`
                        : 'text-slate-500 border border-white/5 hover:text-slate-300'
                    }`}
                  >
                    <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: cfg.color }} />
                    {cfg.label}
                  </button>
                );
              })}
            </div>
            <div className="hidden sm:flex items-center gap-2 text-[9px] text-slate-500 flex-wrap">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ backgroundColor: '#10b981' }} /> Fácil</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ backgroundColor: '#3b82f6' }} /> Media</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ backgroundColor: '#ef4444' }} /> Difícil</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ backgroundColor: '#1e293b', border: '1px solid rgba(255,255,255,0.2)' }} /> Experto</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ backgroundColor: '#f97316' }} /> Enduro</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ backgroundColor: '#64748b' }} /> Cerrado</span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
