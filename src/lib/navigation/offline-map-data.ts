import type { PlannedRoutePoint } from './types';

export type OfflineMapFeatureKind = 'trail' | 'water' | 'barrier' | 'poi';

export type OfflineTrailProperties = {
  id: number;
  kind: OfflineMapFeatureKind;
  highway: string | null;
  name: string | null;
  surface: string | null;
  tracktype: string | null;
  mtbScale: string | null;
  access: string | null;
  poiType: string | null;
  elevationM: number | null;
};

export type OfflineTrailFeature = {
  type: 'Feature';
  properties: OfflineTrailProperties;
  geometry:
    | { type: 'LineString'; coordinates: [number, number][] }
    | { type: 'Polygon'; coordinates: [number, number][][] }
    | { type: 'Point'; coordinates: [number, number] };
};

export type OfflineTrailCollection = {
  type: 'FeatureCollection';
  features: OfflineTrailFeature[];
};

export type OverpassElement = {
  type?: unknown;
  id?: unknown;
  tags?: Record<string, unknown>;
  lat?: unknown;
  lon?: unknown;
  geometry?: Array<{ lat?: unknown; lon?: unknown }>;
};

export type OverpassWay = OverpassElement;

export type OfflineMapSummary = {
  trails: number;
  water: number;
  barriers: number;
  pois: number;
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

function distanceBetweenPointsM(a: PlannedRoutePoint, b: PlannedRoutePoint): number {
  const latitudeRadians = (a.latitude + b.latitude) / 2 * Math.PI / 180;
  const latitudeM = (b.latitude - a.latitude) * 111_320;
  const longitudeM = (b.longitude - a.longitude) * 111_320 * Math.cos(latitudeRadians);
  return Math.hypot(latitudeM, longitudeM);
}

function compactOverlappingSamples(
  points: PlannedRoutePoint[],
  radiusM: number,
): PlannedRoutePoint[] {
  const sampled = sampleOfflineRoute(points);
  if (sampled.length <= 2) return sampled;
  const retained = [sampled[0]];
  for (const point of sampled.slice(1, -1)) {
    if (distanceBetweenPointsM(retained.at(-1)!, point) >= radiusM * 0.9) {
      retained.push(point);
    }
  }
  const last = sampled.at(-1)!;
  if (distanceBetweenPointsM(retained.at(-1)!, last) >= radiusM * 0.35) {
    retained.push(last);
  }
  return retained;
}

export function buildOverpassMapQuery(
  points: PlannedRoutePoint[],
  radiusM = 800,
): string {
  const radius = Math.max(300, Math.min(2_000, Math.round(radiusM)));
  const samples = compactOverlappingSamples(points, radius);
  const clauses = samples.map((point) => {
    const latitudeDelta = radius / 111_320;
    const longitudeDelta = radius / (
      111_320 * Math.max(0.1, Math.cos(point.latitude * Math.PI / 180))
    );
    const bbox = `${(point.latitude - latitudeDelta).toFixed(6)},${(point.longitude - longitudeDelta).toFixed(6)},${(point.latitude + latitudeDelta).toFixed(6)},${(point.longitude + longitudeDelta).toFixed(6)}`;
    return [
      `way[~"^(highway|waterway|barrier)$"~"."](${bbox});`,
      `way["natural"="water"](${bbox});`,
      `node[~"^(amenity|tourism|natural|barrier|highway|emergency)$"~"^(drinking_water|shelter|parking|viewpoint|alpine_hut|wilderness_hut|peak|gate|lift_gate|cycle_barrier|trailhead|access_point)$"](${bbox});`,
    ].join('');
  }).join('');
  return `[out:json][timeout:25];(${clauses});out tags geom qt;`;
}

export function buildOverpassTrailOnlyQuery(
  points: PlannedRoutePoint[],
  radiusM = 800,
): string {
  const radius = Math.max(300, Math.min(2_000, Math.round(radiusM)));
  const samples = compactOverlappingSamples(points, radius);
  const clauses = samples.map((point) => {
    const latitudeDelta = radius / 111_320;
    const longitudeDelta = radius / (
      111_320 * Math.max(0.1, Math.cos(point.latitude * Math.PI / 180))
    );
    return `way["highway"](${(point.latitude - latitudeDelta).toFixed(6)},${(point.longitude - longitudeDelta).toFixed(6)},${(point.latitude + latitudeDelta).toFixed(6)},${(point.longitude + longitudeDelta).toFixed(6)});`;
  }).join('');
  return `[out:json][timeout:15];(${clauses});out tags geom qt;`;
}

export const buildOverpassTrailQuery = buildOverpassMapQuery;

function stringTag(tags: Record<string, unknown>, key: string): string | null {
  return typeof tags[key] === 'string' ? tags[key] as string : null;
}

function poiTypeFor(tags: Record<string, unknown>): string | null {
  for (const key of ['amenity', 'tourism', 'natural', 'barrier', 'highway', 'emergency']) {
    const value = stringTag(tags, key);
    if (value) return value;
  }
  return null;
}

function featureKind(tags: Record<string, unknown>, elementType: unknown): OfflineMapFeatureKind | null {
  if (elementType === 'node') return poiTypeFor(tags) ? 'poi' : null;
  if (stringTag(tags, 'highway')) return 'trail';
  if (stringTag(tags, 'waterway') || stringTag(tags, 'natural') === 'water') return 'water';
  if (stringTag(tags, 'barrier')) return 'barrier';
  return null;
}

export function overpassElementsToGeoJson(
  elements: OverpassElement[],
  maxFeatures = 6_000,
): OfflineTrailCollection {
  const features: OfflineTrailFeature[] = [];
  let coordinateCount = 0;
  for (const element of elements) {
    if (features.length >= maxFeatures || coordinateCount >= 120_000) break;
    const tags = element.tags ?? {};
    const kind = featureKind(tags, element.type);
    if (!kind) continue;
    const properties: OfflineTrailProperties = {
      id: Number(element.id) || 0,
      kind,
      highway: stringTag(tags, 'highway'),
      name: stringTag(tags, 'name'),
      surface: stringTag(tags, 'surface'),
      tracktype: stringTag(tags, 'tracktype'),
      mtbScale: stringTag(tags, 'mtb:scale'),
      access: stringTag(tags, 'access'),
      poiType: kind === 'poi' ? poiTypeFor(tags) : null,
      elevationM: Number.isFinite(Number(tags.ele)) ? Number(tags.ele) : null,
    };

    if (element.type === 'node') {
      const latitude = Number(element.lat);
      const longitude = Number(element.lon);
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) continue;
      features.push({
        type: 'Feature',
        properties,
        geometry: { type: 'Point', coordinates: [longitude, latitude] },
      });
      coordinateCount += 1;
      continue;
    }

    if (element.type !== 'way' || !Array.isArray(element.geometry)) continue;
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
    const closedPolygon = kind === 'water'
      && retainedCoordinates.length >= 4
      && retainedCoordinates[0][0] === retainedCoordinates.at(-1)![0]
      && retainedCoordinates[0][1] === retainedCoordinates.at(-1)![1];
    features.push({
      type: 'Feature',
      properties,
      geometry: closedPolygon
        ? { type: 'Polygon', coordinates: [retainedCoordinates] }
        : { type: 'LineString', coordinates: retainedCoordinates },
    });
    coordinateCount += retainedCoordinates.length;
  }
  return { type: 'FeatureCollection', features };
}

/**
 * Last-resort offline context when Overpass is unavailable or has no mapped
 * ways around a route. The planned line is still useful offline for guidance
 * and makes the feature degrade gracefully instead of failing the whole ride.
 */
export function routeToOfflineGeoJson(
  points: PlannedRoutePoint[],
  name = 'Ruta planificada',
): OfflineTrailCollection {
  const coordinates = points.map((point) => [point.longitude, point.latitude] as [number, number]);
  return {
    type: 'FeatureCollection',
    features: coordinates.length >= 2 ? [{
      type: 'Feature',
      properties: {
        id: 0,
        kind: 'trail',
        highway: null,
        name,
        surface: null,
        tracktype: null,
        mtbScale: null,
        access: null,
        poiType: null,
        elevationM: null,
      },
      geometry: { type: 'LineString', coordinates },
    }] : [],
  };
}

export const overpassWaysToGeoJson = overpassElementsToGeoJson;

export function summarizeOfflineMap(collection: OfflineTrailCollection): OfflineMapSummary {
  const summary: OfflineMapSummary = { trails: 0, water: 0, barriers: 0, pois: 0 };
  for (const feature of collection.features) {
    const kind = feature.properties.kind
      ?? (feature.properties.highway ? 'trail' : null);
    if (kind === 'trail') summary.trails += 1;
    if (kind === 'water') summary.water += 1;
    if (kind === 'barrier') summary.barriers += 1;
    if (kind === 'poi') summary.pois += 1;
  }
  return summary;
}
