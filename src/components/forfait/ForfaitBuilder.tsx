'use client';

import { useMemo, useState, useCallback, useEffect } from 'react';
import dynamic from 'next/dynamic';
import {
  List, AlertTriangle, Download, Plus, Trash2, ArrowUp, ArrowDown,
  Search, X, MapIcon, Route, Save, Copy, ChevronUp,
} from 'lucide-react';
import type { TrackMTB, FiltrosForfait, NivelUsuario, DificultadMTB } from '@/lib/forfait/types';
import {
  detectAllConnections, sugerirSiguientesTracks, buildRouteFromTracks,
  defaultFilters,
} from '@/lib/forfait/geo-utils';
import { exportarRutaGPX, descargarGPX } from '@/lib/forfait/gpx-export';

const MTBMap = dynamic(() => import('@/components/forfait/MTBMap'), { ssr: false });
const ElevationProfile = dynamic(() => import('@/components/forfait/ElevationProfile'), { ssr: false });

const DIF_COLORS: Record<string, string> = {
  verde: 'bg-teal-500', azul: 'bg-blue-600', rojo: 'bg-orange-500',
  negro: 'bg-slate-700', 'doble-negro': 'bg-black',
};
const DIF_TEXT: Record<string, string> = {
  verde: 'bg-teal-500/10 text-teal-400 border-teal-500/30',
  azul: 'bg-blue-600/10 text-blue-400 border-blue-600/30',
  rojo: 'bg-orange-500/10 text-orange-400 border-orange-500/30',
  negro: 'bg-slate-700/30 text-slate-300 border-slate-600/30',
  'doble-negro': 'bg-black/30 text-white border-slate-700/30',
};
const ESTADO_BADGE: Record<string, string> = {
  abierto: 'bg-green-500/10 text-green-400 border-green-500/30',
  cerrado: 'bg-gray-500/10 text-gray-400 border-gray-500/30',
  precaucion: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',
  revision: 'bg-orange-500/10 text-orange-400 border-orange-500/30',
};

const STORAGE_KEY = 'forfait-builder-route';

interface SavedRoute {
  trackIds: string[];
  routeName: string;
}

function loadSavedRoute(): SavedRoute | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function saveRoute(trackIds: string[], routeName: string) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ trackIds, routeName }));
  } catch { /* empty */ }
}

function clearSavedRoute() {
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* empty */ }
}

export default function ForfaitBuilder({ tracks }: { tracks: TrackMTB[] }) {
  const [filters, setFilters] = useState<FiltrosForfait>(defaultFilters());
  const [selectedTrackId, setSelectedTrackId] = useState<string | null>(null);
  const [selectedTrackIds, setSelectedTrackIds] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<'tracks' | 'ruta' | 'status'>('tracks');
  const [routeName, setRouteName] = useState('Mi ruta Forfait');
  const [nivelUsuario, setNivelUsuario] = useState<NivelUsuario>('avanzado');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [saved, setSaved] = useState(false);
  const [expandedSectors, setExpandedSectors] = useState<Set<string>>(new Set());
  const [previewTrackIds, setPreviewTrackIds] = useState<string[]>([]);
  const [hoveredTrackId, setHoveredTrackId] = useState<string | null>(null);
  const [fitToTrackId, setFitToTrackId] = useState<string | null>(null);

  // Restore saved route from localStorage
  useEffect(() => {
    const savedData = loadSavedRoute();
    if (savedData && savedData.trackIds.length > 0) {
      const valid = savedData.trackIds.filter(id => tracks.some(t => t.id === id));
      if (valid.length > 0) {
        setSelectedTrackIds(valid);
        setRouteName(savedData.routeName || 'Mi ruta Forfait');
        setActiveTab('ruta');
      }
    }
  }, [tracks]);

  // Auto-save route
  useEffect(() => {
    if (selectedTrackIds.length > 0) {
      saveRoute(selectedTrackIds, routeName);
      setSaved(true);
    } else {
      clearSavedRoute();
      setSaved(false);
    }
  }, [selectedTrackIds, routeName]);

  const conexiones = useMemo(() => detectAllConnections(tracks), [tracks]);

  const filteredTracks = useMemo(() => {
    return tracks.filter(t => {
      if (filters.soloAbiertos && t.estado !== 'abierto') return false;
      if (filters.dificultad.length && !filters.dificultad.includes(t.dificultad)) return false;
      if (filters.estado.length && !filters.estado.includes(t.estado)) return false;
      if (filters.sector.length && !filters.sector.includes(t.sector)) return false;
      if (filters.tipo.length && !filters.tipo.some(tp => t.tipo.includes(tp))) return false;
      if (filters.soloEbike && !t.aptoEbike) return false;
      if (filters.soloLluvia && !t.aptoLluvia) return false;
      if (t.nivelTecnico > filters.nivelTecnicoMax) return false;
      if (t.exigenciaFisica > filters.exigenciaFisicaMax) return false;
      if (t.distanciaKm < filters.distanciaMin || t.distanciaKm > filters.distanciaMax) return false;
      if (filters.busqueda && !t.nombre.toLowerCase().includes(filters.busqueda.toLowerCase())) return false;
      return true;
    });
  }, [tracks, filters]);

  const builtRoute = useMemo(() => {
    if (!selectedTrackIds.length) return null;
    const selected = selectedTrackIds.map(id => tracks.find(t => t.id === id)).filter(Boolean) as TrackMTB[];
    return buildRouteFromTracks(selected, conexiones, routeName);
  }, [selectedTrackIds, conexiones, routeName, tracks]);

  const suggestions = useMemo(() => {
    if (!selectedTrackIds.length) return { recomendado: [], con_precaucion: [], no_recomendado: [] };
    const lastId = selectedTrackIds[selectedTrackIds.length - 1];
    const lastTrack = tracks.find(t => t.id === lastId);
    if (!lastTrack) return { recomendado: [], con_precaucion: [], no_recomendado: [] };
    const result = sugerirSiguientesTracks(lastTrack, filteredTracks, conexiones, nivelUsuario, selectedTrackIds);
    return {
      recomendado: result.filter(r => r.tipo === 'recomendado').map(r => r.track.id),
      con_precaucion: result.filter(r => r.tipo === 'con_precaucion').map(r => r.track.id),
      no_recomendado: result.filter(r => r.tipo === 'no_recomendado').map(r => r.track.id),
    };
  }, [selectedTrackIds, filteredTracks, conexiones, nivelUsuario]);

  const handleTrackClick = useCallback((track: TrackMTB) => {
    setSelectedTrackId(track.id);
    setPreviewTrackIds(prev => prev.includes(track.id) ? prev.filter(id => id !== track.id) : [...prev, track.id]);
    setFitToTrackId(track.id);
  }, []);

  const addToRoute = useCallback((trackId: string) => {
    setSelectedTrackIds(prev => prev.includes(trackId) ? prev : [...prev, trackId]);
  }, []);

  const removeFromRoute = useCallback((trackId: string) => {
    setSelectedTrackIds(prev => prev.filter(id => id !== trackId));
  }, []);

  const moveTrack = useCallback((index: number, direction: -1 | 1) => {
    setSelectedTrackIds(prev => {
      const next = [...prev];
      const target = index + direction;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }, []);

  const clearRoute = useCallback(() => {
    setSelectedTrackIds([]);
    setRouteName('Mi ruta Forfait');
    clearSavedRoute();
  }, []);

  const handleExportGPX = useCallback(() => {
    if (!builtRoute) return;
    const gpx = exportarRutaGPX(builtRoute);
    if (!gpx) return;
    descargarGPX(gpx, `morella-ebiketracks-${builtRoute.nombre.toLowerCase().replace(/\s+/g, '-')}.gpx`);
  }, [builtRoute]);

  const handleCopySummary = useCallback(() => {
    if (!builtRoute) return;
    const summary = [
      `Ruta: ${builtRoute.nombre}`,
      `Tracks: ${builtRoute.tracks.map(t => t.nombre).join(' → ')}`,
      `Distancia: ${builtRoute.distanciaTotalKm} km`,
      `Desnivel: +${builtRoute.desnivelPositivoTotal}m / -${builtRoute.desnivelNegativoTotal}m`,
      `Dificultad: ${builtRoute.dificultadGlobal}`,
      `Tiempo est.: ${Math.round(builtRoute.tiempoEstimadoTotalMin / 60)}h ${builtRoute.tiempoEstimadoTotalMin % 60}min`,
      `Técnica: ${builtRoute.nivelTecnicoMaximo}/5, Física: ${builtRoute.exigenciaFisicaMedia}/5`,
    ].join('\n');
    navigator.clipboard.writeText(summary);
  }, [builtRoute]);

  const selectedTrack = selectedTrackId ? tracks.find(t => t.id === selectedTrackId) : null;
  const selectedTracks = useMemo(() => tracks.filter(t => selectedTrackIds.includes(t.id)), [tracks, selectedTrackIds]);

  const sectors = useMemo(() => [...new Set(tracks.map(t => t.sector))], [tracks]);

  const toggleSector = useCallback((sector: string) => {
    setExpandedSectors(prev => {
      const next = new Set(prev);
      if (next.has(sector)) next.delete(sector);
      else next.add(sector);
      return next;
    });
  }, []);

  // Only show previewed or selected tracks on the map
  const effectiveTracks = useMemo(() => {
    const ids = new Set([...previewTrackIds, ...selectedTrackIds]);
    return filteredTracks.filter(t => ids.has(t.id));
  }, [filteredTracks, previewTrackIds, selectedTrackIds]);

  // Tracks grouped by sector for display (all tracks in list, not just map-visible)
  const tracksBySector = useMemo(() => {
    const map = new Map<string, TrackMTB[]>();
    for (const t of filteredTracks) {
      const list = map.get(t.sector) || [];
      list.push(t);
      map.set(t.sector, list);
    }
    return map;
  }, [filteredTracks]);

  // Track detail component used in both sidebar and mobile sheet
  const renderTrackDetail = (track: TrackMTB) => (
    <div className="p-3 bg-slate-900/80 border border-white/5 rounded-xl space-y-2.5">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-1.5 mb-1">
            <span className={`w-2.5 h-2.5 rounded-full ${DIF_COLORS[track.dificultad]}`} />
            <h4 className="text-sm font-bold text-white">{track.nombre}</h4>
          </div>
          <p className="text-[10px] text-slate-500">{track.sector} · {track.dataStatus === 'real' ? 'Track real' : 'Demo'}</p>
        </div>
        <button
          onClick={() => { addToRoute(track.id); }}
          className="flex-shrink-0 p-1.5 bg-orange-500/20 text-orange-400 rounded-lg hover:bg-orange-500/30 transition-colors"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>
      <div className="grid grid-cols-3 gap-1.5 text-[10px]">
        <div className="bg-slate-950/60 rounded px-2 py-1"><span className="text-slate-500">Dist.</span> <span className="text-white font-bold">{track.distanciaKm} km</span></div>
        <div className="bg-slate-950/60 rounded px-2 py-1"><span className="text-slate-500">+{track.desnivelPositivo}</span> <span className="text-white font-bold">/ -{track.desnivelNegativo}</span></div>
        <div className="bg-slate-950/60 rounded px-2 py-1"><span className="text-slate-500">Téc.</span> <span className="text-white font-bold">{track.nivelTecnico}/5</span></div>
      </div>
      <p className="text-[10px] text-slate-400 leading-relaxed">{track.descripcion}</p>
      <div className="flex flex-wrap gap-1">
        <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold border ${DIF_TEXT[track.dificultad]}`}>{track.dificultad}</span>
        <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold border ${ESTADO_BADGE[track.estado]}`}>{track.estado}</span>
        {track.aptoEbike && <span className="px-1.5 py-0.5 rounded text-[9px] font-bold border bg-orange-500/10 text-orange-400 border-orange-500/30">E-bike</span>}
        {track.tipo.map(tp => (
          <span key={tp} className="px-1.5 py-0.5 rounded text-[9px] bg-slate-800 text-slate-400 border border-white/5">{tp}</span>
        ))}
      </div>
      {track.advertencias.length > 0 && (
        <div className="space-y-1">
          {track.advertencias.map((w, i) => (
            <div key={i} className="flex items-start gap-1.5 text-[10px] text-amber-300">
              <AlertTriangle className="w-3 h-3 flex-shrink-0 mt-0.5" />
              <span>{w}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderTrackListItem = (track: TrackMTB) => {
    const isInRoute = selectedTrackIds.includes(track.id);
    const isPreview = previewTrackIds.includes(track.id) && !isInRoute;
    const isHovered = hoveredTrackId === track.id;
    return (
      <div
        key={track.id}
        onClick={() => handleTrackClick(track)}
        onMouseEnter={() => setHoveredTrackId(track.id)}
        onMouseLeave={() => setHoveredTrackId(null)}
        className={`flex items-start gap-2 px-2.5 py-2 rounded-lg cursor-pointer transition-all ${
          isInRoute
            ? 'bg-blue-500/10'
            : isPreview
            ? 'bg-orange-500/10'
            : isHovered
            ? 'bg-slate-700/40'
            : 'hover:bg-slate-800/50'
        }`}
      >
        <span className={`w-2 h-2 rounded-full flex-shrink-0 mt-1 ${DIF_COLORS[track.dificultad] || 'bg-slate-500'}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-1">
            <span className="text-[11px] font-bold text-white truncate">{track.nombre}</span>
            <button
              onClick={e => { e.stopPropagation(); isInRoute ? removeFromRoute(track.id) : addToRoute(track.id); }}
              className={`flex-shrink-0 p-1 rounded-lg transition-colors ${
                isInRoute
                  ? 'bg-blue-500/20 text-blue-400'
                  : 'bg-slate-800 text-slate-500 hover:bg-orange-500/20 hover:text-orange-400'
              }`}
            >
              {isInRoute ? <Trash2 className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
            </button>
          </div>
          <div className="text-[9px] text-slate-500 leading-tight mt-0.5">
            <span>{track.sector}</span>
            <span className="mx-1">·</span>
            <span>{track.distanciaKm} km</span>
            <span className="mx-1">·</span>
            <span>+{track.desnivelPositivo} m</span>
            <span className="mx-1">·</span>
            <span>T{track.nivelTecnico}/F{track.exigenciaFisica}</span>
          </div>
          <div className="flex items-center gap-1 mt-1 flex-wrap">
            {track.dificultad && (
              <span className={`px-1 py-0.5 rounded text-[8px] font-bold border ${DIF_TEXT[track.dificultad]}`}>
                {track.dificultad}
              </span>
            )}
            {track.estado !== 'abierto' && (
              <span className={`px-1 py-0.5 rounded text-[8px] font-bold border ${ESTADO_BADGE[track.estado]}`}>
                {track.estado}
              </span>
            )}
            {track.dataStatus === 'real' && (
              <span className="px-1 py-0.5 rounded text-[8px] font-bold border bg-green-500/10 text-green-400 border-green-500/30">
                REAL
              </span>
            )}
          </div>
        </div>
      </div>
    );
  };

  const sidebarContent = (
    <>
      {/* PESTAÑA TRACKS */}
      {activeTab === 'tracks' && (
          <>
            {/* SECTOR SECTIONS */}
            <div className="space-y-1">
              {sectors.map(sector => {
                const isExpanded = expandedSectors.has(sector);
                const sectorTracks = tracksBySector.get(sector) || [];
                return (
                  <div key={sector} className="border border-white/5 rounded-lg overflow-hidden">
                    <button
                      onClick={() => toggleSector(sector)}
                      className="w-full flex items-center justify-between px-2.5 py-2 bg-slate-900/60 hover:bg-slate-900 transition-colors text-left"
                    >
                      <div className="flex items-center gap-1.5">
                        <ChevronUp className={`w-3 h-3 text-slate-500 transition-transform ${isExpanded ? '' : '-rotate-90'}`} />
                        <span className="text-xs font-semibold text-white">{sector}</span>
                      </div>
                      <span className="text-[9px] text-slate-500">{sectorTracks.length}</span>
                    </button>
                    {isExpanded && (
                      <div className="divide-y divide-white/5">
                        {sectorTracks.map(renderTrackListItem)}
                      </div>
                    )}
                  </div>
                );
              })}
              {sectors.length === 0 && (
                <p className="text-[10px] text-slate-500 text-center py-6">No hay sectores disponibles.</p>
              )}
            </div>
          </>
        )}

        {/* PESTAÑA RUTA ACTUAL */}
        {activeTab === 'ruta' && (
          <div className="space-y-4">
            <div>
              <label className="text-[10px] text-slate-500 uppercase tracking-widest font-bold block mb-1">Nombre de la ruta</label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={routeName}
                  onChange={e => setRouteName(e.target.value)}
                  className="flex-1 bg-slate-900 border border-white/5 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-orange-500/40"
                />
                {saved && <Save className="w-3.5 h-3.5 text-green-400 flex-shrink-0" />}
              </div>
            </div>

            {builtRoute && selectedTrackIds.length > 0 && (
              <>
                <ElevationProfile points={builtRoute.pointsCombinados} />

                <div className="grid grid-cols-2 gap-2">
                  <MetricBox label="Distancia" value={`${builtRoute.distanciaTotalKm} km`} />
                  <MetricBox label="Desnivel +" value={`+${builtRoute.desnivelPositivoTotal} m`} />
                  <MetricBox label="Desnivel -" value={`-${builtRoute.desnivelNegativoTotal} m`} />
                  <MetricBox label="Tiempo est." value={`${Math.round(builtRoute.tiempoEstimadoTotalMin / 60)}h ${builtRoute.tiempoEstimadoTotalMin % 60}min`} />
                  <MetricBox label="Dificultad" value={builtRoute.dificultadGlobal} />
                  <MetricBox label="Nivel técnico" value={`${builtRoute.nivelTecnicoMaximo}/5`} />
                  <MetricBox label="Exigencia física" value={`${builtRoute.exigenciaFisicaMedia}/5`} />
                  <MetricBox label="Tracks" value={`${builtRoute.tracks.length}`} />
                </div>
              </>
            )}

            {builtRoute?.advertencias.map((w, i) => (
              <div key={i} className="flex items-start gap-2 p-2 bg-amber-500/5 border border-amber-500/20 rounded-lg">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 mt-0.5" />
                <span className="text-[11px] text-amber-300">{w}</span>
              </div>
            ))}

            <div className="space-y-1">
              {selectedTrackIds.map((id, i) => {
                const t = tracks.find(t => t.id === id);
                if (!t) return null;
                return (
                  <div key={id} className="flex items-center gap-1.5 p-2 bg-slate-900/50 border border-white/5 rounded-lg">
                    <span className="text-[10px] text-slate-500 font-bold w-5">{i + 1}</span>
                    <span className={`w-2 h-2 rounded-full ${DIF_COLORS[t.dificultad]}`} />
                    <span className="flex-1 text-xs text-white truncate">{t.nombre}</span>
                    <span className="text-[10px] text-slate-500">{t.distanciaKm} km</span>
                    <div className="flex gap-0.5">
                      <button onClick={() => moveTrack(i, -1)} disabled={i === 0} className="p-0.5 text-slate-500 hover:text-white disabled:opacity-30"><ArrowUp className="w-3 h-3" /></button>
                      <button onClick={() => moveTrack(i, 1)} disabled={i === selectedTrackIds.length - 1} className="p-0.5 text-slate-500 hover:text-white disabled:opacity-30"><ArrowDown className="w-3 h-3" /></button>
                      <button onClick={() => removeFromRoute(id)} className="p-0.5 text-red-400 hover:text-red-300"><X className="w-3 h-3" /></button>
                    </div>
                  </div>
                );
              })}
              {selectedTrackIds.length === 0 && (
                <p className="text-xs text-slate-500 text-center py-8">Añade tracks desde la pestaña Tracks.</p>
              )}
            </div>

            {selectedTrackIds.length > 0 && (
              <div className="flex gap-2">
                <button onClick={handleExportGPX} className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-xs font-bold transition-colors">
                  <Download className="w-4 h-4" />
                  GPX
                </button>
                <button onClick={handleCopySummary} className="px-3 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-bold transition-colors" title="Copiar resumen">
                  <Copy className="w-4 h-4" />
                </button>
                <button onClick={clearRoute} className="px-3 py-2.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg text-xs font-bold transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        )}

        {/* PESTAÑA ESTADO Y AVISOS */}
        {activeTab === 'status' && (
          <div className="space-y-4">
            {selectedTracks.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-8">Selecciona tracks para ver su estado.</p>
            ) : (
              <>
                <div>
                  <h4 className="text-xs font-bold text-white mb-2">Resumen de estado</h4>
                  <div className="grid grid-cols-2 gap-2">
                    <StatusBlock label="Abiertos" value={selectedTracks.filter(t => t.estado === 'abierto').length} color="text-green-400" />
                    <StatusBlock label="Cerrados" value={selectedTracks.filter(t => t.estado === 'cerrado').length} color="text-gray-400" />
                    <StatusBlock label="Precaución" value={selectedTracks.filter(t => t.estado === 'precaucion').length} color="text-yellow-400" />
                    <StatusBlock label="En revisión" value={selectedTracks.filter(t => t.estado === 'revision').length} color="text-orange-400" />
                  </div>
                </div>

                <div>
                  <h4 className="text-xs font-bold text-white mb-2">Total tracks: {selectedTracks.length} ({selectedTracks.filter(t => t.dataStatus === 'real').length} reales)</h4>
                </div>

                <div>
                  <h4 className="text-xs font-bold text-white mb-2">Tracks con incidencias</h4>
                  <div className="space-y-1.5">
                    {selectedTracks.filter(t => t.estado !== 'abierto').map(t => (
                      <div key={t.id} className="flex items-center gap-2 p-2 bg-slate-900/50 border border-white/5 rounded-lg">
                        <span className={`w-2 h-2 rounded-full ${t.estado === 'cerrado' ? 'bg-gray-500' : t.estado === 'precaucion' ? 'bg-yellow-500' : 'bg-orange-500'}`} />
                        <span className="text-xs text-white flex-1">{t.nombre}</span>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${ESTADO_BADGE[t.estado]}`}>{t.estado}</span>
                      </div>
                    ))}
                    {selectedTracks.filter(t => t.estado !== 'abierto').length === 0 && (
                      <p className="text-[10px] text-slate-600">Ningún track seleccionado tiene incidencias.</p>
                    )}
                  </div>
                </div>
              </>
            )}

            <div>
              <h4 className="text-xs font-bold text-white mb-2">Advertencias activas</h4>
              <div className="space-y-1.5">
                {tracks.filter(t => t.advertencias.length > 0).slice(0, 8).flatMap(t =>
                  t.advertencias.map((w, i) => (
                    <div key={`${t.id}-${i}`} className="flex items-start gap-2 p-2 bg-slate-900/50 border border-white/5 rounded-lg">
                      <AlertTriangle className="w-3 h-3 text-amber-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <span className="text-[10px] text-white font-bold">{t.nombre}</span>
                        <p className="text-[10px] text-slate-400">{w}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

      {/* LEGENDA BOTTOM */}
      <div className="px-4 py-2 border-t border-white/5">
        <div className="flex items-center gap-3 text-[10px] text-slate-500 flex-wrap">
          <span className="flex items-center gap-1"><span className="w-2.5 h-0.5 bg-green-500" /> Recomendado</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-0.5 bg-yellow-500" /> Precaución</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-0.5 bg-red-500" /> No recomendado</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-0.5 bg-blue-500" style={{ height: 3 }} /> Ruta</span>
        </div>
      </div>
    </>
  );

  return (
    <section className="relative h-[calc(100vh-80px)]">
      {/* TOP TOOLBAR */}
      <div className="h-12 flex items-center justify-between px-4 bg-slate-950 border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-1.5 mr-1">
            <MapIcon className="w-4 h-4 text-orange-400" />
            <span className="text-xs font-extrabold tracking-tight text-white">Forfait <span className="text-orange-500">MTB</span></span>
          </div>
          <div className="flex items-center gap-0.5">
            <button onClick={() => setActiveTab('tracks')} className={`px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-widest transition-colors ${activeTab === 'tracks' ? 'bg-orange-500/15 text-orange-400' : 'text-slate-500 hover:text-slate-300'}`}>Explorar</button>
            <button onClick={() => setActiveTab('ruta')} className={`px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-widest transition-colors ${activeTab === 'ruta' ? 'bg-orange-500/15 text-orange-400' : 'text-slate-500 hover:text-slate-300'}`}>Crear ruta</button>
            <button onClick={() => setActiveTab('status')} className={`px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-widest transition-colors ${activeTab === 'status' ? 'bg-orange-500/15 text-orange-400' : 'text-slate-500 hover:text-slate-300'}`}>Estado</button>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {selectedTrackIds.length > 0 && (
            <button onClick={handleExportGPX} className="px-2.5 py-1.5 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-[9px] font-bold transition-colors flex items-center gap-1">
              <Download className="w-3 h-3" />
              <span className="hidden sm:inline">Exportar GPX</span>
              <span className="sm:hidden">GPX</span>
            </button>
          )}
          <button onClick={() => setSidebarOpen(o => !o)} className={`p-1.5 rounded-lg text-[9px] font-bold transition-colors ${sidebarOpen ? 'bg-orange-500/15 text-orange-400' : 'text-slate-500 hover:text-slate-300'}`}>
            <List className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="flex flex-row h-[calc(100%-48px)]">
        {/* PANEL LATERAL IZQUIERDO — ancho fijo, scroll propio */}
        {sidebarOpen && (
          <div className="hidden lg:flex w-[380px] xl:w-[420px] flex-shrink-0 bg-slate-950 border-r border-white/5 flex-col">
            {/* STICKY TOP: search/filters */}
            <div className="sticky top-0 z-20 bg-slate-950 border-b border-white/5">
              {activeTab === 'tracks' && (
                <div className="px-4 pb-3 space-y-1.5">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-500" />
                    <input
                      type="text"
                      placeholder="Buscar track..."
                      value={filters.busqueda}
                      onChange={e => setFilters(f => ({ ...f, busqueda: e.target.value }))}
                      className="w-full bg-slate-900 border border-white/5 rounded-lg pl-7 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-orange-500/40"
                    />
                  </div>

                  <div className="flex flex-wrap gap-1">
                    <button
                      onClick={() => setFilters(f => ({ ...f, soloAbiertos: !f.soloAbiertos }))}
                      className={`px-2 py-1 rounded text-[9px] font-bold transition-colors ${
                        filters.soloAbiertos ? 'bg-green-500/20 text-green-400 border border-green-500/40' : 'bg-slate-800/50 text-slate-500 border border-white/5'
                      }`}
                    >
                      Solo abiertos
                    </button>
                    <button
                      onClick={() => setFilters(f => ({ ...f, soloEbike: !f.soloEbike }))}
                      className={`px-2 py-1 rounded text-[9px] font-bold transition-colors ${
                        filters.soloEbike ? 'bg-orange-500/20 text-orange-400 border border-orange-500/40' : 'bg-slate-800/50 text-slate-500 border border-white/5'
                      }`}
                    >
                      E-bike
                    </button>
                    <select
                      value=""
                      onChange={e => {
                        if (!e.target.value) return;
                        setFilters(f => ({
                          ...f,
                          dificultad: f.dificultad.includes(e.target.value as DificultadMTB)
                            ? f.dificultad.filter(d => d !== e.target.value)
                            : [...f.dificultad, e.target.value as DificultadMTB],
                        }));
                      }}
                      className="px-2 py-1 rounded text-[9px] font-bold bg-slate-800/50 text-slate-400 border border-white/5"
                    >
                      <option value="">Dificultad</option>
                      <option value="verde">Verde</option>
                      <option value="azul">Azul</option>
                      <option value="rojo">Rojo</option>
                      <option value="negro">Negro</option>
                      <option value="doble-negro">Doble negro</option>
                    </select>
                  </div>
                </div>
              )}
            </div>

            {/* SCROLLABLE BODY */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {sidebarContent}

              {/* ADVERTENCIA / DISCLAIMER */}
              <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-3 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                <p className="text-[10px] text-slate-400 leading-relaxed">
                  Los tracks mostrados son datos de ejemplo. La dificultad real puede variar por meteorología, erosión, vegetación, obras o fatiga. Antes de salir, revisa el track, el estado de la ruta y tu material.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* MAPA PRINCIPAL — ocupa todo el espacio restante */}
        <div className="flex-1 relative h-full z-0">
          <MTBMap
            tracks={effectiveTracks}
            selectedTrackIds={selectedTrackIds}
            previewTrackIds={previewTrackIds}
            hoveredTrackId={hoveredTrackId}
            fitToTrackId={fitToTrackId}
            recommendedIds={suggestions.recomendado}
            cautionIds={suggestions.con_precaucion}
            notRecommendedIds={suggestions.no_recomendado}
            builtRoute={builtRoute}
            onTrackClick={handleTrackClick}
          />

          {/* BARRA INFERIOR DE RUTA */}
          {selectedTrackIds.length > 0 && builtRoute && (
            <div className="absolute bottom-3 left-3 right-3 z-[1000] bg-slate-950/90 backdrop-blur-md border border-white/10 rounded-xl px-3 md:px-4 py-2 md:py-2.5 flex items-center justify-between gap-2 md:gap-3">
              <div className="flex items-center gap-2 md:gap-3 min-w-0">
                <div className="hidden md:block text-[9px] md:text-[10px] font-bold text-orange-400 uppercase tracking-widest flex-shrink-0">Ruta</div>
                <div className="flex items-center gap-1.5 md:gap-2 text-[10px] md:text-[11px] text-white font-medium flex-shrink-0">
                  <Route className="w-3 h-3 md:w-3.5 md:h-3.5 text-orange-400" />
                  {selectedTrackIds.length}
                </div>
                <div className="h-3 md:h-4 w-px bg-white/10" />
                <div className="flex items-center gap-1.5 md:gap-2 text-[9px] md:text-[10px] text-slate-300">
                  <span className="whitespace-nowrap">{builtRoute.distanciaTotalKm} km</span>
                  <span className="text-slate-600 hidden sm:inline">|</span>
                  <span className="text-green-400 whitespace-nowrap hidden sm:inline">+{builtRoute.desnivelPositivoTotal}m</span>
                  <span className="text-red-400 whitespace-nowrap hidden sm:inline">-{builtRoute.desnivelNegativoTotal}m</span>
                  <span className="text-slate-600 hidden sm:inline">|</span>
                  <span className="hidden sm:inline">T{builtRoute.nivelTecnicoMaximo}/F{builtRoute.exigenciaFisicaMedia}</span>
                  <span className="text-slate-600 hidden sm:inline">|</span>
                  <span className="text-orange-400 font-bold">{builtRoute.dificultadGlobal}</span>
                </div>
              </div>
              <div className="flex items-center gap-1 md:gap-1.5 flex-shrink-0">
                <button
                  onClick={() => setActiveTab('ruta')}
                  className="px-2 md:px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-[8px] md:text-[9px] font-bold transition-colors"
                  title="Ver perfil"
                >
                  <span className="hidden sm:inline">Perfil</span>
                  <span className="sm:hidden"><Route className="w-3 h-3" /></span>
                </button>
                <button
                  onClick={handleExportGPX}
                  className="px-2 md:px-2.5 py-1.5 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-[8px] md:text-[9px] font-bold transition-colors flex items-center gap-1"
                >
                  <Download className="w-3 h-3" />
                  <span className="hidden sm:inline">GPX</span>
                </button>
                <button
                  onClick={clearRoute}
                  className="p-1.5 bg-slate-800 hover:bg-red-500/20 text-slate-500 hover:text-red-400 rounded-lg transition-colors"
                  title="Limpiar ruta"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* FLOATING PANEL TOGGLE — visible en tablet/móvil cuando el panel está cerrado, sobre el mapa */}
      {!sidebarOpen && (
        <div className="lg:hidden absolute top-3 left-3 z-[1500]">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2.5 bg-slate-950/90 backdrop-blur-md border border-white/10 rounded-lg shadow-lg hover:bg-slate-900 transition-colors"
            aria-label="Abrir panel"
          >
            <List className="w-4 h-4 text-white" />
          </button>
        </div>
      )}

      {/* OVERLAY PANEL: tablet (izquierda) + móvil (bottom sheet) */}
      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-[2000] pointer-events-none">
          <div className="absolute inset-0 bg-black/50 pointer-events-auto" onClick={() => setSidebarOpen(false)} />

          {/* Tablet: overlay izquierdo 340px */}
          <div className="hidden md:flex absolute top-0 left-0 h-full w-[340px] bg-slate-950 border-r border-white/5 flex-col pointer-events-auto shadow-2xl">
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
              <div className="flex gap-1">
                <button onClick={() => setActiveTab('tracks')} className={`px-2 py-1 rounded text-[9px] font-bold uppercase tracking-widest ${activeTab === 'tracks' ? 'bg-orange-500/15 text-orange-400' : 'text-slate-500 hover:text-slate-300'}`}>Explorar</button>
                <button onClick={() => setActiveTab('ruta')} className={`px-2 py-1 rounded text-[9px] font-bold uppercase tracking-widest ${activeTab === 'ruta' ? 'bg-orange-500/15 text-orange-400' : 'text-slate-500 hover:text-slate-300'}`}>Ruta</button>
                <button onClick={() => setActiveTab('status')} className={`px-2 py-1 rounded text-[9px] font-bold uppercase tracking-widest ${activeTab === 'status' ? 'bg-orange-500/15 text-orange-400' : 'text-slate-500 hover:text-slate-300'}`}>Estado</button>
              </div>
              <button onClick={() => setSidebarOpen(false)} className="text-slate-400 p-1 hover:text-white transition-colors"><X className="w-4 h-4" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {sidebarContent}
            </div>
          </div>

          {/* Móvil: bottom sheet */}
          <div className="flex md:hidden absolute bottom-0 left-0 right-0 max-h-[70vh] bg-slate-950 border-t border-white/10 rounded-t-2xl overflow-y-auto pointer-events-auto">
            <div className="sticky top-0 bg-slate-950 z-10 w-full">
              <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
                <div className="flex gap-1">
                  <button onClick={() => setActiveTab('tracks')} className={`px-2 py-1 rounded text-[9px] font-bold uppercase tracking-widest ${activeTab === 'tracks' ? 'bg-orange-500/15 text-orange-400' : 'text-slate-500 hover:text-slate-300'}`}>Explorar</button>
                  <button onClick={() => setActiveTab('ruta')} className={`px-2 py-1 rounded text-[9px] font-bold uppercase tracking-widest ${activeTab === 'ruta' ? 'bg-orange-500/15 text-orange-400' : 'text-slate-500 hover:text-slate-300'}`}>Ruta</button>
                  <button onClick={() => setActiveTab('status')} className={`px-2 py-1 rounded text-[9px] font-bold uppercase tracking-widest ${activeTab === 'status' ? 'bg-orange-500/15 text-orange-400' : 'text-slate-500 hover:text-slate-300'}`}>Estado</button>
                </div>
                <button onClick={() => setSidebarOpen(false)} className="text-slate-400 p-1"><X className="w-5 h-5" /></button>
              </div>
            </div>
            <div className="p-4 space-y-4">
              {sidebarContent}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function MetricBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-slate-900/50 border border-white/5 rounded-lg p-2.5">
      <p className="text-[9px] text-slate-500 uppercase tracking-wider">{label}</p>
      <p className="text-xs text-white font-bold mt-0.5">{value}</p>
    </div>
  );
}

function StatusBlock({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="bg-slate-900/50 border border-white/5 rounded-lg p-2.5 text-center">
      <p className={`text-lg font-black ${color}`}>{value}</p>
      <p className="text-[9px] text-slate-500 uppercase tracking-wider">{label}</p>
    </div>
  );
}
