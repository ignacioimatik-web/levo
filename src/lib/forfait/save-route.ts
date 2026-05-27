export interface SavedRouteData {
  id: string;
  name: string;
  track_ids: string[];
  distance_km: number;
  elevation_gain_m: number;
  elevation_loss_m: number;
  estimated_time_min: number;
  difficulty: string;
  created_at: string;
  updated_at: string;
}

export interface SavedRoutesResponse {
  routes: SavedRouteData[];
}

export async function fetchSavedRoutes(): Promise<SavedRouteData[]> {
  const res = await fetch('/api/forfait/save-route');
  if (!res.ok) return [];
  const data: SavedRoutesResponse = await res.json();
  return data.routes ?? [];
}

export async function saveRouteToCloud(params: {
  name: string;
  track_ids: string[];
  distance_km: number;
  elevation_gain_m: number;
  elevation_loss_m: number;
  estimated_time_min: number;
  difficulty: string;
}): Promise<{ route?: SavedRouteData; error?: string }> {
  const res = await fetch('/api/forfait/save-route', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const data = await res.json();
  if (!res.ok) return { error: data.error ?? 'Error al guardar' };
  return { route: data.route };
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
