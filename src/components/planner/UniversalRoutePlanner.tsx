'use client';

import dynamic from 'next/dynamic';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  CloudDownload, CloudSun, Download, Eraser, FileUp, LocateFixed, Navigation,
  FolderOpen, Mountain, PenLine, Redo2, Save, Trash2, Undo2, Zap,
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
import type {
  PlannedRoute, PlannedRoutePoint, RoutePlanningMode,
} from '@/lib/navigation/types';
import {
  routerProfileForMode,
  type RoutedPath,
} from '@/lib/navigation/routing';
import {
  deleteOfflineMapPackage,
  getOfflineMapPackage,
  listOfflineMapPackages,
  saveOfflineMapPackage,
} from '@/lib/navigation/offline-map-storage';
import type { OfflineMapPackage } from '@/lib/navigation/offline-map-storage';
import {
  OFFLINE_MAP_VERSION,
  offlineMapMatchesRoute,
  offlineRouteFingerprint,
} from '@/lib/navigation/offline-map-version';
import {
  buildOverpassMapQuery,
  buildOverpassTrailOnlyQuery,
  overpassElementsToGeoJson,
  summarizeOfflineMap,
} from '@/lib/navigation/offline-map-data';
import type { OverpassElement } from '@/lib/navigation/offline-map-data';
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

type OfflineMapIdentity = Pick<OfflineMapPackage, 'version' | 'routeFingerprint'>;

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
    'https://overpass.private.coffee/api/interpreter',
  ];
  const controllers = endpoints.map(() => new AbortController());
  const timeout = window.setTimeout(() => {
    controllers.forEach((controller) => controller.abort());
  }, 18_000);

  try {
    const fetchElements = (query: string) => Promise.any(endpoints.map(async (endpoint, index) => {
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
      return payload.elements as OverpassElement[];
    }));
    let elements: OverpassElement[];
    try {
      elements = await fetchElements(buildOverpassMapQuery(route.points));
    } catch {
      elements = await fetchElements(buildOverpassTrailOnlyQuery(route.points));
    }
    const trails = overpassElementsToGeoJson(elements);
    if (trails.features.length === 0) {
      throw new Error('No se encontraron caminos cartografiados alrededor de esta ruta.');
    }
    return {
      version: OFFLINE_MAP_VERSION,
      routeFingerprint: offlineRouteFingerprint(route.points),
      routeId: route.id,
      routeName: route.name,
      trails,
      summary: summarizeOfflineMap(trails),
      fetchedAt: new Date().toISOString(),
      attribution: '© colaboradores de OpenStreetMap · datos obtenidos mediante Overpass API',
      sampleRadiusM: 800,
    };
  } finally {
    window.clearTimeout(timeout);
    controllers.forEach((controller) => controller.abort());
  }
}

type UniversalRoutePlannerProps = {
  initialGpxUrl?: string;
  initialRouteName?: string;
};

export default function UniversalRoutePlanner({
  initialGpxUrl,
  initialRouteName,
}: UniversalRoutePlannerProps) {
  const initialGpxLoaded = useRef(false);
  const routingInFlight = useRef(false);
  const offlineCheckToken = useRef(0);
  const [routeId, setRouteId] = useState(() => crypto.randomUUID());
  const [name, setName] = useState('Mi ruta MTB');
  const [points, setPoints] = useState<PlannedRoutePoint[]>([]);
  const [waypoints, setWaypoints] = useState<PlannedRoutePoint[]>([]);
  const [redoWaypoints, setRedoWaypoints] = useState<PlannedRoutePoint[]>([]);
  const [routeMode, setRouteMode] = useState<RoutePlanningMode>('mtb');
  const [routeStatus, setRouteStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [routingEstimate, setRoutingEstimate] = useState<RoutedPath | null>(null);
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
  const [offlineMapIdentities, setOfflineMapIdentities] = useState<Map<string, OfflineMapIdentity>>(
    () => new Map(),
  );
  const [offlineStatus, setOfflineStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [offlineMessage, setOfflineMessage] = useState('');
  const [navigationStatus, setNavigationStatus] = useState<'idle' | 'preparing' | 'fallback'>('idle');
  const [now, setNow] = useState(() => new Date(0));
  const metrics = useMemo(() => routeMetrics(points), [points]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setNow(new Date());
      setRouteLibrary(mergeRouteLibrary(getPlannedRoutes()));
      void listOfflineMapPackages().then((packages) => {
        setOfflineMapIdentities(new Map(packages.map((mapPackage) => [
          mapPackage.routeId,
          {
            version: mapPackage.version,
            routeFingerprint: mapPackage.routeFingerprint,
          },
        ])));
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

  useEffect(() => {
    if (!initialGpxUrl || initialGpxLoaded.current) return;
    initialGpxLoaded.current = true;
    const controller = new AbortController();
    void (async () => {
      try {
        setSaveStatus('Abriendo el track real…');
        const response = await fetch(initialGpxUrl, { signal: controller.signal });
        if (!response.ok) throw new Error('El GPX de esta ruta no está disponible.');
        const fileName = initialGpxUrl.split('/').at(-1) ?? 'ruta.gpx';
        const route = parseNavigationGpx(await response.text(), fileName);
        setRouteId(route.id);
        setName(initialRouteName?.trim() || route.name);
        setPoints(route.points);
        setWaypoints(route.points);
        setRedoWaypoints([]);
        setRouteMode('manual');
        setRouteStatus('idle');
        setRoutingEstimate(null);
        offlineCheckToken.current += 1;
        setAnalysis(null);
        setAnalysisStatus('idle');
        setOfflineStatus('idle');
        setOfflineMessage('');
        setNavigationStatus('idle');
        setSaveStatus('Track real cargado. Analízalo para actualizar meteo, luz y autonomía.');
      } catch (loadError) {
        if (controller.signal.aborted) return;
        setSaveStatus('');
        setError(loadError instanceof Error ? loadError.message : 'No se pudo abrir este GPX.');
      }
    })();
    return () => controller.abort();
  }, [initialGpxUrl, initialRouteName]);

  const invalidateAnalysis = () => {
    offlineCheckToken.current += 1;
    setAnalysis(null);
    setAnalysisStatus('idle');
    setError('');
    setSaveStatus('');
    setOfflineStatus('idle');
    setOfflineMessage('');
    setNavigationStatus('idle');
  };

  const calculateRoutedPath = async (
    controlPoints: PlannedRoutePoint[],
    mode: RoutePlanningMode,
  ): Promise<RoutedPath | null> => {
    const profile = routerProfileForMode(mode);
    if (!profile || controlPoints.length < 2) return null;
    const response = await fetch('/api/route-path', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ points: controlPoints, profile }),
    });
    const payload = await response.json() as { route?: RoutedPath; error?: string };
    if (!response.ok || !payload.route?.points?.length) {
      throw new Error(payload.error || 'No se encontró un camino ciclable entre esos puntos.');
    }
    return payload.route;
  };

  const applyWaypoints = async (
    nextWaypoints: PlannedRoutePoint[],
    mode = routeMode,
  ): Promise<boolean> => {
    if (mode === 'manual' || nextWaypoints.length < 2) {
      setWaypoints(nextWaypoints);
      setPoints(nextWaypoints);
      setRouteStatus('idle');
      setRoutingEstimate(null);
      return true;
    }
    if (routingInFlight.current) return false;
    routingInFlight.current = true;
    setRouteStatus('loading');
    setError('');
    try {
      const routedPath = await calculateRoutedPath(nextWaypoints, mode);
      if (!routedPath) throw new Error('El motor no devolvió un camino.');
      setWaypoints(nextWaypoints);
      setPoints(routedPath.points);
      setRoutingEstimate(routedPath);
      setRouteStatus('idle');
      routingInFlight.current = false;
      return true;
    } catch (routeError) {
      setRouteStatus('error');
      setError(routeError instanceof Error ? routeError.message : 'No se pudo calcular el camino.');
      routingInFlight.current = false;
      return false;
    }
  };

  const addPoint = async (point: PlannedRoutePoint) => {
    if (routingInFlight.current) return;
    const changed = await applyWaypoints([...waypoints, point]);
    if (!changed) return;
    setRedoWaypoints([]);
    invalidateAnalysis();
  };

  const undoPoint = async () => {
    const removed = waypoints.at(-1);
    if (!removed || routingInFlight.current) return;
    const changed = await applyWaypoints(waypoints.slice(0, -1));
    if (!changed) return;
    setRedoWaypoints((redo) => [...redo, removed]);
    invalidateAnalysis();
  };

  const redoPoint = async () => {
    const restored = redoWaypoints.at(-1);
    if (!restored || routingInFlight.current) return;
    const changed = await applyWaypoints([...waypoints, restored]);
    if (!changed) return;
    setRedoWaypoints((redo) => redo.slice(0, -1));
    invalidateAnalysis();
  };

  const changeRouteMode = (mode: RoutePlanningMode) => {
    if (routingInFlight.current) return;
    if (waypoints.length > 1) {
      setError('Borra la ruta actual antes de cambiar el tipo de trazado.');
      return;
    }
    setRouteMode(mode);
    setRouteStatus('idle');
    setRoutingEstimate(null);
    setError('');
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
      setWaypoints(route.points);
      setRedoWaypoints([]);
      setRouteMode('manual');
      setRouteStatus('idle');
      setRoutingEstimate(null);
      offlineCheckToken.current += 1;
      setSaveStatus('');
      setOfflineStatus('idle');
      setOfflineMessage('');
      setNavigationStatus('idle');
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
    estimatedTimeMin: Math.max(1, Math.round(
      analysis?.profile
        ? analysis.profile.distanceKm / (routeMode === 'ebike' ? 16 : 12) * 60
        : routingEstimate?.estimatedSeconds
          ? routingEstimate.estimatedSeconds / 60
          : metrics.distanceKm / (routeMode === 'ebike' ? 16 : 12) * 60,
    )),
    difficulty: 'personalizada',
    warnings: [
      'Ruta creada por el usuario: comprueba permisos de paso, estado del terreno y posibles cierres.',
    ],
    points,
    controlPoints: routeMode === 'manual' ? undefined : waypoints,
    routingMode: routeMode,
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
    const storedMode = route.routingMode && route.controlPoints ? route.routingMode : 'manual';
    setRouteId(route.id);
    setName(route.name);
    setPoints(route.points);
    setWaypoints(route.controlPoints ?? route.points);
    setRedoWaypoints([]);
    setRouteMode(storedMode);
    setRouteStatus('idle');
    setRoutingEstimate(null);
    setAnalysis(null);
    setAnalysisStatus('idle');
    setError('');
    setSaveStatus('Ruta abierta. Analízala para actualizar meteo y luz.');
    setOfflineStatus('idle');
    setOfflineMessage('');
    setNavigationStatus('idle');
    const checkToken = ++offlineCheckToken.current;
    void getOfflineMapPackage(route.id).then((mapPackage) => {
      if (offlineCheckToken.current !== checkToken) return;
      if (offlineMapMatchesRoute(mapPackage, route.points)) {
        setOfflineStatus('ready');
        setOfflineMessage('Mapa offline vigente para este trazado exacto.');
        return;
      }
      if (mapPackage) {
        setOfflineStatus('error');
        setOfflineMessage('El mapa offline guardado pertenece a una versión anterior. Se actualizará antes de navegar.');
      }
    }).catch(() => {
      if (offlineCheckToken.current !== checkToken) return;
      setOfflineStatus('error');
      setOfflineMessage('No se pudo comprobar el mapa guardado. Se verificará de nuevo antes de navegar.');
    });
  };

  const removeLibraryRoute = async (entry: RouteLibraryEntry) => {
    if (deleteArmedId !== entry.route.id) {
      setDeleteArmedId(entry.route.id);
      return;
    }
    deletePlannedRoute(entry.route.id);
    await deleteOfflineMapPackage(entry.route.id);
    if (entry.cloud) await deleteSavedRoute(entry.route.id);
    setOfflineMapIdentities((current) => {
      const next = new Map(current);
      next.delete(entry.route.id);
      return next;
    });
    setDeleteArmedId(null);
    const cloud = user ? await fetchSavedRoutes() : [];
    setRouteLibrary(mergeRouteLibrary(getPlannedRoutes(), cloud));
  };

  const prepareOfflineMap = async (route: PlannedRoute): Promise<OfflineMapPackage> => {
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
    const currentPayload: OfflineMapPackage = {
      ...payload,
      version: OFFLINE_MAP_VERSION,
      routeId: route.id,
      routeName: route.name,
      routeFingerprint: offlineRouteFingerprint(route.points),
    };
    await saveOfflineMapPackage(currentPayload);
    setOfflineMapIdentities((current) => new Map(current).set(route.id, {
      version: currentPayload.version,
      routeFingerprint: currentPayload.routeFingerprint,
    }));
    setOfflineStatus('ready');
    const summary = currentPayload.summary ?? summarizeOfflineMap(currentPayload.trails);
    setOfflineMessage(`Offline listo: ${summary.trails.toLocaleString('es-ES')} caminos · ${summary.pois.toLocaleString('es-ES')} puntos útiles · ${summary.water.toLocaleString('es-ES')} referencias de agua.`);
    return currentPayload;
  };

  const startNavigation = async () => {
    if (points.length < 2 || navigationStatus === 'preparing') return;
    const route = buildPlannedRoute();
    savePlannedRoute(route);
    const navigationUrl = `/grabar?ruta=${encodeURIComponent(route.id)}`;
    if (navigationStatus === 'fallback') {
      window.location.assign(navigationUrl);
      return;
    }

    setNavigationStatus('preparing');
    setOfflineStatus('loading');
    setOfflineMessage('Comprobando el mapa exacto de esta ruta antes de salir…');
    try {
      const storedPackage = await getOfflineMapPackage(route.id);
      if (!offlineMapMatchesRoute(storedPackage, route.points)) {
        setOfflineMessage('Preparando caminos, agua y puntos útiles para navegar sin cobertura…');
        await prepareOfflineMap(route);
      } else {
        setOfflineStatus('ready');
        setOfflineMessage('Mapa offline comprobado para este trazado exacto.');
      }
      window.location.assign(navigationUrl);
    } catch (downloadError) {
      setNavigationStatus('fallback');
      setOfflineStatus('error');
      const reason = downloadError instanceof Error
        ? downloadError.message
        : 'No se pudo preparar el mapa offline.';
      setOfflineMessage(`${reason} Pulsa “Navegar solo con track” para continuar sin cartografía offline.`);
    }
  };

  const downloadOfflineMap = async () => {
    if (points.length < 2 || navigationStatus === 'preparing') return;
    const route = buildPlannedRoute();
    savePlannedRoute(route);
    setNavigationStatus('idle');
    setOfflineStatus('loading');
    setOfflineMessage('Descargando caminos, agua y puntos útiles desde OpenStreetMap…');
    try {
      await prepareOfflineMap(route);
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
            <div className="grid grid-cols-3 gap-1.5 border-b border-white/10 bg-slate-950/35 p-2 sm:flex sm:gap-2 sm:p-3">
              {([
                ['mtb', 'MTB sendero', Mountain],
                ['ebike', 'E-bike', Zap],
                ['manual', 'Manual', PenLine],
              ] as const).map(([mode, label, Icon]) => (
                <button
                  key={mode}
                  type="button"
                  aria-pressed={routeMode === mode}
                  disabled={routeStatus === 'loading'}
                  onClick={() => changeRouteMode(mode)}
                  className={`flex min-h-11 items-center justify-center gap-1.5 rounded-xl px-2 text-[9px] font-black uppercase disabled:opacity-50 sm:px-4 sm:text-[10px] ${
                    routeMode === mode
                      ? 'bg-blue-500 text-white'
                      : 'border border-white/10 bg-slate-950 text-slate-400'
                  }`}
                >
                  <Icon className="h-4 w-4" /> {label}
                </button>
              ))}
              <p className="col-span-3 self-center px-2 text-center text-[9px] text-slate-500 sm:ml-auto sm:text-right">
                {routeMode === 'manual'
                  ? 'Une puntos directamente'
                  : routeMode === 'mtb'
                    ? 'Prioriza pistas y senderos ciclables'
                    : 'Trazado ciclable equilibrado para e-bike'}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 border-b border-white/10 p-3">
              <button type="button" aria-pressed={drawing} onClick={() => setDrawing((value) => !value)}
                className={`min-h-11 rounded-xl px-4 text-[10px] font-black uppercase ${drawing ? 'bg-orange-500 text-white' : 'bg-slate-950 text-slate-400'}`}>
                {drawing ? 'Dibujando' : 'Explorar mapa'}
              </button>
              <button type="button" disabled={waypoints.length === 0 || routeStatus === 'loading'} onClick={() => {
                void undoPoint();
              }} className="grid h-11 w-11 place-items-center rounded-xl bg-slate-950 text-slate-400 disabled:opacity-30" aria-label="Deshacer punto de control">
                <Undo2 className="h-4 w-4" />
              </button>
              <button type="button" disabled={redoWaypoints.length === 0 || routeStatus === 'loading'} onClick={() => {
                void redoPoint();
              }} className="grid h-11 w-11 place-items-center rounded-xl bg-slate-950 text-slate-400 disabled:opacity-30" aria-label="Rehacer punto de control">
                <Redo2 className="h-4 w-4" />
              </button>
              <button type="button" disabled={points.length === 0 || routeStatus === 'loading'} onClick={() => {
                setPoints([]);
                setWaypoints([]);
                setRedoWaypoints([]);
                setRouteStatus('idle');
                setRoutingEstimate(null);
                setRouteId(crypto.randomUUID());
                invalidateAnalysis();
              }} className="grid h-11 w-11 place-items-center rounded-xl bg-slate-950 text-red-400 disabled:opacity-30" aria-label="Borrar ruta">
                <Eraser className="h-4 w-4" />
              </button>
              <p className="ml-auto text-[10px] text-slate-500">
                {routeStatus === 'loading'
                  ? 'Calculando camino…'
                  : drawing
                    ? 'Toca el mapa para añadir controles'
                    : 'Arrastra, gira y amplía con los dedos'}
              </p>
            </div>
            <div className="h-[52svh] min-h-[340px] max-h-[720px]">
              <UniversalRouteMap
                points={points}
                controlPoints={waypoints}
                drawing={drawing && routeStatus !== 'loading'}
                onAddPoint={(point) => { void addPoint(point); }}
              />
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
              <Metric label="Controles" value={String(waypoints.length)} />
            </div>
            <p className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-3 text-[10px] leading-relaxed text-slate-400">
              {routeMode === 'manual'
                ? 'Modo manual: une puntos directamente. Marca cada cambio del sendero o importa un GPX para máxima fidelidad.'
                : 'BRouter sigue la red ciclable de OpenStreetMap y añade altitud. Revisa siempre acceso, firme, dificultad y cierres antes de salir.'}
              {routeMode !== 'manual' && (
                <span className="mt-1 block text-slate-500">
                  Los controles se procesan mediante nuestro servidor; BRouter recibe coordenadas, no tu cuenta.
                </span>
              )}
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
                disabled={points.length < 2 || offlineStatus === 'loading' || navigationStatus === 'preparing'}
                className="flex min-h-12 items-center justify-center gap-1.5 rounded-xl bg-blue-500/15 text-[10px] font-black uppercase text-blue-300 disabled:opacity-30">
                <CloudDownload className="h-4 w-4" />
                {offlineStatus === 'loading'
                  ? 'Descargando…'
                  : offlineMapMatchesRoute(offlineMapIdentities.get(routeId), points)
                    ? 'Actualizar offline'
                    : offlineMapIdentities.has(routeId)
                      ? 'Renovar offline'
                      : 'Mapa offline'}
              </button>
              <button type="button" onClick={exportGpx} disabled={points.length < 2}
                className="flex min-h-12 items-center justify-center gap-1.5 rounded-xl bg-slate-800 text-[10px] font-black uppercase disabled:opacity-30">
                <Download className="h-4 w-4" /> GPX
              </button>
              <button type="button" onClick={() => { void startNavigation(); }}
                disabled={points.length < 2 || navigationStatus === 'preparing'}
                className="flex min-h-12 items-center justify-center gap-1.5 rounded-xl bg-emerald-500 text-[10px] font-black uppercase text-slate-950 disabled:opacity-30">
                <Navigation className="h-4 w-4" />
                {navigationStatus === 'preparing'
                  ? 'Preparando…'
                  : navigationStatus === 'fallback'
                    ? 'Navegar solo con track'
                    : offlineStatus === 'ready'
                      ? 'Navegar offline'
                      : 'Preparar y navegar'}
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
                          {offlineMapMatchesRoute(
                            offlineMapIdentities.get(entry.route.id),
                            entry.route.points,
                          )
                            ? ' · offline'
                            : offlineMapIdentities.has(entry.route.id)
                              ? ' · offline antiguo'
                              : ''}
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
