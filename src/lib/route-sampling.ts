import { haversineKm } from './gpx-utils.ts';

export type RouteSamplePoint = {
  lat: number;
  lng: number;
  elevation?: number | null;
};

export type RouteDistanceIndex = {
  cumulativeKm: number[];
  totalKm: number;
};

export function buildRouteDistanceIndex(points: RouteSamplePoint[]): RouteDistanceIndex {
  const cumulativeKm = [0];
  for (let index = 1; index < points.length; index += 1) {
    cumulativeKm.push(
      cumulativeKm[index - 1]
      + haversineKm(
        points[index - 1].lat,
        points[index - 1].lng,
        points[index].lat,
        points[index].lng,
      ),
    );
  }
  return { cumulativeKm, totalKm: cumulativeKm.at(-1) ?? 0 };
}

function interpolateRoutePoint(
  a: RouteSamplePoint,
  b: RouteSamplePoint,
  fraction: number,
): RouteSamplePoint {
  const safeFraction = Math.max(0, Math.min(1, fraction));
  const elevation = a.elevation == null || b.elevation == null
    ? a.elevation ?? b.elevation ?? null
    : a.elevation + (b.elevation - a.elevation) * safeFraction;
  return {
    lat: a.lat + (b.lat - a.lat) * safeFraction,
    lng: a.lng + (b.lng - a.lng) * safeFraction,
    elevation,
  };
}

export function pointAtRouteDistance(
  points: RouteSamplePoint[],
  distanceIndex: RouteDistanceIndex,
  targetKm: number,
): RouteSamplePoint {
  if (points.length === 0) return { lat: 0, lng: 0, elevation: null };
  if (points.length === 1 || distanceIndex.totalKm <= 0) return points[0];
  const safeTarget = Math.max(0, Math.min(distanceIndex.totalKm, targetKm));
  const upperIndex = distanceIndex.cumulativeKm.findIndex((distance) => distance >= safeTarget);
  if (upperIndex <= 0) return points[0];
  if (upperIndex < 0) return points.at(-1) ?? points[0];
  const lowerIndex = upperIndex - 1;
  const lowerKm = distanceIndex.cumulativeKm[lowerIndex];
  const edgeKm = distanceIndex.cumulativeKm[upperIndex] - lowerKm;
  if (edgeKm <= 0) return points[upperIndex];
  return interpolateRoutePoint(
    points[lowerIndex],
    points[upperIndex],
    (safeTarget - lowerKm) / edgeKm,
  );
}

export function sampleRoutePointAtFraction(
  points: RouteSamplePoint[],
  fraction: number,
): RouteSamplePoint | null {
  if (points.length === 0) return null;
  const distanceIndex = buildRouteDistanceIndex(points);
  return pointAtRouteDistance(
    points,
    distanceIndex,
    distanceIndex.totalKm * Math.max(0, Math.min(1, fraction)),
  );
}

export function sampleRoutePointsByDistance(
  points: RouteSamplePoint[],
  count: number,
): RouteSamplePoint[] {
  if (points.length === 0 || count <= 0) return [];
  if (count === 1) return [points[0]];
  const distanceIndex = buildRouteDistanceIndex(points);
  const sampleCount = Math.min(count, points.length);
  return Array.from({ length: sampleCount }, (_, index) => (
    pointAtRouteDistance(
      points,
      distanceIndex,
      distanceIndex.totalKm * index / Math.max(1, sampleCount - 1),
    )
  ));
}
