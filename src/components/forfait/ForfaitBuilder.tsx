'use client';

import { useMemo, useState, useCallback, useEffect } from 'react';
import dynamic from 'next/dynamic';
import {
  List, AlertTriangle, Download, Plus, Trash2, ArrowUp, ArrowDown,
  Search, X, Bike, Mountain, Route, Save, Copy, ChevronUp,
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
  verde: 'bg-green-500', azul: 'bg-blue-500', rojo: 'bg-red-500',
  negro: 'bg-slate-700', 'doble-negro': 'bg-black',
};
const DIF_TEXT: Record<string, string> = {
  verde: 'bg-green-500/10 text-green-400 border-green-500/30', azul: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
  rojo: 'bg-red-500/10 text-red-400 border-red-500/30', negro: 'bg-slate-700/30 text-slate-300 border-slate-600/30',
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
  const [mobileSheet, setMobileSheet] = useState<'hidden' | 'tracks' | 'ruta'>('hidden');
  const [saved, setSaved] = useState(false);
  const [expandedSectors, setExpandedSectors] = useState<Set<string>>(new Set());

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
    setMobileSheet('tracks');
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

  // Filter: if any sector is expanded, only show tracks from expanded sectors
  const effectiveTracks = useMemo(() => {
    if (expandedSectors.size === 0) return [];
    return filteredTracks.filter(t => expandedSectors.has(t.sector));
  }, [filteredTracks, expandedSectors]);

  // Tracks grouped by sector for display
  const tracksBySector = useMemo(() => {
    const map = new Map<string, TrackMTB[]>();
    for (const t of effectiveTracks) {
      const list = map.get(t.sector) || [];
      list.push(t);
      map.set(t.sector, list);
    }
    return map;
  }, [effectiveTracks]);

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
    const isSelected = selectedTrackId === track.id;
    return (
      <div
        key={track.id}
        onClick={() => handleTrackClick(track)}
        className={`p-2.5 rounded-lg border cursor-pointer transition-all ${
          isSelected
            ? 'bg-orange-500/10 border-orange-500/40'
            : isInRoute
            ? 'bg-blue-500/10 border-blue-500/30'
            : 'bg-slate-900/50 border-white/5 hover:border-white/20'
        }`}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-1">
              <span className={`w-2 h-2 rounded-full ${DIF_COLORS[track.dificultad] || 'bg-slate-500'}`} />
              <span className="text-xs font-bold text-white truncate">{track.nombre}</span>
              {track.dataStatus === 'real' && <span className="text-[8px] text-green-500 font-bold">REAL</span>}
            </div>
            <div className="flex items-center gap-2 text-[10px] text-slate-500">
              <span>{track.sector}</span>
              <span>•</span>
              <span>{track.distanciaKm} km</span>
              <span>•</span>
              <span>±{track.desnivelPositivo}m</span>
            </div>
            <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
              <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold border ${DIF_TEXT[track.dificultad]}`}>
                {track.dificultad}
              </span>
              <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold border ${ESTADO_BADGE[track.estado]}`}>
                {track.estado}
              </span>
              <span className="text-[9px] text-slate-500">T{track.nivelTecnico}/F{track.exigenciaFisica}</span>
            </div>
          </div>
          <button
            onClick={e => { e.stopPropagation(); isInRoute ? removeFromRoute(track.id) : addToRoute(track.id); }}
            className={`flex-shrink-0 p-1.5 rounded-lg transition-colors ${
              isInRoute
                ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                : 'bg-orange-500/20 text-orange-400 hover:bg-orange-500/30'
            }`}
          >
            {isInRoute ? <Trash2 className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>
    );
  };

  const sidebarContent = (
    <>
      {/* NIVEL USUARIO */}
      <div className="px-4 pt-3 pb-2 border-b border-white/5">
        <div className="flex items-center gap-2 text-[11px] text-slate-400 mb-2">
          <Bike className="w-3.5 h-3.5" />
          Tu nivel
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {(['iniciacion', 'medio', 'avanzado', 'experto', 'ebike'] as NivelUsuario[]).map(n => (
            <button
              key={n}
              onClick={() => setNivelUsuario(n)}
              className={`px-2.5 py-1 rounded text-[11px] font-bold uppercase tracking-wider transition-colors ${
                nivelUsuario === n
                  ? 'bg-orange-500/20 text-orange-400 border border-orange-500/40'
                  : 'bg-slate-800/50 text-slate-400 border border-white/5 hover:bg-slate-800'
              }`}
            >
              {n === 'iniciacion' ? 'Iniciación' : n === 'ebike' ? 'E-Bike' : n.charAt(0).toUpperCase() + n.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* PESTAÑAS */}
      <div className="flex border-b border-white/5">
        {[
          { key: 'tracks' as const, label: 'Tracks (' + filteredTracks.length + ')', icon: Mountain },
          { key: 'ruta' as const, label: 'Mi ruta', icon: Route },
          { key: 'status' as const, label: 'Estado', icon: AlertTriangle },
        ].map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-[11px] font-bold uppercase tracking-widest transition-colors ${
              activeTab === key
                ? 'text-orange-500 border-b-2 border-orange-500 bg-orange-500/5'
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* PESTAÑA TRACKS */}
        {activeTab === 'tracks' && (
          <>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
              <input
                type="text"
                placeholder="Buscar track..."
                value={filters.busqueda}
                onChange={e => setFilters(f => ({ ...f, busqueda: e.target.value }))}
                className="w-full bg-slate-900 border border-white/5 rounded-lg pl-8 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-orange-500/40"
              />
            </div>

            <div className="flex flex-wrap gap-1.5">
              <button
                onClick={() => setFilters(f => ({ ...f, soloAbiertos: !f.soloAbiertos }))}
                className={`px-2 py-1 rounded text-[10px] font-bold transition-colors ${
                  filters.soloAbiertos ? 'bg-green-500/20 text-green-400 border border-green-500/40' : 'bg-slate-800/50 text-slate-500 border border-white/5'
                }`}
              >
                Solo abiertos
              </button>
              <button
                onClick={() => setFilters(f => ({ ...f, soloEbike: !f.soloEbike }))}
                className={`px-2 py-1 rounded text-[10px] font-bold transition-colors ${
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
                className="px-2 py-1 rounded text-[10px] font-bold bg-slate-800/50 text-slate-400 border border-white/5"
              >
                <option value="">Dificultad</option>
                <option value="verde">Verde</option>
                <option value="azul">Azul</option>
                <option value="rojo">Rojo</option>
                <option value="negro">Negro</option>
                <option value="doble-negro">Doble negro</option>
              </select>
            </div>

            {/* Selected track detail */}
            {selectedTrack && (
              <div className="lg:hidden">
                {renderTrackDetail(selectedTrack)}
              </div>
            )}

            {/* SECTOR SECTIONS */}
            <div className="space-y-2">
              {sectors.map(sector => {
                const isExpanded = expandedSectors.has(sector);
                const sectorTracks = tracksBySector.get(sector) || [];
                return (
                  <div key={sector} className="border border-white/5 rounded-xl overflow-hidden">
                    <button
                      onClick={() => toggleSector(sector)}
                      className="w-full flex items-center justify-between px-3 py-2.5 bg-slate-900/80 hover:bg-slate-900 transition-colors text-left"
                    >
                      <div className="flex items-center gap-2">
                        <ChevronUp className={`w-3.5 h-3.5 text-slate-500 transition-transform ${isExpanded ? '' : 'rotate-180'}`} />
                        <span className="text-xs font-bold text-white">{sector}</span>
                      </div>
                      <span className="text-[10px] text-slate-500">{sectorTracks.length} tracks</span>
                    </button>
                    {isExpanded && (
                      <div className="p-2 space-y-1.5 bg-slate-950/30">
                        {sectorTracks.map(renderTrackListItem)}
                        {sectorTracks.length === 0 && (
                          <p className="text-[10px] text-slate-600 text-center py-3">Ningún track coincide con los filtros.</p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
              {sectors.length === 0 && (
                <p className="text-xs text-slate-500 text-center py-8">No hay sectores disponibles.</p>
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
      </div>

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
    <section className="relative min-h-screen px-6">
      <div className="flex flex-col lg:flex-row h-[45vh] lg:h-[calc(100vh-80px)]">
        {/* MAPA */}
        <div className={`flex-1 relative ${sidebarOpen ? 'lg:w-3/5' : 'w-full'} h-[45vh] lg:h-[60vh] transition-all z-0`}>
          <MTBMap
            tracks={effectiveTracks}
            selectedTrackIds={selectedTrackIds}
            recommendedIds={suggestions.recomendado}
            cautionIds={suggestions.con_precaucion}
            notRecommendedIds={suggestions.no_recomendado}
            builtRoute={builtRoute}
            onTrackClick={handleTrackClick}
          />

          {/* OVERLAY CONTROLS */}
          <div className="absolute top-3 left-3 z-[1000] flex gap-2 flex-wrap">
            <button
              onClick={() => { setSidebarOpen(o => !o); if (mobileSheet === 'hidden') setMobileSheet('tracks'); }}
              className="px-3 py-1.5 bg-slate-900/90 backdrop-blur-md border border-white/10 rounded-lg text-xs text-white font-bold flex items-center gap-1.5 hover:bg-slate-800 transition-colors"
            >
              <List className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{sidebarOpen ? 'Cerrar panel' : 'Abrir panel'}</span>
            </button>
            {selectedTrackIds.length > 0 && (
              <button
                onClick={() => { setActiveTab('ruta'); setSidebarOpen(true); }}
                className="px-3 py-1.5 bg-blue-500/20 backdrop-blur-md border border-blue-500/30 rounded-lg text-xs text-blue-400 font-bold flex items-center gap-1.5 hover:bg-blue-500/30 transition-colors"
              >
                <Route className="w-3.5 h-3.5" />
                {selectedTrackIds.length} tracks
              </button>
            )}
          </div>

          {/* MOBILE FAB */}
          {selectedTrackIds.length > 0 && (
            <div className="lg:hidden absolute bottom-4 left-1/2 -translate-x-1/2 z-[1000]">
              <button
                onClick={() => setMobileSheet(mobileSheet === 'ruta' ? 'hidden' : 'ruta')}
                className="px-5 py-2.5 bg-orange-500 text-white rounded-full text-sm font-bold shadow-lg flex items-center gap-2"
              >
                <Route className="w-4 h-4" />
                Mi ruta ({selectedTrackIds.length})
                <ChevronUp className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* PANEL LATERAL - Desktop */}
        {sidebarOpen && (
          <div className="hidden lg:flex lg:w-2/5 bg-slate-950 border-t lg:border-t-0 lg:border-l border-white/5 overflow-y-auto h-[45vh] lg:h-full flex-col">
            {sidebarContent}
          </div>
        )}
      </div>

      {/* MOBILE BOTTOM SHEET */}
      {mobileSheet !== 'hidden' && (
        <div className="lg:hidden fixed inset-0 z-[2000] pointer-events-none">
          <div className="absolute inset-0 bg-black/50 pointer-events-auto" onClick={() => setMobileSheet('hidden')} />
          <div className="absolute bottom-0 left-0 right-0 max-h-[70vh] bg-slate-950 border-t border-white/10 rounded-t-2xl overflow-y-auto pointer-events-auto">
            <div className="sticky top-0 bg-slate-950 z-10 flex items-center justify-between px-4 py-3 border-b border-white/5">
              <div className="flex gap-2">
                <button onClick={() => setMobileSheet('tracks')} className={`text-xs font-bold uppercase tracking-widest ${mobileSheet === 'tracks' ? 'text-orange-500' : 'text-slate-500'}`}>Tracks</button>
                <button onClick={() => setMobileSheet('ruta')} className={`text-xs font-bold uppercase tracking-widest ${mobileSheet === 'ruta' ? 'text-orange-500' : 'text-slate-500'}`}>Ruta</button>
              </div>
              <button onClick={() => setMobileSheet('hidden')} className="text-slate-400 p-1"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-4 space-y-4">
              {mobileSheet === 'tracks' && (
                <>
                  {selectedTrack && renderTrackDetail(selectedTrack)}
                  <div className="space-y-2">
                    {sectors.map(sector => {
                      const isExpanded = expandedSectors.has(sector);
                      const sectorTracks = tracksBySector.get(sector) || [];
                      if (sectorTracks.length === 0 && !isExpanded) return null;
                      return (
                        <div key={sector} className="border border-white/5 rounded-xl overflow-hidden">
                          <button
                            onClick={() => toggleSector(sector)}
                            className="w-full flex items-center justify-between px-3 py-2.5 bg-slate-900/80 text-left"
                          >
                            <div className="flex items-center gap-2">
                              <ChevronUp className={`w-3 h-3 text-slate-500 transition-transform ${isExpanded ? '' : 'rotate-180'}`} />
                              <span className="text-xs font-bold text-white">{sector}</span>
                            </div>
                            <span className="text-[10px] text-slate-500">{sectorTracks.length}</span>
                          </button>
                          {isExpanded && (
                            <div className="p-2 space-y-1.5 bg-slate-950/30">
                              {sectorTracks.map(renderTrackListItem)}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
              {mobileSheet === 'ruta' && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <input type="text" value={routeName} onChange={e => setRouteName(e.target.value)}
                      className="flex-1 bg-slate-900 border border-white/5 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-orange-500/40"
                    />
                    {saved && <Save className="w-3.5 h-3.5 text-green-400 flex-shrink-0" />}
                  </div>
                  {builtRoute && <ElevationProfile points={builtRoute.pointsCombinados} />}
                  {builtRoute && (
                    <div className="grid grid-cols-2 gap-2">
                      <MetricBox label="Distancia" value={`${builtRoute.distanciaTotalKm} km`} />
                      <MetricBox label="Desnivel +" value={`+${builtRoute.desnivelPositivoTotal} m`} />
                      <MetricBox label="Desnivel -" value={`-${builtRoute.desnivelNegativoTotal} m`} />
                      <MetricBox label="Tiempo" value={`${Math.round(builtRoute.tiempoEstimadoTotalMin / 60)}h ${builtRoute.tiempoEstimadoTotalMin % 60}min`} />
                      <MetricBox label="Dificultad" value={builtRoute.dificultadGlobal} />
                      <MetricBox label="Técnica" value={`${builtRoute.nivelTecnicoMaximo}/5`} />
                      <MetricBox label="Física" value={`${builtRoute.exigenciaFisicaMedia}/5`} />
                      <MetricBox label="Tracks" value={`${builtRoute.tracks.length}`} />
                    </div>
                  )}
                  {selectedTrackIds.map((id, i) => {
                    const t = tracks.find(t => t.id === id);
                    if (!t) return null;
                    return (
                      <div key={id} className="flex items-center gap-1.5 p-2 bg-slate-900/50 border border-white/5 rounded-lg">
                        <span className="text-[10px] text-slate-500 font-bold w-5">{i + 1}</span>
                        <span className={`w-2 h-2 rounded-full ${DIF_COLORS[t.dificultad]}`} />
                        <span className="flex-1 text-xs text-white truncate">{t.nombre}</span>
                        <button onClick={() => removeFromRoute(id)} className="p-0.5 text-red-400"><X className="w-3 h-3" /></button>
                      </div>
                    );
                  })}
                  {selectedTrackIds.length > 0 && (
                    <div className="flex gap-2">
                      <button onClick={handleExportGPX} className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-xs font-bold transition-colors">
                        <Download className="w-4 h-4" /> Descargar GPX
                      </button>
                      <button onClick={clearRoute} className="px-3 py-2.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg text-xs font-bold"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  )}
                </div>
              )}
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
