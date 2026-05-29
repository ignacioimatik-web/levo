'use client';

import { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import Link from 'next/link';
import { MapContainer, TileLayer, GeoJSON, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { TrackMTB, DificultadMTB } from '@/lib/forfait/types';
import type { SendaSegment } from '@/lib/forfait/senda-utils';
import { splitIntoSendas } from '@/lib/forfait/senda-utils';
import type { Feature, LineString } from 'geojson';

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

/* ─── FlyTo control ─── */
function FlyToControl({ target }: { target: { lat: number; lng: number; zoom: number } | null }) {
  const map = useMap();
  useEffect(() => {
    if (target) map.flyTo([target.lat, target.lng], target.zoom, { duration: 1 });
  }, [target, map]);
  return null;
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
  const [flyTarget, setFlyTarget] = useState<{ lat: number; lng: number; zoom: number } | null>(null);
  const mapRef = useRef<L.Map | null>(null);

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
    if (!sectorBounds) return { lat: 40.6, lng: -0.02, zoom: 15.3 };
    return { lat: (sectorBounds.minLat + sectorBounds.maxLat) / 2, lng: (sectorBounds.minLng + sectorBounds.maxLng) / 2, zoom: 15.3 };
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
    if (sectorBounds) {
      setFlyTarget({ lat: sectorCenter.lat, lng: sectorCenter.lng, zoom: 15.3 });
    }
  }, [sectorBounds]);

  const handleSelectSector = useCallback((name: string) => {
    setActiveSector(name); setActiveTrackId(null); setHoveredTrackId(null);
    setDifFilter(null); setActiveSendaId(null); setExpandedTrackId(null);
  }, []);

  const flyToSenda = useCallback((senda: SendaSegment) => {
    const view = senda.customView || senda.suggestedView;
    setFlyTarget({ lat: view.lat, lng: view.lng, zoom: view.zoom });
    setActiveSendaId(senda.id);
    setExpandedTrackId(senda.trackId);
  }, []);

  /* ── Preset fly ── */
  const flyPreset = useCallback((zoom: number) => {
    if (!mapRef.current) return;
    const c = mapRef.current.getCenter();
    setFlyTarget({ lat: c.lat, lng: c.lng, zoom });
  }, []);

  /* ── GeoJSON styles ── */
  const trackStyle = useCallback((track: TrackMTB) => {
    const isClosed = track.estado === 'cerrado';
    const isHov = hoveredTrackId === track.id;
    const isAct = activeTrackId === track.id;
    const isSel = selectedTrackIds.includes(track.id);
    const hasActiveSenda = activeSenda && activeSenda.trackId === track.id;
    const isDimmed = activeSendaId !== null && !hasActiveSenda;
    const color = isClosed ? DIF_COLORS.gris : track.dificultad === 'doble-negro' ? DIF_COLORS.naranja : DIF_COLORS[track.dificultad] || DIF_COLORS.naranja;
    const weight = isAct ? 5 : isHov ? 4.5 : isSel ? 3.5 : 2.5;
    const opacity = isClosed ? 0.2 : isAct ? 1 : isHov ? 0.9 : isSel ? 0.75 : isDimmed ? 0.12 : 0.45;
    return { color, weight, opacity, dashArray: isClosed ? '5 5' : isSel ? '8 5' : '' };
  }, [hoveredTrackId, activeTrackId, selectedTrackIds, activeSendaId, activeSenda]);

  const sendaStyle: L.PathOptions = { color: '#f97316', weight: 4, opacity: 0.9, dashArray: '6 4' };

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
        <MapContainer center={[sectorCenter.lat, sectorCenter.lng]} zoom={15.3}
          className="w-full h-full absolute inset-0"
          zoomControl={false}
          ref={mapRef as any}
        >
          <TileLayer
            url="https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}"
            maxZoom={20}
            attribution='Google'
          />
          <FlyToControl target={flyTarget} />

          {/* Track layers */}
          {filtered.map(track => {
            const coords = track.points.map(p => [p.lat, p.lng] as [number, number]);
            return (
              <GeoJSON key={track.id}
                data={{ type: 'Feature', geometry: { type: 'LineString', coordinates: coords.map(c => [c[1], c[0]]) }, properties: {} } as Feature<LineString>}
                pathOptions={trackStyle(track)}
                eventHandlers={{
                  mouseover: () => setHoveredTrackId(track.id),
                  mouseout: () => setHoveredTrackId(null),
                  click: () => {
                    setActiveTrackId(track.id);
                    setExpandedTrackId(track.id);
                    setSelectedTrackIds([track.id]);
                  },
                }}
              />
            );
          })}

          {/* Active senda highlight */}
          {activeSenda && (
            <GeoJSON key="active-senda"
              data={{ type: 'Feature', geometry: { type: 'LineString', coordinates: activeSenda.points.map(p => [p.lng, p.lat]) }, properties: {} } as Feature<LineString>}
              pathOptions={sendaStyle}
            />
          )}
        </MapContainer>

        {/* Sector badge */}
        <div className="absolute top-2 left-2 z-[1000] pointer-events-none flex items-center gap-2">
          <span className="px-2.5 py-1 rounded-full bg-slate-950/70 backdrop-blur-sm text-[11px] font-bold text-orange-400 border border-orange-500/30">
            {activeSector}
          </span>
          <span className="px-2 py-0.5 rounded-full bg-slate-950/60 backdrop-blur-sm text-[9px] text-slate-500 border border-white/5">
            Earth Engine
          </span>
        </div>

        {/* Preset buttons */}
        <div className="absolute bottom-2 left-2 z-[1000] flex items-center gap-1">
          {[
            { zoom: 13, label: 'Vista 1' },
            { zoom: 15, label: 'Vista 2' },
            { zoom: 16, label: 'Vista 3' },
          ].map((p, i) => (
            <div key={i} className="group relative">
              <button onClick={() => flyPreset(p.zoom)}
                className="px-1.5 py-1 rounded text-[9px] font-bold font-mono text-white bg-slate-950/80 backdrop-blur-sm border border-white/10 hover:bg-orange-500/20 hover:text-orange-400 transition-colors"
              >
                V{i + 1}
              </button>
              <span className="absolute left-1/2 -top-4 -translate-x-1/2 text-[7px] font-bold uppercase tracking-wider text-slate-400 bg-slate-950/90 backdrop-blur-sm px-1 py-0.5 rounded border border-white/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
                {p.label}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* ACTIVE TRACK DETAIL */}
      {activeTrackId && (() => {
        const track = trackMap.get(activeTrackId);
        if (!track) return null;
        const cfg = getVisualCfg(track);
        return (
          <div className="border-b border-white/5 bg-slate-950/60">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className={`w-3 h-3 rounded-full flex-shrink-0`} style={{ backgroundColor: cfg.color }} />
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-white truncate">{track.nombre}</span>
                    <span className={`text-[10px] font-bold uppercase ${cfg.text}`}>{cfg.label}</span>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    {track.sector} · {track.distanciaKm.toFixed(1)} km · +{track.desnivelPositivo}m / -{track.desnivelNegativo}m
                  </p>
                </div>
              </div>
              <button onClick={() => setSelectedTrackIds(prev => prev.includes(activeTrackId) ? [] : [activeTrackId])}
                className={`px-3 py-1 rounded text-[10px] font-bold uppercase tracking-wider transition-colors ${
                  selectedTrackIds.includes(activeTrackId)
                    ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                    : 'bg-slate-800 text-slate-300 border border-white/5 hover:bg-orange-500/15 hover:text-orange-400'
                }`}
              >
                {selectedTrackIds.includes(activeTrackId) ? 'Seleccionado' : 'Añadir a ruta'}
              </button>
            </div>
          </div>
        );
      })()}

      {/* FILTERS */}
      <div className="z-10 bg-slate-950/90 backdrop-blur-md border-b border-white/5">
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
                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: cfg.color }} />
                  {cfg.label}
                </button>
              );
            })}
          </div>
          <div className="flex items-center gap-2 text-[9px] text-slate-500 flex-wrap">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ backgroundColor: '#10b981' }} /> Fácil</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ backgroundColor: '#3b82f6' }} /> Media</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ backgroundColor: '#ef4444' }} /> Difícil</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ backgroundColor: '#1e293b', border: '1px solid rgba(255,255,255,0.2)' }} /> Experto</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ backgroundColor: '#f97316' }} /> Enduro</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ backgroundColor: '#64748b' }} /> Cerrado</span>
          </div>
        </div>
      </div>
    </div>
  );
}
