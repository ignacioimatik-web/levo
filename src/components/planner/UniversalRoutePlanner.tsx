'use client';

import dynamic from 'next/dynamic';
import { useEffect, useMemo, useState } from 'react';
import {
  CloudDownload, CloudSun, Download, Eraser, FileUp, LocateFixed, Navigation,
  FolderOpen, Redo2, Save, Trash2, Undo2,
} from 'lucide-react';
import type { User } from '@supabase/supabase-js';
import RouteRideBriefing, {
  type RideBriefingMode, type RideBriefingView,
} from '@/components/RouteRideBriefing';
import { haversineKm } from '@/lib/gpx-utils';
import { parseNavigationGpx } from '@/lib/navigation/gpx';
import {
  deletePlannedRoute, getPlannedRoutes, savePlannedRoute,
} from '@/lib/navigation/storage';
import type { PlannedRoute, PlannedRoutePoint } from '@/lib/navigation/types';
import {
  deleteOfflineMapPackage,
  listOfflineMapPackages,
  saveOfflineMapPackage,
} from '@/lib/navigation/offline-map-storage';
import type { OfflineMapPackage } from '@/lib/navigation/offline-map-storage';
import {
  buildOverpassTrailQuery,
  overpassWaysToGeoJson,
} from '@/lib/navigation/offline-map-data';
import type { OverpassWay } from '@/lib/navigation/offline-map-data';
import type { RouteStatusPayload } from '@/lib/route-status';
import {
  deleteSavedRoute, fetchSavedRoutes, saveRouteToCloud,
} from '@/lib/forfait/save-route';
import type { SavedRouteData } from '@/lib/forfait/save-route';
import { createClient } from '@/lib/supabase/browser';

const UniversalRouteMap = dynamic(() => import('@/components/planner/UniversalRouteMap'), {
  ssr: false,
  loading: () => <div className="h-full animate-pulse bg-slate-900" />,
});

type RouteLibraryEntry = {
  route: PlannedRoute;
  cloud: boolean;
};

function cloudRoute(saved: SavedRouteData): PlannedRoute {
  return {
    id: saved.id,
    name: saved.name,
    trackIds: saved.track_ids,
    distanceKm: saved.distance_km,
    elevationGainM: saved.elevation_gain_m,
    estimatedTimeMin: saved.estimated_time_min,
    difficulty: saved.difficulty,
    warnings: saved.warnings ?? [],
    points: saved.route_points ?? [],
    createdAt: saved.created_at,
  };
}

function mergeRouteLibrary(local: PlannedRoute[], cloud: SavedRouteData[] = []): RouteLibraryEntry[] {
  const routes = new Map<string, RouteLibraryEntry>(
    local.map((route) => [route.id, { route, cloud: false }]),
  );
  for (const saved of cloud) routes.set(saved.id, { route: cloudRoute(saved), cloud: true });
  return [...routes.values()].sort((a, b) => (
    Date.parse(b.route.createdAt) - Date.parse(a.route.createdAt)
  ));
}

function routeMetrics(points: PlannedRoutePoint[]) {
  let distanceKm = 0;
  let gainM = 0;
  let lossM = 0;
  for (let index = 1; index < points.length; index += 1) {
    distanceKm += haversineKm(
      points[index - 1].latitude,
      points[index - 1].longitude,
      points[index].latitude,
      points[index].longitude,
    );
    if (points[index - 1].elevation != null && points[index].elevation != null) {
      const delta = points[index].elevation! - points[index - 1].elevation!;
      if (delta > 1 && delta < 80) gainM += delta;
      if (delta < -1 && delta > -80) lossM += Math.abs(delta);
    }
  }
  return { distanceKm, gainM, lossM };
}

function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

async function downloadOfflineMapFromDevice(route: PlannedRoute): Promise<OfflineMapPackage> {
  const endpoints = [
    'https://overpass-api.de/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter',
  ];
  const query = buildOverpassTrailQuery(route.points);
  const controllers = endpoints.map(() => new AbortController());
  const timeout = window.setTimeout(() => {
    controllers.forEach((controller) => controller.abort());
  }, 18_000);

  try {
    const elements = await Promise.any(endpoints.map(async (endpoint, index) => {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
        body: new URLSearchParams({ data: query }),
        signal: controllers[index].signal,
      });
      if (!response.ok) throw new Error(`OpenStreetMap respondió ${response.status}.`);
      const payload = await response.json() as { elements?: unknown };
      if (!Array.isArray(payload.elements)) {
        throw new Error('OpenStreetMap devolvió un mapa no válido.');
      }
      return payload.elements as OverpassWay[];
    }));
    const trails = overpassWaysToGeoJson(elements);
    if (trails.features.length === 0) {
      throw new Error('No se encontraron caminos cartografiados alrededor de esta ruta.');
    }
    return {
      routeId: route.id,
      routeName: route.name,
      trails,
      fetchedAt: new Date().toISOString(),
      attribution: '© colaboradores de OpenStreetMap · datos obtenidos mediante Overpass API',
      sampleRadiusM: 1_200,
    };
  } finally {
    window.clearTimeout(timeout);
    controllers.forEach((controller) => controller.abort());
  }
}

export default function UniversalRoutePlanner() {
  const [routeId, setRouteId] = useState(() => crypto.randomUUID());
  const [name, setName] = useState('Mi ruta MTB');
  const [points, setPoints] = useState<PlannedRoutePoint[]>([]);
  const [redoPoints, setRedoPoints] = useState<PlannedRoutePoint[]>([]);
  const [drawing, setDrawing] = useState(true);
  const [analysis, setAnalysis] = useState<RouteStatusPayload | null>(null);
  const [analysisStatus, setAnalysisStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [error, setError] = useState('');
  const [saveStatus, setSaveStatus] = useState('');
  const [user, setUser] = useState<User | null>(null);
  const [bikeMode, setBikeMode] = useState<RideBriefingMode>('ebike');
  const [briefingView, setBriefingView] = useState<RideBriefingView>('basic');
  const [routeLibrary, setRouteLibrary] = useState<RouteLibraryEntry[]>([]);
  const [deleteArmedId, setDeleteArmedId] = useState<string | null>(null);
  const [offlineRouteIds, setOfflineRouteIds] = useState<Set<string>>(() => new Set());
  const [offlineStatus, setOfflineStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [offlineMessage, setOfflineMessage] = useState('');
  const [now, setNow] = useState(() => new Date(0));
  const metrics = useMemo(() => routeMetrics(points), [points]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setNow(new Date());
      setRouteLibrary(mergeRouteLibrary(getPlannedRoutes()));
      void listOfflineMapPackages().then((packages) => {
        setOfflineRouteIds(new Set(packages.map((mapPackage) => mapPackage.routeId)));
      });
    }, 0);
    const supabase = createClient();
    void supabase?.auth.getUser().then(async ({ data }) => {
      setUser(data.user);
      if (!data.user) return;
      const cloud = await fetchSavedRoutes();
      setRouteLibrary(mergeRouteLibrary(getPlannedRoutes(), cloud));
    });
    return () => window.clearTimeout(timer);
  }, []);

  const invalidateAnalysis = () => {
    setAnalysis(null);
    setAnalysisStatus('idle');
    setError('');
    setSaveStatus('');
    setOfflineStatus('idle');
    setOfflineMessage('');
  };

  const addPoint = (point: PlannedRoutePoint) => {
    setPoints((current) => [...current, point]);
    setRedoPoints([]);
    invalidateAnalysis();
  };

  const analyze = async (routePoints = points, routeName = name) => {
    if (routePoints.length < 2) {
      setError('Añade al menos dos puntos o importa un GPX.');
      return;
    }
    setAnalysisStatus('loading');
    setError('');
    try {
      const response = await fetch('/api/route-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: routeId,
          title: routeName,
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Madrid',
          points: routePoints,
        }),
      });
      const payload = await response.json() as RouteStatusPayload & { error?: string };
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || payload.message || 'No se pudo analizar la ruta.');
      }
      setAnalysis(payload);
      setAnalysisStatus('ready');
    } catch (analysisError) {
      setAnalysisStatus('error');
      setError(analysisError instanceof Error ? analysisError.message : 'No se pudo analizar la ruta.');
    }
  };

  const importGpx = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const route = parseNavigationGpx(await file.text(), file.name);
      setRouteId(route.id);
      setName(route.name);
      setPoints(route.points);
      setRedoPoints([]);
      setSaveStatus('');
      setOfflineStatus('idle');
      setOfflineMessage('');
      await analyze(route.points, route.name);
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : 'No se pudo leer el GPX.');
    } finally {
      event.target.value = '';
    }
  };

  const buildPlannedRoute = (): PlannedRoute => ({
    id: routeId,
    name: name.trim() || 'Mi ruta MTB',
    trackIds: [],
    distanceKm: analysis?.profile?.distanceKm ?? metrics.distanceKm,
    elevationGainM: analysis?.profile?.gainM ?? metrics.gainM,
    estimatedTimeMin: Math.max(1, Math.round((analysis?.profile?.distanceKm ?? metrics.distanceKm) / 12 * 60)),
    difficulty: 'personalizada',
    warnings: [
      'Ruta creada por el usuario: comprueba permisos de paso, estado del terreno y posibles cierres.',
    ],
    points,
    createdAt: new Date().toISOString(),
  });

  const saveRoute = async () => {
    if (points.length < 2) {
      setError('La ruta necesita al menos dos puntos.');
      return;
    }
    const route = buildPlannedRoute();
    savePlannedRoute(route);
    setRouteLibrary(mergeRouteLibrary(getPlannedRoutes()));
    setSaveStatus('Guardada en este dispositivo.');
    if (!user) return;
    const result = await saveRouteToCloud({
      id: route.id,
      name: route.name,
      track_ids: [],
      distance_km: route.distanceKm,
      elevation_gain_m: route.elevationGainM,
      elevation_loss_m: analysis?.profile?.lossM ?? metrics.lossM,
      estimated_time_min: route.estimatedTimeMin,
      difficulty: 'azul',
      route_points: route.points,
      warnings: route.warnings,
    });
    setSaveStatus(result.error
      ? 'Guardada localmente; la copia en la cuenta no se pudo completar.'
      : 'Guardada en el dispositivo y en tu cuenta.');
    if (!result.error) {
      const cloud = await fetchSavedRoutes();
      setRouteLibrary(mergeRouteLibrary(getPlannedRoutes(), cloud));
    }
  };

  const loadLibraryRoute = (route: PlannedRoute) => {
    setRouteId(route.id);
    setName(route.name);
    setPoints(route.points);
    setRedoPoints([]);
    setAnalysis(null);
    setAnalysisStatus('idle');
    setError('');
    setSaveStatus('Ruta abierta. Analízala para actualizar meteo y luz.');
    setOfflineStatus(offlineRouteIds.has(route.id) ? 'ready' : 'idle');
    setOfflineMessage(offlineRouteIds.has(route.id) ? 'Esta ruta ya tiene un mapa offline preparado.' : '');
  };

  const removeLibraryRoute = async (entry: RouteLibraryEntry) => {
    if (deleteArmedId !== entry.route.id) {
      setDeleteArmedId(entry.route.id);
      return;
    }
    deletePlannedRoute(entry.route.id);
    await deleteOfflineMapPackage(entry.route.id);
    if (entry.cloud) await deleteSavedRoute(entry.route.id);
    setOfflineRouteIds((current) => {
      const next = new Set(current);
      next.delete(entry.route.id);
      return next;
    });
    setDeleteArmedId(null);
    const cloud = user ? await fetchSavedRoutes() : [];
    setRouteLibrary(mergeRouteLibrary(getPlannedRoutes(), cloud));
  };

  const startNavigation = () => {
    if (points.length < 2) return;
    const route = buildPlannedRoute();
    savePlannedRoute(route);
    window.location.assign(`/grabar?ruta=${encodeURIComponent(route.id)}`);
  };

  const downloadOfflineMap = async () => {
    if (points.length < 2) return;
    const route = buildPlannedRoute();
    savePlannedRoute(route);
    setOfflineStatus('loading');
    setOfflineMessage('Descargando caminos y senderos desde OpenStreetMap…');
    try {
      let payload: OfflineMapPackage;
      try {
        payload = await downloadOfflineMapFromDevice(route);
      } catch {
        const controller = new AbortController();
        const timeout = window.setTimeout(() => controller.abort(), 20_000);
        try {
          const response = await fetch('/api/offline-map', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              routeId: route.id,
              routeName: route.name,
              points: route.points,
            }),
            signal: controller.signal,
          });
          const fallbackPayload = await response.json() as OfflineMapPackage & { error?: string };
          if (!response.ok || !fallbackPayload.trails?.features) {
            throw new Error(fallbackPayload.error || 'No se pudo descargar el mapa offline.');
          }
          payload = fallbackPayload;
        } finally {
          window.clearTimeout(timeout);
          controller.abort();
        }
      }
      await saveOfflineMapPackage(payload);
      setOfflineRouteIds((current) => new Set(current).add(route.id));
      setOfflineStatus('ready');
      setOfflineMessage(`Offline listo: ${payload.trails.features.length.toLocaleString('es-ES')} caminos y senderos.`);
    } catch (downloadError) {
      setOfflineStatus('error');
      setOfflineMessage(downloadError instanceof Error
        ? downloadError.message
        : 'No se pudo descargar el mapa offline.');
    }
  };

  const exportGpx = () => {
    if (points.length < 2) return;
    const trackPoints = points.map((point) => (
      `<trkpt lat="${point.latitude}" lon="${point.longitude}">${point.elevation == null ? '' : `<ele>${point.elevation}</ele>`}</trkpt>`
    )).join('');
    const xml = `<?xml version="1.0" encoding="UTF-8"?><gpx version="1.1" creator="E-nduro Ebiketracks"><trk><name>${escapeXml(name)}</name><trkseg>${trackPoints}</trkseg></trk></gpx>`;
    const url = URL.createObjectURL(new Blob([xml], { type: 'application/gpx+xml' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'ruta'}.gpx`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <main className="min-h-screen bg-slate-950 pb-28 text-white md:pb-16">
      <div className="mx-auto max-w-[1500px] px-4 py-6 sm:px-6 lg:py-8">
        <header className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.22em] text-orange-400">
              <LocateFixed className="h-4 w-4" /> Route lab
            </p>
            <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">Crea una ruta en cualquier lugar</h1>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-400">
              Dibuja punto a punto o importa cualquier GPX. Después cruzamos trazado, desnivel, ritmo, luz y estaciones AEMET cercanas.
            </p>
          </div>
          <label className="flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-xl border border-orange-500/30 bg-orange-500/10 px-5 text-xs font-black uppercase text-orange-300">
            <FileUp className="h-4 w-4" /> Importar GPX
            <input type="file" accept=".gpx,application/gpx+xml" onChange={importGpx} className="sr-only" />
          </label>
        </header>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
          <section className="overflow-hidden rounded-3xl border border-white/10 bg-slate-900/50">
            <div className="flex flex-wrap items-center gap-2 border-b border-white/10 p-3">
              <button type="button" aria-pressed={drawing} onClick={() => setDrawing((value) => !value)}
                className={`min-h-11 rounded-xl px-4 text-[10px] font-black uppercase ${drawing ? 'bg-orange-500 text-white' : 'bg-slate-950 text-slate-400'}`}>
                {drawing ? 'Dibujando' : 'Explorar mapa'}
              </button>
              <button type="button" disabled={points.length === 0} onClick={() => {
                setPoints((current) => {
                  const removed = current.at(-1);
                  if (removed) setRedoPoints((redo) => [...redo, removed]);
                  return current.slice(0, -1);
                });
                invalidateAnalysis();
              }} className="grid h-11 w-11 place-items-center rounded-xl bg-slate-950 text-slate-400 disabled:opacity-30" aria-label="Deshacer punto">
                <Undo2 className="h-4 w-4" />
              </button>
              <button type="button" disabled={redoPoints.length === 0} onClick={() => {
                setRedoPoints((redo) => {
                  const restored = redo.at(-1);
                  if (restored) setPoints((current) => [...current, restored]);
                  return redo.slice(0, -1);
                });
                invalidateAnalysis();
              }} className="grid h-11 w-11 place-items-center rounded-xl bg-slate-950 text-slate-400 disabled:opacity-30" aria-label="Rehacer punto">
                <Redo2 className="h-4 w-4" />
              </button>
              <button type="button" disabled={points.length === 0} onClick={() => {
                setPoints([]);
                setRedoPoints([]);
                setRouteId(crypto.randomUUID());
                invalidateAnalysis();
              }} className="grid h-11 w-11 place-items-center rounded-xl bg-slate-950 text-red-400 disabled:opacity-30" aria-label="Borrar ruta">
                <Eraser className="h-4 w-4" />
              </button>
              <p className="ml-auto text-[10px] text-slate-500">
                {drawing ? 'Toca el mapa para añadir puntos' : 'Arrastra, gira y amplía con los dedos'}
              </p>
            </div>
            <div className="h-[52svh] min-h-[340px] max-h-[720px]">
              <UniversalRouteMap points={points} drawing={drawing} onAddPoint={addPoint} />
            </div>
          </section>

          <aside className="space-y-4 rounded-3xl border border-white/10 bg-slate-900/60 p-4 sm:p-5">
            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500">
              Nombre
              <input value={name} maxLength={120} onChange={(event) => {
                setName(event.target.value);
                invalidateAnalysis();
              }} className="mt-2 min-h-12 w-full rounded-xl border border-white/10 bg-slate-950 px-4 text-sm font-bold text-white outline-none focus:border-orange-500" />
            </label>
            <div className="grid grid-cols-3 gap-2">
              <Metric label="Distancia" value={`${metrics.distanceKm.toFixed(1)} km`} />
              <Metric label="Desnivel +" value={metrics.gainM > 0 ? `${Math.round(metrics.gainM)} m` : '—'} />
              <Metric label="Puntos" value={String(points.length)} />
            </div>
            <p className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-3 text-[10px] leading-relaxed text-slate-400">
              El dibujo une puntos directamente: marca los cambios del sendero con suficiente detalle. Para máxima fidelidad y altitud, importa un GPX grabado o preparado.
            </p>
            {error && <p role="alert" className="rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-300">{error}</p>}
            <button type="button" onClick={() => { void analyze(); }} disabled={points.length < 2 || analysisStatus === 'loading'}
              className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-orange-500 px-4 text-xs font-black uppercase text-white disabled:opacity-40">
              <CloudSun className="h-4 w-4" /> {analysisStatus === 'loading' ? 'Buscando estaciones…' : 'Analizar ruta + meteo'}
            </button>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => { void saveRoute(); }} disabled={points.length < 2}
                className="flex min-h-12 items-center justify-center gap-1.5 rounded-xl bg-slate-800 text-[10px] font-black uppercase disabled:opacity-30">
                <Save className="h-4 w-4" /> Guardar
              </button>
              <button type="button" onClick={() => { void downloadOfflineMap(); }}
                disabled={points.length < 2 || offlineStatus === 'loading'}
                className="flex min-h-12 items-center justify-center gap-1.5 rounded-xl bg-blue-500/15 text-[10px] font-black uppercase text-blue-300 disabled:opacity-30">
                <CloudDownload className="h-4 w-4" />
                {offlineStatus === 'loading' ? 'Descargando…' : offlineRouteIds.has(routeId) ? 'Actualizar offline' : 'Mapa offline'}
              </button>
              <button type="button" onClick={exportGpx} disabled={points.length < 2}
                className="flex min-h-12 items-center justify-center gap-1.5 rounded-xl bg-slate-800 text-[10px] font-black uppercase disabled:opacity-30">
                <Download className="h-4 w-4" /> GPX
              </button>
              <button type="button" onClick={startNavigation} disabled={points.length < 2}
                className="flex min-h-12 items-center justify-center gap-1.5 rounded-xl bg-emerald-500 text-[10px] font-black uppercase text-slate-950 disabled:opacity-30">
                <Navigation className="h-4 w-4" /> Navegar
              </button>
            </div>
            {saveStatus && <p role="status" className="text-[10px] text-emerald-300">{saveStatus}</p>}
            {offlineMessage && (
              <p role="status" className={`rounded-xl border p-3 text-[10px] ${
                offlineStatus === 'error'
                  ? 'border-red-500/20 bg-red-500/10 text-red-300'
                  : 'border-blue-500/20 bg-blue-500/10 text-blue-200'
              }`}>
                {offlineMessage}
              </p>
            )}
            {!user && points.length >= 2 && (
              <p className="text-[10px] leading-relaxed text-slate-500">
                Se guardará localmente. <a href="/auth?next=/planifica" className="font-black text-orange-400 underline">Inicia sesión</a> para copiarla también a tu cuenta.
              </p>
            )}
            {routeLibrary.length > 0 && (
              <div className="border-t border-white/10 pt-4">
                <p className="mb-2 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
                  <FolderOpen className="h-4 w-4 text-orange-400" /> Mis rutas
                </p>
                <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
                  {routeLibrary.map((entry) => (
                    <div key={entry.route.id} className="flex items-center gap-2 rounded-xl border border-white/10 bg-slate-950/70 p-2">
                      <button type="button" onClick={() => loadLibraryRoute(entry.route)}
                        className="min-h-11 min-w-0 flex-1 rounded-lg px-2 text-left">
                        <span className="block truncate text-xs font-black text-white">{entry.route.name}</span>
                        <span className="mt-1 block text-[9px] text-slate-500">
                          {entry.route.distanceKm.toFixed(1)} km · +{Math.round(entry.route.elevationGainM)} m
                          {entry.cloud ? ' · cuenta' : ' · dispositivo'}
                          {offlineRouteIds.has(entry.route.id) ? ' · offline' : ''}
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => { void removeLibraryRoute(entry); }}
                        className={`flex h-11 shrink-0 items-center justify-center rounded-lg text-[8px] font-black uppercase ${
                          deleteArmedId === entry.route.id
                            ? 'min-w-20 bg-red-500 px-2 text-white'
                            : 'w-11 bg-slate-900 text-red-400'
                        }`}
                        aria-label={deleteArmedId === entry.route.id ? `Confirmar borrado de ${entry.route.name}` : `Borrar ${entry.route.name}`}
                      >
                        {deleteArmedId === entry.route.id ? 'Confirmar' : <Trash2 className="h-4 w-4" />}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </aside>
        </div>

        {analysis?.ok && (
          <div className="mt-5">
            <RouteRideBriefing
              data={analysis}
              now={now}
              etaFactor={1}
              bikeMode={bikeMode}
              onBikeModeChange={setBikeMode}
              view={briefingView}
              onViewChange={setBriefingView}
            />
          </div>
        )}
      </div>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-950 p-3 text-center">
      <p className="text-[8px] font-black uppercase tracking-widest text-slate-600">{label}</p>
      <p className="mt-1 text-sm font-black text-white">{value}</p>
    </div>
  );
}
