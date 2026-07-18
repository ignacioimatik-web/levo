import type {
  CompetitiveSegment,
  SegmentCheckpoint,
} from '../../data/competitive-segments.ts';
import { COMPETITIVE_SEGMENTS } from '../../data/competitive-segments.ts';
import { distanceBetween } from '../activities/geo.ts';
import type { RideActivity, RidePoint, SegmentEffort } from '../activities/types.ts';

const CHECKPOINT_RADIUS_M = 100;
const MIN_EFFORT_SECONDS = 10;
const MAX_EFFORT_SECONDS = 2 * 60 * 60;
const MAX_SEGMENT_SPEED_KMH = 100;
const MIN_DISTANCE_RATIO = 0.65;
const MAX_DISTANCE_RATIO = 1.5;

function checkpointDistance(point: RidePoint, checkpoint: SegmentCheckpoint): number {
  return distanceBetween(point, {
    latitude: checkpoint.latitude,
    longitude: checkpoint.longitude,
    elevation: null,
    accuracy: 0,
    speed: null,
    timestamp: point.timestamp,
  });
}

function traceDistance(points: RidePoint[], startIndex: number, endIndex: number): number {
  let distanceM = 0;
  for (let index = startIndex + 1; index <= endIndex; index += 1) {
    const previous = points[index - 1];
    const current = points[index];
    const seconds = (current.timestamp - previous.timestamp) / 1000;
    if (seconds <= 0 || seconds > 120) continue;
    const intervalM = distanceBetween(previous, current);
    const speedKmh = intervalM / seconds * 3.6;
    if (speedKmh <= MAX_SEGMENT_SPEED_KMH) distanceM += intervalM;
  }
  return distanceM;
}

interface CandidateMatch {
  indices: number[];
  distancesM: number[];
}

function matchFromStart(
  points: RidePoint[],
  segment: CompetitiveSegment,
  startIndex: number,
): CandidateMatch | null {
  const indices = [startIndex];
  const distancesM = [checkpointDistance(points[startIndex], segment.checkpoints[0])];
  let cursor = startIndex + 1;

  for (const checkpoint of segment.checkpoints.slice(1)) {
    let bestIndex = -1;
    let bestDistanceM = Infinity;
    for (let index = cursor; index < points.length; index += 1) {
      const elapsedSeconds = (points[index].timestamp - points[startIndex].timestamp) / 1000;
      if (elapsedSeconds > MAX_EFFORT_SECONDS) break;
      const distanceM = checkpointDistance(points[index], checkpoint);
      if (distanceM < bestDistanceM) {
        bestDistanceM = distanceM;
        bestIndex = index;
      }
      if (distanceM <= 20) break;
    }
    if (bestIndex < cursor || bestDistanceM > CHECKPOINT_RADIUS_M) return null;
    indices.push(bestIndex);
    distancesM.push(bestDistanceM);
    cursor = bestIndex + 1;
  }
  return { indices, distancesM };
}

function candidateEffort(
  points: RidePoint[],
  segment: CompetitiveSegment,
  candidate: CandidateMatch,
): SegmentEffort | null {
  const startIndex = candidate.indices[0];
  const endIndex = candidate.indices.at(-1)!;
  const elapsedSeconds = Math.round(
    (points[endIndex].timestamp - points[startIndex].timestamp) / 1000,
  );
  if (elapsedSeconds < MIN_EFFORT_SECONDS || elapsedSeconds > MAX_EFFORT_SECONDS) return null;

  const distanceM = traceDistance(points, startIndex, endIndex);
  const distanceRatio = distanceM / segment.distanceM;
  if (distanceRatio < MIN_DISTANCE_RATIO || distanceRatio > MAX_DISTANCE_RATIO) return null;

  const averageSpeedKmh = distanceM / elapsedSeconds * 3.6;
  if (averageSpeedKmh <= 0 || averageSpeedKmh > MAX_SEGMENT_SPEED_KMH) return null;

  const checkpointScore = candidate.distancesM.reduce(
    (sum, distanceM) => sum + Math.max(0, 1 - distanceM / CHECKPOINT_RADIUS_M),
    0,
  ) / candidate.distancesM.length;
  const distanceScore = Math.max(0, 1 - Math.abs(1 - distanceRatio));

  return {
    segmentId: segment.id,
    elapsedSeconds,
    startedAt: new Date(points[startIndex].timestamp).toISOString(),
    endedAt: new Date(points[endIndex].timestamp).toISOString(),
    distanceM: Math.round(distanceM),
    averageSpeedKmh: Math.round(averageSpeedKmh * 10) / 10,
    matchQuality: Math.round((checkpointScore * 0.7 + distanceScore * 0.3) * 100) / 100,
  };
}

export function matchCompetitiveSegments(
  points: RidePoint[],
  segments: readonly CompetitiveSegment[] = COMPETITIVE_SEGMENTS,
): SegmentEffort[] {
  if (points.length < 3) return [];
  const validPoints = points.filter((point) => (
    Number.isFinite(point.latitude)
    && Number.isFinite(point.longitude)
    && Number.isFinite(point.timestamp)
    && point.accuracy >= 0
    && point.accuracy <= 100
  ));

  const efforts: SegmentEffort[] = [];
  for (const segment of segments) {
    let best: SegmentEffort | null = null;
    for (let index = 0; index < validPoints.length - 2; index += 1) {
      if (checkpointDistance(validPoints[index], segment.checkpoints[0]) > CHECKPOINT_RADIUS_M) continue;
      const candidate = matchFromStart(validPoints, segment, index);
      if (!candidate) continue;
      const effort = candidateEffort(validPoints, segment, candidate);
      if (effort && (!best || effort.elapsedSeconds < best.elapsedSeconds)) best = effort;
    }
    if (best) efforts.push(best);
  }
  return efforts.sort((a, b) => Date.parse(a.startedAt) - Date.parse(b.startedAt));
}

export interface PersonalSegmentBest {
  segmentId: string;
  sportType: RideActivity['sportType'];
  effort: SegmentEffort;
  activity: RideActivity;
  attempts: number;
}

export function personalSegmentBests(activities: RideActivity[]): PersonalSegmentBest[] {
  const bests = new Map<string, PersonalSegmentBest>();
  for (const activity of activities) {
    for (const effort of activity.segmentEfforts ?? []) {
      const key = `${effort.segmentId}:${activity.sportType}`;
      const current = bests.get(key);
      if (!current) {
        bests.set(key, {
          segmentId: effort.segmentId,
          sportType: activity.sportType,
          effort,
          activity,
          attempts: 1,
        });
      } else {
        current.attempts += 1;
        if (effort.elapsedSeconds < current.effort.elapsedSeconds) {
          current.effort = effort;
          current.activity = activity;
        }
      }
    }
  }
  return [...bests.values()].sort((a, b) => a.effort.elapsedSeconds - b.effort.elapsedSeconds);
}

export function formatSegmentTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remaining = Math.max(0, Math.round(seconds - minutes * 60));
  return `${minutes}:${String(remaining).padStart(2, '0')}`;
}
