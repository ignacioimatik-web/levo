import type { PlannedRoutePoint, RoutePlanningMode } from './types';

export type RouterProfile = 'mtb' | 'trekking';
const MAX_ROUTED_POINTS = 5_000;

interface BRouterFeature {
  geometry?: {
    type?: string;
    coordinates?: unknown[];
  };
  properties?: Record<string, unknown>;
}

interface BRouterResponse {
  type?: string;
  features?: BRouterFeature[];
}

export interface RoutedPath {
  points: PlannedRoutePoint[];
  distanceM: number;
  elevationGainM: number;
  estimatedSeconds: number;
  profile: RouterProfile;
}

function finite(value: unknown): number | null {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function metric(properties: Record<string, unknown>, key: string): number {
  return Math.max(0, finite(properties[key]) ?? 0);
}

export function routerProfileForMode(mode: RoutePlanningMode): RouterProfile | null {
  if (mode === 'mtb') return 'mtb';
  if (mode === 'ebike') return 'trekking';
  return null;
}

export function normalizeBRouterResponse(
  input: unknown,
  profile: RouterProfile,
): RoutedPath | null {
  const payload = input as BRouterResponse;
  const feature = Array.isArray(payload?.features) ? payload.features[0] : undefined;
  if (feature?.geometry?.type !== 'LineString' || !Array.isArray(feature.geometry.coordinates)) {
    return null;
  }

  const allPoints = feature.geometry.coordinates.flatMap((coordinate) => {
    if (!Array.isArray(coordinate) || coordinate.length < 2) return [];
    const longitude = finite(coordinate[0]);
    const latitude = finite(coordinate[1]);
    const elevation = finite(coordinate[2]);
    if (
      longitude == null
      || latitude == null
      || longitude < -180
      || longitude > 180
      || latitude < -90
      || latitude > 90
    ) return [];
    return [{
      latitude,
      longitude,
      elevation,
    }];
  });
  const points = allPoints.length <= MAX_ROUTED_POINTS
    ? allPoints
    : Array.from({ length: MAX_ROUTED_POINTS }, (_, index) => (
      allPoints[Math.round(index / (MAX_ROUTED_POINTS - 1) * (allPoints.length - 1))]
    ));
  if (points.length < 2) return null;

  const properties = feature.properties ?? {};
  return {
    points,
    distanceM: metric(properties, 'track-length'),
    elevationGainM: metric(properties, 'filtered ascend'),
    estimatedSeconds: metric(properties, 'total-time'),
    profile,
  };
}
