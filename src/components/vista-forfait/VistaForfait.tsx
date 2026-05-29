'use client';

import { useMemo, useState, useCallback, useEffect } from 'react';
import Link from 'next/link';
import type { TrackMTB, DificultadMTB } from '@/lib/forfait/types';
import { buildProfileSeries } from '@/lib/forfait/geo-utils';

/* ─── Constants ─── */
const PANORAMA_IMAGE_URL = '/images/panorama-placeholder.svg';
const ASPECT_RATIO = 'aspect-[21/9]';
const STORAGE_KEY = 'forfait-builder-route';

/* ─── Visual mapping: conecta la panorámica con tracks reales ─── */
interface PanoramaTrackMapping {
  trackId: string;
  visualPath: string;
  sectorLabelPosition: { x: number; y: number } | null;
  labelPosition: { x: number; y: number };
}

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

/* ─── Sector regions on 1000x500 viewBox ─── */
const SECTOR_REGIONS: Record<string, { sx: number; sy: number; ex: number; ey: number; spread: number }> = {
  Bergantes:       { sx: 40, sy: 70, ex: 80, ey: 330, spread: 70 },
  Celumbres:       { sx: 190, sy: 50, ex: 230, ey: 310, spread: 65 },
  'El Riu de les Corces': { sx: 340, sy: 90, ex: 390, ey: 340, spread: 75 },
  'Peter Rules':   { sx: 510, sy: 60, ex: 560, ey: 320, spread: 70 },
  'Torre Miró - Xiva': { sx: 690, sy: 80, ex: 750, ey: 330, spread: 80 },
};

/* ─── Generate a winding mountain trail SVG path ─── */
function generateTrailPath(
  region: { sx: number; sy: number; ex: number; ey: number; spread: number },
  seed: number,
  total: number,
): string {
  const t = seed / Math.max(1, total - 1);
  const startX = region.sx + t * 120 + (Math.sin(seed * 3.7) * 20);
  const startY = region.sy + Math.sin(t * 4.1) * 25 + seed * 3;
  const endX = region.ex + (1 - t) * 100 + (Math.cos(seed * 2.3) * 25);
  const endY = region.ey + Math.cos(t * 3.3) * 30 + seed * 2;
  const s = region.spread;

  const segments = [
    { r: 0.2, wx: Math.sin(seed * 5.1) * s, wy: Math.cos(seed * 4.7) * s * 0.6 },
    { r: 0.45, wx: Math.cos(seed * 7.3) * s * 1.1, wy: Math.sin(seed * 6.1) * s * 0.7 },
    { r: 0.7, wx: Math.sin(seed * 9.7) * s * 0.8, wy: Math.cos(seed * 8.3) * s * 0.5 },
  ];

  let path = `M ${startX.toFixed(1)} ${startY.toFixed(1)}`;
  let px = startX, py = startY;

  for (const seg of segments) {
    const mx = startX + (endX - startX) * seg.r + seg.wx;
    const my = startY + (endY - startY) * seg.r + seg.wy;
    const cpx1 = px + (mx - px) * 0.3 + seg.wx * 0.4;
    const cpy1 = py + (my - py) * 0.25 + seg.wy * 0.3;
    const cpx2 = px + (mx - px) * 0.7 + seg.wx * 0.6;
    const cpy2 = py + (my - py) * 0.6 + seg.wy * 0.5;
    path += ` C ${cpx1.toFixed(1)} ${cpy1.toFixed(1)}, ${cpx2.toFixed(1)} ${cpy2.toFixed(1)}, ${mx.toFixed(1)} ${my.toFixed(1)}`;
    px = mx; py = my;
  }

  // Final segment to end
  const fx = endX + Math.sin(seed * 11.3) * 30;
  const fy = endY + Math.cos(seed * 13.7) * 20;
  path += ` C ${(px + (fx - px) * 0.5 + (seed * 2.5)).toFixed(1)} ${(py + (fy - py) * 0.4).toFixed(1)}, ${(px + (fx - px) * 0.8 + (seed * 3.1)).toFixed(1)} ${(py + (fy - py) * 0.7).toFixed(1)}, ${fx.toFixed(1)} ${fy.toFixed(1)}`;

  return path;
}

/* ─── Build panorama ↔ real-track mapping ─── */
function buildPanoramaTrackMappings(tracks: TrackMTB[]): PanoramaTrackMapping[] {
  const trackIndex = new Map<string, TrackMTB>();
  for (const t of tracks) trackIndex.set(t.id, t);

  const bySector = new Map<string, TrackMTB[]>();
  for (const t of tracks) {
    const s = t.sector || 'Otros';
    if (!bySector.has(s)) bySector.set(s, []);
    bySector.get(s)!.push(t);
  }

  const result: PanoramaTrackMapping[] = [];
  for (const [, sectorTracks] of bySector) {
    const region = SECTOR_REGIONS[sectorTracks[0]?.sector];
    if (!region) continue;
    for (let i = 0; i < sectorTracks.length; i++) {
      const t = sectorTracks[i];

      // Safety: only map if the real track exists
      if (!trackIndex.has(t.id)) continue;

      const path = generateTrailPath(region, i, sectorTracks.length);

      // Parse endpoint from path for label position
      const lastCmd = path.split(' ').pop();
      const nums = lastCmd?.match(/[\d.-]+/g);
      const ex = nums ? parseFloat(nums[nums.length - 2]) : region.ex;
      const ey = nums ? parseFloat(nums[nums.length - 1]) : region.ey;

      result.push({
        trackId: t.id,
        visualPath: path,
        sectorLabelPosition: { x: region.sx + 60, y: region.sy - 15 },
        labelPosition: { x: ex, y: ey },
      });
    }
  }
  return result;
}

/* ─── Track label on the panorama ─── */
function PanoramaTrackLabel({ x, y, label, color }: { x: number; y: number; label: string; color: string }) {
  return (
    <div
      className="absolute px-2 py-0.5 rounded-md bg-slate-950/60 backdrop-blur-sm border border-white/10 text-[10px] font-medium text-white shadow-lg pointer-events-none whitespace-nowrap"
      style={{ left: `${x}%`, top: `${y}%`, transform: 'translate(-50%, -50%)', borderLeftColor: color, borderLeftWidth: 3 }}
    >
      {label}
    </div>
  );
}

/* ─── Sector labels in SVG viewBox (estilo mapa de estación) ─── */
const PANORAMA_SECTORS: { name: string; x: number; y: number }[] = [
  { name: 'Bergantes', x: 100, y: 55 },
  { name: 'Celumbres', x: 240, y: 35 },
  { name: 'El Riu de les Corces', x: 400, y: 65 },
  { name: 'Peter Rules', x: 570, y: 40 },
  { name: 'Torre Miró - Xiva', x: 760, y: 55 },
];

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

/* ─── Track row (compact, responsive) ─── */
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

/* ─── Interactive SVG trail ─── */
function TrailSvgPath({
  mapping,
  color,
  isClosed,
  isHovered,
  isActive,
  isSelected,
}: {
  mapping: PanoramaTrackMapping;
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
      {/* Permanent subtle glow so lines stand out over the image */}
      <path
        d={mapping.visualPath}
        fill="none"
        stroke={isClosed ? '#000000' : '#000000'}
        strokeWidth={glowWidth + 4}
        strokeOpacity={0.35}
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ filter: 'blur(4px)' }}
      />
      {/* Colored glow */}
      {(glowOpacity > 0) && (
        <path
          d={mapping.visualPath}
          fill="none"
          stroke={color}
          strokeWidth={glowWidth}
          strokeOpacity={glowOpacity}
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ filter: 'blur(3px)' }}
        />
      )}
      {/* Main path */}
      <path
        d={mapping.visualPath}
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
      {/* Endpoint dot */}
      {(isHovered || isActive) && (
        <circle
          cx={0} cy={0} r={isActive ? 5 : 4}
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

/* ─── Main component ─── */
export default function VistaForfait({ tracks }: { tracks: TrackMTB[] }) {
  const [difFilter, setDifFilter] = useState<DificultadMTB | null>(null);
  const [hoveredTrackId, setHoveredTrackId] = useState<string | null>(null);
  const [activeTrackId, setActiveTrackId] = useState<string | null>(null);
  const [selectedTrackIds, setSelectedTrackIds] = useState<string[]>([]);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);
  const [sectorFilter, setSectorFilter] = useState<string | null>(null);
  const [showLegend, setShowLegend] = useState(false);

  const filtered = useMemo(() => {
    let result = tracks;
    if (difFilter) result = result.filter(t => t.dificultad === difFilter);
    return result;
  }, [tracks, difFilter]);

  // Sync selectedTrackIds with ForfaitBuilder's localStorage
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

  const sectorsList = useMemo(() => [...new Set(tracks.map(t => t.sector))], [tracks]);

  const trackMappings = useMemo(() => buildPanoramaTrackMappings(tracks), [tracks]);

  const trackMap = useMemo(() => {
    const m = new Map<string, TrackMTB>();
    for (const t of tracks) m.set(t.id, t);
    return m;
  }, [tracks]);

  const handleTrackHover = useCallback((id: string | null) => {
    setHoveredTrackId(id);
  }, []);

  const handleSvgHover = useCallback((id: string | null) => {
    setHoveredTrackId(id);
    if (!id) setTooltipPos(null);
  }, []);

  const handleSvgMove = useCallback((e: React.MouseEvent, trackId: string) => {
    if (!hoveredTrackId) return;
    const rect = e.currentTarget.closest('.panorama-container')?.getBoundingClientRect();
    if (!rect) return;
    setTooltipPos({
      x: ((e.clientX - rect.left) / rect.width) * 100,
      y: ((e.clientY - rect.top) / rect.height) * 100,
    });
  }, [hoveredTrackId]);

  const handleSvgTouch = useCallback((id: string) => {
    setHoveredTrackId(id);
    setActiveTrackId(prev => prev === id ? null : id);
  }, []);

  const handleSvgClick = useCallback((id: string) => {
    setActiveTrackId(prev => prev === id ? null : id);
  }, []);

  const handleSelectTrack = useCallback((id: string) => {
    setActiveTrackId(prev => prev === id ? null : id);
    setSelectedTrackIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id],
    );
  }, []);

  const handleSectorClick = useCallback((name: string) => {
    setSectorFilter(prev => prev === name ? null : name);
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">

      <style>{`.touch-manipulation { touch-action: manipulation; }`}</style>

      {/* ── NAVEGACIÓN RESPONSIVE ── */}
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
            <div className="hidden sm:flex items-center gap-0.5 ml-2">
              <Link href="/forfait" className="px-2 py-1 rounded text-[10px] font-bold uppercase tracking-widest transition-colors text-slate-500 hover:text-slate-300">Forfait</Link>
              <span className="text-slate-600 text-[10px] mx-0.5">·</span>
              <span className="px-2 py-1 rounded text-[10px] font-bold uppercase tracking-widest text-slate-500">Mapa técnico</span>
              <span className="text-slate-600 text-[10px] mx-0.5">·</span>
              <span className="px-2 py-1 rounded text-[10px] font-bold uppercase tracking-widest bg-orange-500/15 text-orange-400">Vista Forfait</span>
            </div>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-slate-500 flex-shrink-0">
            <span>{tracks.length}</span>
            <span className="hidden sm:inline">sendas</span>
            <span className="hidden xs:inline">·</span>
            <span className="hidden xs:inline">{sectorsList.length} sectores</span>
          </div>
        </div>
      </nav>

      {/* ── PANORAMA ── */}
      <section className="panorama-container relative w-full overflow-hidden bg-slate-900 max-h-[40vh] sm:max-h-[50vh] lg:max-h-none">
        <div className={`relative w-full h-full min-h-[30vh] sm:min-h-[35vh] lg:min-h-0 ${ASPECT_RATIO}`}>
          <img
            src={PANORAMA_IMAGE_URL}
            alt="Panorámica bike resort"
            className="absolute inset-0 w-full h-full object-cover"
          />

          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/10 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-r from-slate-950/40 to-transparent" />

          {/* SVG overlay — viewBox fijo 1000x500, escala con el contenedor */}
          <svg
            className="svg-overlay absolute inset-0 w-full h-full"
            viewBox="0 0 1000 500"
            preserveAspectRatio="xMidYMid meet"
          >
            {trackMappings.map(m => {
              const track = trackMap.get(m.trackId);
              // Si no encuentra el track real, no dibuja nada
              if (!track) return null;
              if (difFilter && track.dificultad !== difFilter) return null;
              const hovered = hoveredTrackId === m.trackId;
              const active = activeTrackId === m.trackId;
              const dimmed = !!(sectorFilter && track.sector !== sectorFilter);
              return (
                <g key={m.trackId} className={dimmed ? 'opacity-20' : ''}>
                  {/* Hit area invisble (20px) para hover/click/touch */}
                  <path
                    d={m.visualPath}
                    fill="none"
                    stroke="transparent"
                    strokeWidth={20}
                    className="cursor-pointer touch-manipulation"
                    onMouseEnter={() => handleSvgHover(m.trackId)}
                    onMouseMove={e => handleSvgMove(e, m.trackId)}
                    onMouseLeave={() => handleSvgHover(null)}
                    onClick={() => handleSvgClick(m.trackId)}
                    onTouchStart={e => { e.preventDefault(); handleSvgTouch(m.trackId); }}
                  />
                  <TrailSvgPath
                    mapping={m}
                    color={getVisualColor(track)}
                    isClosed={track.estado === 'cerrado'}
                    isHovered={hovered}
                    isActive={active}
                    isSelected={selectedTrackIds.includes(m.trackId)}
                  />
                </g>
              );
            })}
          </svg>

          {/* Tooltip flotante sobre la imagen (hover SVG) */}
          {hoveredTrackId && tooltipPos && (() => {
            const track = trackMap.get(hoveredTrackId);
            if (!track) return null;
            if (sectorFilter && track.sector !== sectorFilter) return null;
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

          {/* Name label for hovered/active (sobre la línea en la imagen) */}
          {trackMappings.map(m => {
            const track = trackMap.get(m.trackId);
            if (!track) return null;
            if (difFilter && track.dificultad !== difFilter) return null;
            if (sectorFilter && track.sector !== sectorFilter) return null;
            const show = hoveredTrackId === m.trackId || activeTrackId === m.trackId;
            if (!show) return null;
            const pctX = (m.labelPosition.x / 1000) * 100;
            const pctY = (m.labelPosition.y / 500) * 100;
            return (
              <PanoramaTrackLabel
                key={`label-${m.trackId}`}
                x={pctX}
                y={pctY}
                label={track.nombre}
                color={getVisualColor(track)}
              />
            );
          })}

          {/* Sector labels (en SVG, estilo mapa de estación) */}
          {PANORAMA_SECTORS.map(s => {
            const active = sectorFilter === s.name;
            const w = s.name.length * 8 + 28;
            return (
              <g
                key={s.name}
                className="cursor-pointer"
                onClick={() => handleSectorClick(s.name)}
                pointerEvents="bounding-box"
              >
                <rect
                  x={s.x - w / 2}
                  y={s.y - 15}
                  width={w}
                  height={30}
                  rx={15}
                  fill={active ? 'rgba(249,115,22,0.25)' : 'rgba(2,6,23,0.65)'}
                  stroke={active ? '#f97316' : 'rgba(255,255,255,0.12)'}
                  strokeWidth={active ? 1.5 : 1}
                  className="transition-all duration-200"
                />
                <text
                  x={s.x}
                  y={s.y + 5}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill={active ? '#f97316' : 'rgba(255,255,255,0.85)'}
                  fontSize={11}
                  fontWeight="bold"
                  fontFamily="system-ui, sans-serif"
                  letterSpacing="0.5"
                  className="transition-colors duration-200"
                >
                  {s.name}
                </text>
              </g>
            );
          })}
        </div>
      </section>

      {/* ── DETALLE ACTIVO ── */}
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

      {/* ── FILTERS + SECTOR INDICATOR + LEGEND ── */}
      <div className={`${activeTrackId ? '' : 'sticky top-0'} z-10 bg-slate-950/90 backdrop-blur-md border-b border-white/5`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2.5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 flex-wrap">
            {/* Difficulty filter */}
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

            {/* Sector filter indicator */}
            {sectorFilter && (
              <button
                onClick={() => setSectorFilter(null)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider transition-colors bg-orange-500/10 text-orange-400 border border-orange-500/30"
              >
                {sectorFilter}
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>

          {/* Leyenda: siempre visible en sm+, plegable en móvil */}
          <div className="flex items-center gap-1 sm:gap-3 text-[10px] text-slate-500">
            {/* Mobile toggle */}
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
            {/* Dots on mobile always visible, text only when toggled or on sm+ */}
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

      {/* ── TRACK LISTING RESPONSIVE ── */}
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
              <div key={t.id} className={sectorFilter && t.sector !== sectorFilter ? 'opacity-20' : ''}>
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
