import type { TrailPoint } from '@/data/trails';
import { computeDistanceKm, computeElevation, haversineKm } from '@/lib/gpx-utils';

export type RouteSegmentType = 'climb' | 'descent' | 'flat';

export interface RouteSegment {
  id: string;
  type: RouteSegmentType;
  startIndex: number;
  endIndex: number;
  startKm: number;
  endKm: number;
  distanceKm: number;
  elevationDeltaM: number;
  avgSlopePct: number;
  maxSlopePct: number;
  minSlopePct: number;
  start: TrailPoint;
  end: TrailPoint;
  label: string;
  relevance: 'high' | 'medium' | 'low';
}

export interface RouteProfileMetrics {
  points: number;
  distanceKm: number;
  gainM: number;
  lossM: number;
  maxAltitudeM: number;
  minAltitudeM: number;
  medianAltitudeM: number;
  steepestClimbPct: number;
  steepestDescentPct: number;
  segments: RouteSegment[];
  profileSeries: Array<{ km: number; elevationM: number }>;
}

const CLIMB_THRESHOLD = 3;
const DESCENT_THRESHOLD = -3;
const SEGMENT_MIN_METERS = 300;
const WINDOW_METERS = 200;

function round(value: number, digits = 1): number {
  const p = 10 ** digits;
  return Math.round(value * p) / p;
}

function classifySlope(slopePct: number): RouteSegmentType {
  if (slopePct >= CLIMB_THRESHOLD) return 'climb';
  if (slopePct <= DESCENT_THRESHOLD) return 'descent';
  return 'flat';
}

function segmentLabel(type: RouteSegmentType, avgSlopePct: number, distanceKm: number, elevationDeltaM: number): string {
  if (type === 'climb') {
    if (avgSlopePct >= 10) return 'Subida principal de desgaste';
    if (avgSlopePct >= 7) return 'Rampa dura de coronacion';
    if (distanceKm >= 1.5) return 'Subida larga progresiva';
    return 'Subida tecnica';
  }
  if (type === 'descent') {
    if (Math.abs(avgSlopePct) >= 15) return 'Descenso clave exigente';
    if (Math.abs(elevationDeltaM) >= 120) return 'Bajada intensa';
    return 'Bajada tecnica';
  }
  return 'Tramo de transicion';
}

function getRelevance(elevationDeltaM: number, avgSlopePct: number): 'high' | 'medium' | 'low' {
  if (Math.abs(elevationDeltaM) > 150 || Math.abs(avgSlopePct) > 10) return 'high';
  if (Math.abs(elevationDeltaM) > 70) return 'medium';
  return 'low';
}

export function analyzeRoute(points: TrailPoint[]): RouteProfileMetrics {
  if (points.length < 2) {
    return {
      points: points.length,
      distanceKm: 0,
      gainM: 0,
      lossM: 0,
      maxAltitudeM: 0,
      minAltitudeM: 0,
      medianAltitudeM: 0,
      steepestClimbPct: 0,
      steepestDescentPct: 0,
      segments: [],
      profileSeries: [],
    };
  }

  const edgeMeters: number[] = [];
  const cumMeters: number[] = [0];
  const edgeSlopePct: number[] = [];
  const altitudes = points.map((p) => p.elevation ?? 0);

  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    const distMeters = haversineKm(a.lat, a.lng, b.lat, b.lng) * 1000;
    const elevDelta = (b.elevation ?? 0) - (a.elevation ?? 0);
    edgeMeters.push(distMeters);
    cumMeters.push(cumMeters[cumMeters.length - 1] + distMeters);
    edgeSlopePct.push(distMeters > 0 ? (elevDelta / distMeters) * 100 : 0);
  }

  const rawRanges: Array<{ type: RouteSegmentType; start: number; end: number }> = [];
  let currentType: RouteSegmentType = 'flat';
  let currentStart = 0;

  for (let i = 0; i < points.length - 1; i++) {
    let windowDist = 0;
    let windowElev = 0;
    let j = i;
    while (j < points.length - 1 && windowDist < WINDOW_METERS) {
      windowDist += edgeMeters[j];
      windowElev += (points[j + 1].elevation ?? 0) - (points[j].elevation ?? 0);
      j++;
    }
    const slope = windowDist > 0 ? (windowElev / windowDist) * 100 : 0;
    const nextType = classifySlope(slope);

    if (nextType !== currentType) {
      if (currentType !== 'flat' && i - currentStart > 3) {
        rawRanges.push({ type: currentType, start: currentStart, end: i });
      }
      currentType = nextType;
      currentStart = i;
    }
  }
  if (currentType !== 'flat' && points.length - 1 - currentStart > 3) {
    rawRanges.push({ type: currentType, start: currentStart, end: points.length - 1 });
  }

  const segments: RouteSegment[] = rawRanges
    .map((r, idx) => {
      const distMeters = edgeMeters.slice(r.start, r.end).reduce((a, b) => a + b, 0);
      const elevDelta = (points[r.end].elevation ?? 0) - (points[r.start].elevation ?? 0);
      const slopes = edgeSlopePct.slice(r.start, r.end);
      const avgSlope = distMeters > 0 ? (elevDelta / distMeters) * 100 : 0;
      const maxSlope = slopes.length ? Math.max(...slopes) : 0;
      const minSlope = slopes.length ? Math.min(...slopes) : 0;

      return {
        id: `seg-${idx + 1}`,
        type: r.type,
        startIndex: r.start,
        endIndex: r.end,
        startKm: round(cumMeters[r.start] / 1000, 2),
        endKm: round(cumMeters[r.end] / 1000, 2),
        distanceKm: round(distMeters / 1000, 2),
        elevationDeltaM: Math.round(elevDelta),
        avgSlopePct: round(avgSlope, 1),
        maxSlopePct: round(maxSlope, 1),
        minSlopePct: round(minSlope, 1),
        start: points[r.start],
        end: points[r.end],
        label: segmentLabel(r.type, avgSlope, distMeters / 1000, elevDelta),
        relevance: getRelevance(elevDelta, avgSlope),
      };
    })
    .filter((s) => s.distanceKm * 1000 >= SEGMENT_MIN_METERS);

  let steepestClimb = -Infinity;
  let steepestDescent = Infinity;
  for (let i = 0; i < points.length - 1; i++) {
    let windowDist = 0;
    let windowElev = 0;
    let j = i;
    while (j < points.length - 1 && windowDist < 250) {
      windowDist += edgeMeters[j];
      windowElev += (points[j + 1].elevation ?? 0) - (points[j].elevation ?? 0);
      j++;
    }
    if (windowDist < 150) continue;
    const slope = (windowElev / windowDist) * 100;
    if (slope > steepestClimb) steepestClimb = slope;
    if (slope < steepestDescent) steepestDescent = slope;
  }

  const elev = computeElevation(points);
  const sortedAltitudes = [...altitudes].sort((a, b) => a - b);
  const mid = Math.floor(sortedAltitudes.length / 2);
  const median =
    sortedAltitudes.length % 2 === 0
      ? (sortedAltitudes[mid - 1] + sortedAltitudes[mid]) / 2
      : sortedAltitudes[mid];

  const profileSeries: Array<{ km: number; elevationM: number }> = [];
  const sampleEvery = Math.max(1, Math.floor(points.length / 120));
  for (let i = 0; i < points.length; i += sampleEvery) {
    profileSeries.push({
      km: round(cumMeters[i] / 1000, 2),
      elevationM: round(points[i].elevation ?? 0, 1),
    });
  }
  const lastKm = round(cumMeters[cumMeters.length - 1] / 1000, 2);
  const lastEle = round(points[points.length - 1].elevation ?? 0, 1);
  if (!profileSeries.length || profileSeries[profileSeries.length - 1].km !== lastKm) {
    profileSeries.push({ km: lastKm, elevationM: lastEle });
  }

  return {
    points: points.length,
    distanceKm: computeDistanceKm(points),
    gainM: elev.gainM,
    lossM: elev.lossM,
    maxAltitudeM: elev.maxM,
    minAltitudeM: elev.minM,
    medianAltitudeM: round(median, 1),
    steepestClimbPct: round(steepestClimb, 1),
    steepestDescentPct: round(steepestDescent, 1),
    segments,
    profileSeries,
  };
}
