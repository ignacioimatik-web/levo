import { distanceBetween } from '../activities/geo.ts';
import type { RidePoint } from '../activities/types.ts';
import type { NavigationProgress, PlannedRoutePoint } from './types.ts';

export interface RouteDirectionAssessment {
  state: 'aligned' | 'wrong-way';
  movementBearingDeg: number;
  routeBearingDeg: number;
  differenceDeg: number;
  movementDistanceM: number;
}

function asRidePoint(point: PlannedRoutePoint): RidePoint {
  return {
    ...point,
    accuracy: 0,
    speed: null,
    timestamp: 0,
  };
}

function bearing(
  from: Pick<RidePoint, 'latitude' | 'longitude'>,
  to: Pick<RidePoint, 'latitude' | 'longitude'>,
): number {
  const fromLatitude = from.latitude * Math.PI / 180;
  const toLatitude = to.latitude * Math.PI / 180;
  const longitudeDelta = (to.longitude - from.longitude) * Math.PI / 180;
  const y = Math.sin(longitudeDelta) * Math.cos(toLatitude);
  const x = Math.cos(fromLatitude) * Math.sin(toLatitude)
    - Math.sin(fromLatitude) * Math.cos(toLatitude) * Math.cos(longitudeDelta);
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}

function bearingDifference(a: number, b: number): number {
  return Math.abs(((a - b + 540) % 360) - 180);
}

function movementOrigin(points: RidePoint[], minimumDistanceM: number): RidePoint | null {
  const latest = points.at(-1);
  if (!latest) return null;
  for (let index = points.length - 2; index >= Math.max(0, points.length - 80); index -= 1) {
    if (distanceBetween(points[index], latest) >= minimumDistanceM) return points[index];
  }
  return null;
}

function routeTargetIndex(
  route: PlannedRoutePoint[],
  originIndex: number,
  minimumDistanceM: number,
): number | null {
  let traversedM = 0;
  for (let index = originIndex + 1; index < route.length; index += 1) {
    traversedM += distanceBetween(asRidePoint(route[index - 1]), asRidePoint(route[index]));
    if (traversedM >= minimumDistanceM) return index;
  }
  return route.length - 1 > originIndex ? route.length - 1 : null;
}

export function assessRouteDirection(
  route: PlannedRoutePoint[],
  ridePoints: RidePoint[],
  navigation: NavigationProgress | null,
): RouteDirectionAssessment | null {
  const latest = ridePoints.at(-1);
  if (!navigation || !latest || route.length < 2 || navigation.offRouteM > 50) return null;
  if (latest.accuracy > 35 || (latest.speed != null && latest.speed < 1.2)) return null;

  const origin = movementOrigin(ridePoints, 20);
  if (!origin) return null;
  const elapsedSeconds = (latest.timestamp - origin.timestamp) / 1_000;
  const movementDistanceM = distanceBetween(origin, latest);
  if (elapsedSeconds > 0 && movementDistanceM / elapsedSeconds < 1.2) return null;

  const routeOriginIndex = Math.min(navigation.nearestIndex, route.length - 2);
  const routeTarget = routeTargetIndex(route, routeOriginIndex, 8);
  if (routeTarget == null) return null;

  const movementBearingDeg = bearing(origin, latest);
  const routeBearingDeg = bearing(
    asRidePoint(route[routeOriginIndex]),
    asRidePoint(route[routeTarget]),
  );
  const differenceDeg = bearingDifference(movementBearingDeg, routeBearingDeg);
  return {
    state: differenceDeg >= 145 ? 'wrong-way' : 'aligned',
    movementBearingDeg,
    routeBearingDeg,
    differenceDeg,
    movementDistanceM,
  };
}
