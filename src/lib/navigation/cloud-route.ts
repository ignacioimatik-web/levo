import type { SavedRouteData } from '@/lib/forfait/save-route';
import type { PlannedRoute } from './types';

export function plannedRouteFromSavedRoute(
  saved: SavedRouteData,
  local?: PlannedRoute,
): PlannedRoute {
  const cloud: PlannedRoute = {
    id: saved.id,
    name: saved.name,
    trackIds: saved.track_ids,
    distanceKm: saved.distance_km,
    elevationGainM: saved.elevation_gain_m,
    estimatedTimeMin: saved.estimated_time_min,
    difficulty: saved.difficulty,
    warnings: saved.warnings ?? [],
    points: saved.route_points ?? [],
    controlPoints: saved.control_points?.length ? saved.control_points : undefined,
    routingMode: saved.routing_mode ?? 'manual',
    reference: saved.reference ?? undefined,
    createdAt: saved.created_at,
  };
  if (!local) return cloud;
  return {
    ...cloud,
    controlPoints: local.controlPoints ?? cloud.controlPoints,
    routingMode: local.routingMode ?? cloud.routingMode,
    reference: local.reference ?? cloud.reference,
  };
}
