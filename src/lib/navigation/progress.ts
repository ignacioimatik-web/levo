import { distanceBetween } from '../activities/geo.ts';
import type { RidePoint } from '@/lib/activities/types';
import type { NavigationProgress, PlannedRoutePoint } from './types';

const EARTH_RADIUS_M = 6_371_000;

function asRidePoint(point: PlannedRoutePoint): RidePoint {
  return {
    ...point,
    accuracy: 0,
    speed: null,
    timestamp: 0,
  };
}

function toLocalMeters(point: PlannedRoutePoint, origin: RidePoint): { x: number; y: number } {
  const latitudeRadians = (point.latitude - origin.latitude) * Math.PI / 180;
  const longitudeRadians = (point.longitude - origin.longitude) * Math.PI / 180;
  const meanLatitude = (point.latitude + origin.latitude) / 2 * Math.PI / 180;
  return {
    x: longitudeRadians * EARTH_RADIUS_M * Math.cos(meanLatitude),
    y: latitudeRadians * EARTH_RADIUS_M,
  };
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

export function calculateNavigationProgress(
  route: PlannedRoutePoint[],
  position: RidePoint,
  maxCompletedM = Number.POSITIVE_INFINITY,
  minCompletedM = 0,
): NavigationProgress | null {
  if (route.length < 2) return null;

  const cumulativeM = [0];
  for (let index = 1; index < route.length; index += 1) {
    cumulativeM.push(
      cumulativeM[index - 1] + distanceBetween(asRidePoint(route[index - 1]), asRidePoint(route[index])),
    );
  }

  let nearestIndex = 0;
  let selectedSegmentIndex = 0;
  let selectedSegmentFraction = 0;
  let offRouteM = Number.POSITIVE_INFINITY;
  let completedM = 0;
  const ambiguityM = Math.max(5, Math.min(20, position.accuracy * 1.5));

  for (let index = 0; index < route.length - 1; index += 1) {
    const segmentStartM = cumulativeM[index];
    const segmentEndM = cumulativeM[index + 1];
    const segmentLengthM = segmentEndM - segmentStartM;
    if (segmentStartM > maxCompletedM) break;
    if (segmentEndM < minCompletedM || segmentLengthM <= 0) continue;

    const minimumFraction = clamp((minCompletedM - segmentStartM) / segmentLengthM, 0, 1);
    const maximumFraction = clamp((maxCompletedM - segmentStartM) / segmentLengthM, 0, 1);
    if (maximumFraction < minimumFraction) continue;

    const start = toLocalMeters(route[index], position);
    const end = toLocalMeters(route[index + 1], position);
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const planarLengthSquared = dx * dx + dy * dy;
    const rawFraction = planarLengthSquared > 0
      ? -(start.x * dx + start.y * dy) / planarLengthSquared
      : 0;
    const fraction = clamp(rawFraction, minimumFraction, maximumFraction);
    const projectedX = start.x + dx * fraction;
    const projectedY = start.y + dy * fraction;
    const distanceM = Math.hypot(projectedX, projectedY);

    // At crossings or the start/end of a loop, GPS cannot reliably distinguish
    // candidates a few metres apart. Prefer the earlier valid segment unless
    // the new candidate is clearly closer than the reported GPS accuracy.
    if (distanceM >= offRouteM - ambiguityM) continue;

    selectedSegmentIndex = index;
    selectedSegmentFraction = fraction;
    offRouteM = distanceM;
    completedM = segmentStartM + segmentLengthM * fraction;
    nearestIndex = fraction >= 0.999 ? index + 1 : index;
  }

  const totalM = cumulativeM.at(-1) ?? 0;
  if (!Number.isFinite(offRouteM)) return null;

  let remainingGainM = 0;
  for (let index = selectedSegmentIndex; index < route.length - 1; index += 1) {
    const startElevation = route[index].elevation;
    const endElevation = route[index + 1].elevation;
    if (startElevation == null || endElevation == null) continue;
    const gainM = Math.max(0, endElevation - startElevation);
    remainingGainM += index === selectedSegmentIndex
      ? gainM * (1 - selectedSegmentFraction)
      : gainM;
  }

  return {
    nearestIndex,
    offRouteM,
    completedM,
    remainingM: Math.max(0, totalM - completedM),
    remainingGainM,
    progressPercent: totalM > 0 ? Math.min(100, completedM / totalM * 100) : 0,
  };
}
