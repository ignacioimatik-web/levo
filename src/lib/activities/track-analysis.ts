import { assessRidePoint, calculateRideMetrics } from './geo.ts';
import type { RidePoint } from './types';

const MOVING_SPEED_KMH = 2.5;
const SPLIT_DISTANCE_M = 1_000;

interface TrackInterval {
  distanceM: number;
  movingSeconds: number;
  elevationDeltaM: number | null;
}

export interface RideSplit {
  index: number;
  distanceM: number;
  movingSeconds: number;
  averageSpeedKmh: number;
  elevationGainM: number;
  elevationLossM: number;
  complete: boolean;
}

export interface TerrainSummary {
  climbingDistanceM: number;
  descendingDistanceM: number;
  rollingDistanceM: number;
  classifiedDistanceM: number;
  elevationLossM: number;
  steepestClimbPercent: number | null;
  steepestDescentPercent: number | null;
}

export interface ActivityTrackAnalysis {
  splits: RideSplit[];
  terrain: TerrainSummary;
  fastestFullSplitIndex: number | null;
}

function trackIntervals(points: RidePoint[]): TrackInterval[] {
  const intervals: TrackInterval[] = [];
  const accepted: RidePoint[] = [];
  for (const current of points) {
    const previous = accepted.at(-1) ?? null;
    const assessment = assessRidePoint(previous, current);
    if (!assessment.accepted) continue;
    accepted.push(current);
    if (!previous) continue;
    const seconds = (current.timestamp - previous.timestamp) / 1000;
    if (seconds <= 0 || seconds > 120 || assessment.distanceM <= 0) continue;
    const deviceSpeedKmh = current.speed != null && current.speed >= 0 ? current.speed * 3.6 : 0;
    const speedKmh = Math.max(deviceSpeedKmh, assessment.speedKmh);
    const rawElevationDelta = previous.elevation != null && current.elevation != null
      ? current.elevation - previous.elevation
      : null;
    intervals.push({
      distanceM: assessment.distanceM,
      movingSeconds: speedKmh > MOVING_SPEED_KMH ? seconds : 0,
      elevationDeltaM: rawElevationDelta != null && Math.abs(rawElevationDelta) <= 30
        ? rawElevationDelta
        : null,
    });
  }
  return intervals;
}

function finishSplit(split: Omit<RideSplit, 'averageSpeedKmh' | 'complete'>): RideSplit {
  return {
    ...split,
    averageSpeedKmh: split.movingSeconds > 0
      ? split.distanceM / split.movingSeconds * 3.6
      : 0,
    complete: split.distanceM >= SPLIT_DISTANCE_M - 1,
  };
}

export function calculateRideSplits(points: RidePoint[]): RideSplit[] {
  const splits: RideSplit[] = [];
  let current = {
    index: 1,
    distanceM: 0,
    movingSeconds: 0,
    elevationGainM: 0,
    elevationLossM: 0,
  };

  for (const interval of trackIntervals(points)) {
    let remainingDistanceM = interval.distanceM;
    while (remainingDistanceM > 0) {
      const capacityM = SPLIT_DISTANCE_M - current.distanceM;
      const allocatedM = Math.min(capacityM, remainingDistanceM);
      const ratio = allocatedM / interval.distanceM;
      current.distanceM += allocatedM;
      current.movingSeconds += interval.movingSeconds * ratio;
      if (interval.elevationDeltaM != null) {
        const allocatedElevationM = interval.elevationDeltaM * ratio;
        if (allocatedElevationM > 0) current.elevationGainM += allocatedElevationM;
        else current.elevationLossM += Math.abs(allocatedElevationM);
      }
      remainingDistanceM -= allocatedM;
      if (current.distanceM >= SPLIT_DISTANCE_M - 0.001) {
        splits.push(finishSplit(current));
        current = {
          index: current.index + 1,
          distanceM: 0,
          movingSeconds: 0,
          elevationGainM: 0,
          elevationLossM: 0,
        };
      }
    }
  }

  if (current.distanceM >= 100) splits.push(finishSplit(current));
  return splits;
}

export function calculateTerrainSummary(points: RidePoint[]): TerrainSummary {
  const intervals = trackIntervals(points);
  let climbingDistanceM = 0;
  let descendingDistanceM = 0;
  let rollingDistanceM = 0;
  let classifiedDistanceM = 0;
  let windowDistanceM = 0;
  let windowElevationM = 0;
  const window: Array<{ distanceM: number; elevationM: number }> = [];
  let steepestClimbPercent: number | null = null;
  let steepestDescentPercent: number | null = null;

  for (const interval of intervals) {
    if (interval.elevationDeltaM == null || interval.distanceM < 2) continue;
    classifiedDistanceM += interval.distanceM;
    const grade = interval.elevationDeltaM / interval.distanceM * 100;
    if (grade >= 2) climbingDistanceM += interval.distanceM;
    else if (grade <= -2) descendingDistanceM += interval.distanceM;
    else rollingDistanceM += interval.distanceM;

    window.push({ distanceM: interval.distanceM, elevationM: interval.elevationDeltaM });
    windowDistanceM += interval.distanceM;
    windowElevationM += interval.elevationDeltaM;
    while (window.length > 1 && windowDistanceM - window[0].distanceM >= 100) {
      const removed = window.shift()!;
      windowDistanceM -= removed.distanceM;
      windowElevationM -= removed.elevationM;
    }
    if (windowDistanceM >= 100) {
      const sustainedGrade = windowElevationM / windowDistanceM * 100;
      steepestClimbPercent = Math.max(steepestClimbPercent ?? 0, sustainedGrade);
      steepestDescentPercent = Math.min(steepestDescentPercent ?? 0, sustainedGrade);
    }
  }

  const invertedElevationPoints = points.map((point) => ({
    ...point,
    elevation: point.elevation == null ? null : -point.elevation,
  }));
  const elevationLossM = calculateRideMetrics(invertedElevationPoints).elevationGainM;

  return {
    climbingDistanceM,
    descendingDistanceM,
    rollingDistanceM,
    classifiedDistanceM,
    elevationLossM,
    steepestClimbPercent: steepestClimbPercent != null && steepestClimbPercent > 0
      ? steepestClimbPercent
      : null,
    steepestDescentPercent: steepestDescentPercent != null && steepestDescentPercent < 0
      ? steepestDescentPercent
      : null,
  };
}

export function analyzeActivityTrack(points: RidePoint[]): ActivityTrackAnalysis {
  const splits = calculateRideSplits(points);
  const fullSplits = splits.filter((split) => split.complete && split.movingSeconds > 0);
  const fastest = fullSplits.reduce<RideSplit | null>(
    (best, split) => !best || split.averageSpeedKmh > best.averageSpeedKmh ? split : best,
    null,
  );
  return {
    splits,
    terrain: calculateTerrainSummary(points),
    fastestFullSplitIndex: fastest?.index ?? null,
  };
}
