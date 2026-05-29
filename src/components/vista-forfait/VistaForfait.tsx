'use client';

import { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import Link from 'next/link';
import type { TrackMTB, DificultadMTB, TrackPoint } from '@/lib/forfait/types';
import { buildProfileSeries } from '@/lib/forfait/geo-utils';

/* ─── Types ─── */
interface Bounds {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}

/* ─── Constants ─── */
const STORAGE_KEY = 'forfait-builder-route';

const DIF_COLORS: Record<string, string> = {
  verde: '#10b981',
  azul: '#3b82f6',
  rojo: '#ef4444',
  negro: '#1e293b',
  'doble-negro': '#f97316',
  naranja: '#f97316',
  gris: '#64748b',
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
const MAX_GPX_POINTS = 200;

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

/* ─── Geo helpers ─── */
function downsamplePoints(points: TrackPoint[], max: number): TrackPoint[] {
  if (points.length <= max) return points;
  const step = (points.length - 1) / (max - 1);
  return Array.from({ length: max }, (_, i) => points[Math.round(i * step)]);
}

function computeBounds(tracks: TrackMTB[]): Bounds {
  let minLat = 90, maxLat = -90, minLng = 180, maxLng = -180;
  let valid = false;
  for (const t of tracks) {
    for (const p of t.points) {
      minLat = Math.min(minLat, p.lat);
      maxLat = Math.max(maxLat, p.lat);
      minLng = Math.min(minLng, p.lng);
      maxLng = Math.max(maxLng, p.lng);
      valid = true;
    }
  }
  if (!valid) return { minLat: 40.6, maxLat: 40.7, minLng: -0.2, maxLng: 0 };
  const padLat = (maxLat - minLat) * 0.1 || 0.01;
  const padLng = (maxLng - minLng) * 0.1 || 0.01;
  return {
    minLat: minLat - padLat,
    maxLat: maxLat + padLat,
    minLng: minLng - padLng,
    maxLng: maxLng + padLng,
  };
}

function geoToViewBox(lng: number, lat: number, bounds: Bounds): { x: number; y: number } {
  return {
    x: ((lng - bounds.minLng) / (bounds.maxLng - bounds.minLng)) * 1000,
    y: ((bounds.maxLat - lat) / (bounds.maxLat - bounds.minLat)) * 500,
  };
}

function generateGpxPath(pts: TrackPoint[], bounds: Bounds) {
  const viewPts = pts.map(p => geoToViewBox(p.lng, p.lat, bounds));
  const d = viewPts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join('');
  const last = viewPts[viewPts.length - 1];
  return { d, endX: last.x, endY: last.y };
}

/* ─── Sector card ─── */
function SectorCard({
  name,
  trackCount,
  difficulties,
  totalKm,
  onClick,
}: {
  name: string;
  trackCount: number;
  difficulties: DificultadMTB[];
  totalKm: number;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="relative flex flex-col items-start p-6 sm:p-8 rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 border border-white/[0.06] hover:border-orange-500/30 transition-all text-left group cursor-pointer shadow-xl"
    >
      <h3 className="text-base sm:text-lg font-bold text-white group-hover:text-orange-400 transition-colors">
        {name}
      </h3>
      <p className="text-sm text-slate-400 mt-1.5">
        {trackCount} {trackCount === 1 ? 'senda' : 'sendas'}
        <span className="text-slate-600 mx-2">·</span>
        {totalKm.toFixed(0)} km
      </p>
      <div className="flex items-center gap-1.5 mt-3">
        {difficulties.map(d => (
          <span key={d} className={`w-2.5 h-2.5 rounded-full ${DIF_CONFIG[d]?.color || 'bg-slate-500'}`} title={DIF_CONFIG[d]?.label || d} />
        ))}
      </div>
    </button>
  );
}

/* ─── Trail SVG ─── */
function TrailSvgPath({
  d,
  endX,
  endY,
  color,
  isClosed,
  isHovered,
  isActive,
  isSelected,
}: {
  d: string;
  endX: number;
  endY: number;
  color: string;
  isClosed: boolean;
  isHovered: boolean;
  isActive: boolean;
  isSelected: boolean;
}) {
  let strokeWidth = 2.5;
  let opacity = isClosed ? 0.2 : 0.45;
  let glowOpacity = 0.15;
  let glowWidth = 6;

  if (isActive) {
    strokeWidth = 5;
    opacity = 1;
    glowOpacity = 0.5;
    glowWidth = 14;
  } else if (isHovered) {
    strokeWidth = 4.5;
    opacity = 0.9;
    glowOpacity = 0.4;
    glowWidth = 12;
  } else if (isSelected) {
    strokeWidth = 3.5;
    opacity = 0.75;
    glowOpacity = 0.25;
    glowWidth = 8;
  }

  const dash = isClosed ? '5,5' : isSelected ? '8,5' : 'none';

  return (
    <g>
      <path
        d={d}
        fill="none"
        stroke="#000000"
        strokeWidth={glowWidth + 4}
        strokeOpacity={0.35}
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ filter: 'blur(4px)' }}
      />
      {glowOpacity > 0 && (
        <path
          d={d}
          fill="none"
          stroke={color}
          strokeWidth={glowWidth}
          strokeOpacity={glowOpacity}
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ filter: 'blur(3px)' }}
        />
      )}
      <path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeOpacity={opacity}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={dash}
        className="transition-[stroke-width,stroke-opacity] duration-200"
        vectorEffect="non-scaling-stroke"
      />
      {(isHovered || isActive) && (
        <circle
          cx={endX}
          cy={endY}
          r={isActive ? 5 : 4}
          fill={color}
          opacity={0.95}
          stroke="#000000"
          strokeWidth={1.5}
          strokeOpacity={0.5}
          className="transition-all duration-200"
        />
      )}
    </g>
  );
}

/* ─── Mini elevation SVG ─── */
function MiniElevation({ points }: { points: TrackMTB['points'] }) {
  const series = useMemo(() => buildProfileSeries(points), [points]);
  if (series.length < 2) return null;
  const w = 200, h = 40;
  const min = Math.min(...series.map(p => p.elevationM));
  const max = Math.max(...series.map(p => p.elevationM));
  const range = Math.max(1, max - min);
  const maxKm = Math.max(...series.map(p => p.km), 1);
  const sx = (km: number) => (km / maxKm) * w;
  const sy = (e: number) => h - ((e - min) / range) * (h - 4) - 2;
  const d = series.map((p, i) => `${i === 0 ? 'M' : 'L'}${sx(p.km).toFixed(1)},${sy(p.elevationM).toFixed(1)}`).join('');
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="shrink-0 w-full h-auto" preserveAspectRatio="none">
      <path d={`${d}L${w},${h}L0,${h}Z`} fill="rgba(249,115,22,0.08)" />
      <path d={d} fill="none" stroke="#f97316" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* ─── Badge styles ─── */
const ESTADO_STYLES: Record<string, string> = {
  abierto: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
  cerrado: 'bg-slate-500/10 text-slate-400 border-slate-500/30',
  precaucion: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
  revision: 'bg-orange-500/10 text-orange-400 border-orange-500/30',
};

/* ─── Track row ─── */
function TrackRow({
  track,
  isHovered,
  isSelected,
  onHover,
  onLeave,
  onSelect,
}: {
  track: TrackMTB;
  isHovered: boolean;
  isSelected: boolean;
  onHover: () => void;
  onLeave: () => void;
  onSelect: () => void;
}) {
  const cfg = getVisualConfig(track);
  const isClosed = track.estado === 'cerrado';
  return (
    <div
      className={`flex items-start gap-2 sm:gap-2 px-4 py-3 sm:px-3 sm:py-2.5 transition-all cursor-pointer group ${
        isClosed ? 'opacity-40' : ''
      } ${
        isSelected
          ? 'bg-orange-500/8 border-l-[3px] sm:border-l-2 border-orange-500'
          : isHovered
          ? 'bg-white/[0.06] border-l-[3px] sm:border-l-2 border-white/20'
          : 'hover:bg-white/[0.03] border-l-[3px] sm:border-l-2 border-transparent'
      }`}
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
      onClick={onSelect}
    >
      <div className={`w-3 h-3 sm:w-2 sm:h-2 rounded-full flex-shrink-0 mt-1 ${cfg.color} ${isHovered || isSelected ? 'ring-2 ring-offset-1 ring-offset-slate-950 ring-white/30' : ''}`} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className={`text-sm font-semibold truncate transition-colors ${
            isHovered || isSelected ? 'text-orange-400' : isClosed ? 'text-slate-500' : 'text-white'
          }`}>
            {track.nombre}
          </span>
          <button
            onClick={e => { e.stopPropagation(); onSelect(); }}
            className={`flex-shrink-0 px-3 py-1 sm:px-2 sm:py-0.5 rounded text-[11px] sm:text-[10px] font-bold uppercase tracking-wider transition-colors ${
              isSelected
                ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                : 'bg-slate-800 text-slate-400 border border-white/5 hover:bg-orange-500/15 hover:text-orange-400'
            }`}
          >
            {isSelected ? 'Seleccionado' : 'Añadir'}
          </button>
        </div>
        <p className="text-xs sm:text-[11px] text-slate-500 mt-0.5">
          {track.sector} · {track.distanciaKm.toFixed(1)} km · +{track.desnivelPositivo}m
          <span className="text-slate-600 ml-1">T{track.nivelTecnico}/F{track.exigenciaFisica}</span>
        </p>
        <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 sm:px-1.5 sm:py-0.5 rounded text-[10px] sm:text-[9px] font-bold uppercase tracking-wider border ${cfg.text} ${cfg.badge}`}>
            <span className={`w-1.5 h-1.5 sm:w-1 sm:h-1 rounded-full ${cfg.color}`} />
            {cfg.label}
          </span>
          {track.estado !== 'abierto' && (
            <span className={`px-2 py-0.5 sm:px-1.5 sm:py-0.5 rounded text-[10px] sm:text-[9px] font-bold uppercase tracking-wider border ${ESTADO_STYLES[track.estado] || 'bg-slate-500/10 text-slate-400 border-slate-500/30'}`}>
              {track.estado}
            </span>
          )}
          <span className="px-2 py-0.5 sm:px-1.5 sm:py-0.5 rounded text-[10px] sm:text-[9px] font-mono bg-slate-800 text-slate-500 border border-white/5">
            {track.dataStatus === 'real' ? 'REAL' : 'DEMO'}
          </span>
        </div>
      </div>
    </div>
  );
}

/* ─── Main component ─── */
export default function VistaForfait({ tracks }: { tracks: TrackMTB[] }) {
  const [difFilter, setDifFilter] = useState<DificultadMTB | null>(null);
  const [hoveredTrackId, setHoveredTrackId] = useState<string | null>(null);
  const [activeTrackId, setActiveTrackId] = useState<string | null>(null);
  const [selectedTrackIds, setSelectedTrackIds] = useState<string[]>([]);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);
  const [showLegend, setShowLegend] = useState(false);
  const [activeSector, setActiveSector] = useState<string | null>(null);
  const panoramaRef = useRef<HTMLDivElement>(null);

  /* ── Computed sector data ── */
  const sectorsData = useMemo(() => {
    const map = new Map<string, TrackMTB[]>();
    for (const t of tracks) {
      const s = t.sector || 'Otros';
      if (!map.has(s)) map.set(s, []);
      map.get(s)!.push(t);
    }
    return Array.from(map.entries())
      .map(([name, st]) => ({
        name,
        tracks: st,
        count: st.length,
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

  const mapboxUrl = useMemo(() => {
    if (!sectorBounds) return '';
    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || '';
    if (!token) return '';
    const { minLng, minLat, maxLng, maxLat } = sectorBounds;
    return `https://api.mapbox.com/styles/v1/mapbox/satellite-streets-v12/static/${minLng},${minLat},${maxLng},${maxLat}/1280x640@2x?access_token=${token}&logo=false`;
  }, [sectorBounds]);

  const gpxPaths = useMemo(() => {
    if (!sectorBounds || sectorTracks.length === 0) return [];
    return sectorTracks.map(t => {
      const pts = downsamplePoints(t.points, MAX_GPX_POINTS);
      return { trackId: t.id, ...generateGpxPath(pts, sectorBounds) };
    });
  }, [sectorTracks, sectorBounds]);

  const trackMap = useMemo(() => {
    const m = new Map<string, TrackMTB>();
    for (const t of tracks) m.set(t.id, t);
    return m;
  }, [tracks]);

  /* ── Filtered (for TrackRow list) ── */
  const filtered = useMemo(() => {
    let result = activeSector ? tracks.filter(t => t.sector === activeSector) : [];
    if (difFilter) result = result.filter(t => t.dificultad === difFilter);
    return result;
  }, [tracks, difFilter, activeSector]);

  /* ── localStorage sync with ForfaitBuilder ── */
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        if (Array.isArray(saved.trackIds) && saved.trackIds.length > 0) {
          setSelectedTrackIds(saved.trackIds);
        }
      }
    } catch { /* empty */ }
  }, []);

  useEffect(() => {
    try {
      if (selectedTrackIds.length > 0) {
        const raw = localStorage.getItem(STORAGE_KEY);
        const existing = raw ? JSON.parse(raw) : { routeName: 'Mi ruta Forfait' };
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
          trackIds: selectedTrackIds,
          routeName: existing.routeName || 'Mi ruta Forfait',
        }));
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch { /* empty */ }
  }, [selectedTrackIds]);

  /* ── Handlers ── */
  const handleTrackHover = useCallback((id: string | null) => setHoveredTrackId(id), []);
  const handleSvgHover = useCallback((id: string | null) => {
    setHoveredTrackId(id);
    if (!id) setTooltipPos(null);
  }, []);
  const handleSvgMove = useCallback((e: React.MouseEvent) => {
    if (!hoveredTrackId) return;
    const rect = panoramaRef.current?.getBoundingClientRect();
    if (!rect) return;
    setTooltipPos({
      x: ((e.clientX - rect.left) / rect.width) * 100,
      y: ((e.clientY - rect.top) / rect.height) * 100,
    });
  }, [hoveredTrackId]);
  const handleSvgTouch = useCallback((id: string) => {
    setHoveredTrackId(id);
    setActiveTrackId(prev => (prev === id ? null : id));
  }, []);
  const handleSvgClick = useCallback((id: string) => {
    setActiveTrackId(prev => (prev === id ? null : id));
  }, []);
  const handleSelectTrack = useCallback((id: string) => {
    setActiveTrackId(prev => (prev === id ? null : id));
    setSelectedTrackIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id],
    );
  }, []);
  const handleBackToSectors = useCallback(() => {
    setActiveSector(null);
    setActiveTrackId(null);
    setHoveredTrackId(null);
    setDifFilter(null);
  }, []);

  /* ── Render: Sector cards ── */
  if (!activeSector) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col">
        <nav className="relative z-20 bg-slate-950/90 backdrop-blur-md border-b border-white/5">
          <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-12 sm:h-14 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <Link
                href="/forfait"
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
              <SectorCard
                key={s.name}
                name={s.name}
                trackCount={s.count}
                difficulties={s.difficulties}
                totalKm={s.totalKm}
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
      <style>{`.touch-manipulation { touch-action: manipulation; }`}</style>

      {/* ── NAV ── */}
      <nav className="relative z-20 bg-slate-950/90 backdrop-blur-md border-b border-white/5">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-12 sm:h-14 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <button
              onClick={handleBackToSectors}
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

      {/* ── PANORAMA ── */}
      <section
        ref={panoramaRef}
        className="panorama-container relative w-full overflow-hidden bg-slate-900 max-h-[40vh] sm:max-h-[50vh] lg:max-h-none"
      >
        <div className="relative w-full h-full min-h-[30vh] sm:min-h-[35vh] lg:min-h-0 aspect-[2/1]">
          {mapboxUrl ? (
            <img
              src={mapboxUrl}
              alt={`Mapa satélite ${activeSector}`}
              className="absolute inset-0 w-full h-full object-cover"
              onError={e => {
                (e.currentTarget as HTMLImageElement).src = '/images/panorama-placeholder.svg';
              }}
            />
          ) : (
            <img
              src="/images/panorama-placeholder.svg"
              alt="Panorámica"
              className="absolute inset-0 w-full h-full object-cover"
            />
          )}

          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/10 to-transparent pointer-events-none" />
          <div className="absolute inset-0 bg-gradient-to-r from-slate-950/40 to-transparent pointer-events-none" />

          {/* Sector name overlay */}
          <div className="absolute top-3 left-3 z-20 pointer-events-none">
            <span className="px-3 py-1 rounded-full bg-slate-950/70 backdrop-blur-sm text-xs font-bold text-orange-400 border border-orange-500/30">
              {activeSector}
            </span>
          </div>

          {/* Mapbox attribution */}
          <div className="absolute bottom-1 right-1 z-20 pointer-events-none text-[9px] text-white/50">
            © Mapbox © OpenStreetMap
          </div>

          {/* SVG overlay */}
          <svg
            className="svg-overlay absolute inset-0 w-full h-full"
            viewBox="0 0 1000 500"
            preserveAspectRatio="xMidYMid slice"
          >
            {gpxPaths.map(({ trackId, d, endX, endY }) => {
              const track = trackMap.get(trackId);
              if (!track) return null;
              if (difFilter && track.dificultad !== difFilter) return null;
              const hovered = hoveredTrackId === trackId;
              const active = activeTrackId === trackId;
              return (
                <g key={trackId}>
                  <path
                    d={d}
                    fill="none"
                    stroke="transparent"
                    strokeWidth={20}
                    className="cursor-pointer touch-manipulation"
                    onMouseEnter={() => handleSvgHover(trackId)}
                    onMouseMove={handleSvgMove}
                    onMouseLeave={() => handleSvgHover(null)}
                    onClick={() => handleSvgClick(trackId)}
                    onTouchStart={e => { e.preventDefault(); handleSvgTouch(trackId); }}
                  />
                  <TrailSvgPath
                    d={d}
                    endX={endX}
                    endY={endY}
                    color={getVisualColor(track)}
                    isClosed={track.estado === 'cerrado'}
                    isHovered={hovered}
                    isActive={active}
                    isSelected={selectedTrackIds.includes(trackId)}
                  />
                </g>
              );
            })}

            {/* Track name labels on hover/active */}
            {gpxPaths.map(({ trackId, endX, endY }) => {
              const track = trackMap.get(trackId);
              if (!track) return null;
              if (difFilter && track.dificultad !== difFilter) return null;
              const show = hoveredTrackId === trackId || activeTrackId === trackId;
              if (!show) return null;
              return (
                <text
                  key={`lbl-${trackId}`}
                  x={endX + 10}
                  y={endY - 6}
                  fill="#ffffff"
                  fontSize={11}
                  fontWeight="bold"
                  fontFamily="system-ui, sans-serif"
                  pointerEvents="none"
                  className="drop-shadow-lg"
                >
                  {track.nombre}
                </text>
              );
            })}
          </svg>

          {/* Tooltip flotante */}
          {hoveredTrackId && tooltipPos && (() => {
            const track = trackMap.get(hoveredTrackId);
            if (!track) return null;
            const cfg = getVisualConfig(track);
            return (
              <div
                className="absolute z-30 px-2.5 py-1.5 rounded-lg bg-slate-950/85 backdrop-blur-md border border-white/10 shadow-xl pointer-events-none text-[11px] whitespace-nowrap"
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
                <button
                  onClick={() => handleSelectTrack(activeTrackId)}
                  className={`px-3 py-1 rounded text-[10px] font-bold uppercase tracking-wider transition-colors ${
                    selectedTrackIds.includes(activeTrackId)
                      ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                      : 'bg-slate-800 text-slate-300 border border-white/5 hover:bg-orange-500/15 hover:text-orange-400'
                  }`}
                >
                  {selectedTrackIds.includes(activeTrackId) ? 'Seleccionado' : 'Añadir a ruta'}
                </button>
                <button
                  onClick={() => setActiveTrackId(null)}
                  className="p-1 text-slate-500 hover:text-white transition-colors"
                  aria-label="Cerrar detalle"
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
            <button
              onClick={() => setDifFilter(null)}
              className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider transition-colors ${
                !difFilter
                  ? 'bg-orange-500/15 text-orange-400 border border-orange-500/30'
                  : 'text-slate-500 border border-white/5 hover:text-slate-300'
              }`}
            >
              Todas
            </button>
            {ALL_DIFICULTADES.map(d => {
              const cfg = DIF_CONFIG[d];
              const active = difFilter === d;
              return (
                <button
                  key={d}
                  onClick={() => setDifFilter(active ? null : d)}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider transition-colors ${
                    active
                      ? `${cfg.color}/15 ${cfg.text} border ${cfg.color}/30`
                      : 'text-slate-500 border border-white/5 hover:text-slate-300'
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${cfg.color}`} />
                  {cfg.label}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-1 sm:gap-3 text-[10px] text-slate-500">
            <button
              onClick={() => setShowLegend(v => !v)}
              className="flex sm:hidden items-center gap-1 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider border border-white/5 text-slate-500 hover:text-slate-300 transition-colors"
              aria-label="Toggle legend"
            >
              <span>Leyenda</span>
              <svg className={`w-3 h-3 transition-transform ${showLegend ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            <div className={`flex items-center gap-2 sm:gap-3 flex-wrap ${showLegend ? '' : 'hidden'} sm:flex`}>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" /> <span className="hidden sm:inline">Fácil</span></span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500" /> <span className="hidden sm:inline">Media</span></span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500" /> <span className="hidden sm:inline">Difícil</span></span>
              <span className="hidden sm:flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-slate-700 border border-white/20" /> Experto</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-orange-500" /> <span className="hidden sm:inline">Enduro</span></span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-slate-500" /> <span className="hidden sm:inline">Cerrado</span></span>
            </div>
          </div>
        </div>
      </div>

      {/* ── TRACK LIST ── */}
      <section className="flex-1 max-w-7xl mx-auto w-full px-3 sm:px-6 lg:px-8 py-4 sm:py-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
        <div className="flex items-center justify-between mb-3 sm:mb-4">
          <h2 className="text-xs font-bold text-white uppercase tracking-wider">
            Sendas <span className="text-orange-400">{filtered.length}</span>
          </h2>
          <p className="text-[11px] text-slate-500">
            {filtered.reduce((s, t) => s + t.distanciaKm, 0).toFixed(0)} km totales
          </p>
        </div>

        <div className="divide-y divide-white/[0.04] border border-white/[0.04] rounded-xl overflow-hidden">
          {filtered.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-12">No hay sendas con este filtro.</p>
          ) : (
            filtered.map(t => (
              <div key={t.id}>
                <TrackRow
                  track={t}
                  isHovered={hoveredTrackId === t.id}
                  isSelected={selectedTrackIds.includes(t.id)}
                  onHover={() => handleTrackHover(t.id)}
                  onLeave={() => handleTrackHover(null)}
                  onSelect={() => handleSelectTrack(t.id)}
                />
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
