import type {
  PlannedRoutePoint, RoutePlanningMode,
} from '@/lib/navigation/types';

export interface SavedRouteData {
  id: string;
  name: string;
  track_ids: string[];
  distance_km: number;
  elevation_gain_m: number;
  elevation_loss_m: number;
  estimated_time_min: number;
  difficulty: string;
  route_points: PlannedRoutePoint[];
  control_points: PlannedRoutePoint[];
  routing_mode: RoutePlanningMode;
  reference: {
    activityId: string;
    title: string;
    durationSeconds: number;
    startedAt: string;
  } | null;
  warnings: string[];
  created_at: string;
  updated_at: string;
}

export interface SavedRoutesResponse {
  routes: SavedRouteData[];
}

export interface SavedRouteResponse {
  route: SavedRouteData | null;
}

export async function fetchSavedRoutes(): Promise<SavedRouteData[]> {
  try {
    const res = await fetch('/api/forfait/save-route');
    if (!res.ok) return [];
    const data: SavedRoutesResponse = await res.json();
    return data.routes ?? [];
  } catch {
    return [];
  }
}

export async function fetchSavedRoute(id: string): Promise<SavedRouteData | null> {
  try {
    const res = await fetch(`/api/forfait/save-route?id=${encodeURIComponent(id)}`);
    if (!res.ok) return null;
    const data: SavedRouteResponse = await res.json();
    return data.route ?? null;
  } catch {
    return null;
  }
}

export async function saveRouteToCloud(params: {
  id?: string;
  name: string;
  track_ids: string[];
  distance_km: number;
  elevation_gain_m: number;
  elevation_loss_m: number;
  estimated_time_min: number;
  difficulty: string;
  route_points: PlannedRoutePoint[];
  control_points?: PlannedRoutePoint[];
  routing_mode?: RoutePlanningMode;
  reference?: SavedRouteData['reference'];
  warnings: string[];
}, options: {
  timeoutMs?: number;
} = {}): Promise<{ route?: SavedRouteData; error?: string }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 12_000);
  try {
    const res = await fetch('/api/forfait/save-route', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
      signal: controller.signal,
    });
    const data = await res.json() as { route?: SavedRouteData; error?: string };
    if (!res.ok) return { error: data.error ?? 'Error al guardar' };
    return { route: data.route };
  } catch {
    return { error: 'No se pudo conectar con tu cuenta.' };
  } finally {
    clearTimeout(timeout);
  }
}

export async function deleteSavedRoute(id: string): Promise<{ error?: string }> {
  const res = await fetch(`/api/forfait/save-route?id=${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    const data = await res.json();
    return { error: data.error ?? 'Error al eliminar' };
  }
  return {};
}
