import { distanceBetween } from '../activities/geo.ts';
import type { RidePoint } from '@/lib/activities/types';
import type { NavigationProgress, PlannedRoutePoint } from './types';

function asRidePoint(point: PlannedRoutePoint): RidePoint {
  return {
    ...point,
    accuracy: 0,
    speed: null,
    timestamp: 0,
  };
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
  let offRouteM = Number.POSITIVE_INFINITY;
  for (let index = 0; index < route.length; index += 1) {
    if (cumulativeM[index] > maxCompletedM) break;
    if (cumulativeM[index] < minCompletedM) continue;
    const distance = distanceBetween(position, asRidePoint(route[index]));
    if (distance < offRouteM) {
      offRouteM = distance;
      nearestIndex = index;
    }
  }

  const totalM = cumulativeM.at(-1) ?? 0;
  const completedM = cumulativeM[nearestIndex];
  let remainingGainM = 0;
  for (let index = 1; index < route.length; index += 1) {
    if (index > nearestIndex && route[index - 1].elevation != null && route[index].elevation != null) {
      remainingGainM += Math.max(0, route[index].elevation! - route[index - 1].elevation!);
    }
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
