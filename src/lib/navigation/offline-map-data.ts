import type { PlannedRoutePoint } from './types';

export type OfflineTrailProperties = {
  id: number;
  highway: string;
  name: string | null;
  surface: string | null;
  tracktype: string | null;
  mtbScale: string | null;
  access: string | null;
};

export type OfflineTrailFeature = {
  type: 'Feature';
  properties: OfflineTrailProperties;
  geometry: {
    type: 'LineString';
    coordinates: [number, number][];
  };
};

export type OfflineTrailCollection = {
  type: 'FeatureCollection';
  features: OfflineTrailFeature[];
};

export type OverpassWay = {
  type?: unknown;
  id?: unknown;
  tags?: Record<string, unknown>;
  geometry?: Array<{ lat?: unknown; lon?: unknown }>;
};

export function sampleOfflineRoute(
  points: PlannedRoutePoint[],
  maxSamples = 12,
): PlannedRoutePoint[] {
  if (points.length <= maxSamples) return points;
  const indexes = new Set<number>([0, points.length - 1]);
  for (let index = 1; index < maxSamples - 1; index += 1) {
    indexes.add(Math.round(index / (maxSamples - 1) * (points.length - 1)));
  }
  return [...indexes].sort((a, b) => a - b).map((index) => points[index]);
}

export function buildOverpassTrailQuery(
  points: PlannedRoutePoint[],
  radiusM = 1_200,
): string {
  const radius = Math.max(300, Math.min(2_000, Math.round(radiusM)));
  const samples = sampleOfflineRoute(points);
  const clauses = samples.map((point) => {
    const latitudeDelta = radius / 111_320;
    const longitudeDelta = radius / (
      111_320 * Math.max(0.1, Math.cos(point.latitude * Math.PI / 180))
    );
    return `way["highway"](${(point.latitude - latitudeDelta).toFixed(6)},${(point.longitude - longitudeDelta).toFixed(6)},${(point.latitude + latitudeDelta).toFixed(6)},${(point.longitude + longitudeDelta).toFixed(6)});`;
  }).join('');
  return `[out:json][timeout:25];(${clauses});out tags geom;`;
}

export function overpassWaysToGeoJson(
  elements: OverpassWay[],
  maxFeatures = 6_000,
): OfflineTrailCollection {
  const features: OfflineTrailFeature[] = [];
  let coordinateCount = 0;
  for (const element of elements) {
    if (
      features.length >= maxFeatures
      || coordinateCount >= 120_000
      || element.type !== 'way'
      || !Array.isArray(element.geometry)
    ) continue;
    const coordinates = element.geometry.flatMap((point) => {
      const latitude = Number(point.lat);
      const longitude = Number(point.lon);
      return Number.isFinite(latitude) && Number.isFinite(longitude)
        ? [[longitude, latitude] as [number, number]]
        : [];
    });
    if (coordinates.length < 2) continue;
    const remainingCoordinates = 120_000 - coordinateCount;
    if (remainingCoordinates < 2) break;
    const retainedCoordinates = coordinates.slice(0, remainingCoordinates);
    const tags = element.tags ?? {};
    features.push({
      type: 'Feature',
      properties: {
        id: Number(element.id) || 0,
        highway: typeof tags.highway === 'string' ? tags.highway : 'path',
        name: typeof tags.name === 'string' ? tags.name : null,
        surface: typeof tags.surface === 'string' ? tags.surface : null,
        tracktype: typeof tags.tracktype === 'string' ? tags.tracktype : null,
        mtbScale: typeof tags['mtb:scale'] === 'string' ? tags['mtb:scale'] : null,
        access: typeof tags.access === 'string' ? tags.access : null,
      },
      geometry: { type: 'LineString', coordinates: retainedCoordinates },
    });
    coordinateCount += retainedCoordinates.length;
  }
  return { type: 'FeatureCollection', features };
}
