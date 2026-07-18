import { haversineKm } from '../gpx-utils.ts';

export interface RejoinRouteAnchor {
  originLatitude: number;
  originLongitude: number;
  targetLatitude: number;
  targetLongitude: number;
  requestedAt: number;
}

export const REJOIN_ROUTE_THRESHOLD_M = 100;
export const REJOIN_ORIGIN_REFRESH_M = 80;
export const REJOIN_TARGET_REFRESH_M = 50;
export const REJOIN_MAX_AGE_MS = 45_000;

function distanceM(
  firstLatitude: number,
  firstLongitude: number,
  secondLatitude: number,
  secondLongitude: number,
): number {
  return haversineKm(
    firstLatitude,
    firstLongitude,
    secondLatitude,
    secondLongitude,
  ) * 1_000;
}

export function shouldRequestRejoinRoute({
  previous,
  originLatitude,
  originLongitude,
  targetLatitude,
  targetLongitude,
  now,
}: {
  previous: RejoinRouteAnchor | null;
  originLatitude: number;
  originLongitude: number;
  targetLatitude: number;
  targetLongitude: number;
  now: number;
}): boolean {
  if (!previous) return true;
  if (now - previous.requestedAt >= REJOIN_MAX_AGE_MS) return true;
  const originMovedM = distanceM(
    previous.originLatitude,
    previous.originLongitude,
    originLatitude,
    originLongitude,
  );
  if (originMovedM >= REJOIN_ORIGIN_REFRESH_M) return true;
  const targetMovedM = distanceM(
    previous.targetLatitude,
    previous.targetLongitude,
    targetLatitude,
    targetLongitude,
  );
  return targetMovedM >= REJOIN_TARGET_REFRESH_M;
}
