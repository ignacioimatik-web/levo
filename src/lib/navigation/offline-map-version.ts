import type { PlannedRoutePoint } from './types';

export const OFFLINE_MAP_VERSION = 3 as const;

type OfflineMapIdentity = {
  version?: number;
  routeFingerprint?: string;
};

function mixHash(hash: number, value: number): number {
  let mixed = hash ^ value;
  mixed = Math.imul(mixed, 16_777_619);
  mixed ^= mixed >>> 13;
  return mixed >>> 0;
}

export function offlineRouteFingerprint(points: PlannedRoutePoint[]): string {
  let hash = mixHash(2_166_136_261, points.length);
  for (const point of points) {
    hash = mixHash(hash, Math.round(point.latitude * 1_000_000));
    hash = mixHash(hash, Math.round(point.longitude * 1_000_000));
  }
  return `route-v1-${points.length}-${hash.toString(36)}`;
}

export function offlineMapMatchesRoute(
  mapPackage: OfflineMapIdentity | null | undefined,
  points: PlannedRoutePoint[],
): boolean {
  return mapPackage?.version === OFFLINE_MAP_VERSION
    && mapPackage.routeFingerprint === offlineRouteFingerprint(points);
}
