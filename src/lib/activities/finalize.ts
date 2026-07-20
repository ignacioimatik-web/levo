import type { RidePoint } from './types';

export function completeRidePointsForSave(
  points: RidePoint[],
  lastAcceptedPoint: RidePoint | null,
): RidePoint[] {
  if (!lastAcceptedPoint) return points;
  const persistedLastPoint = points.at(-1);
  if (persistedLastPoint && persistedLastPoint.timestamp >= lastAcceptedPoint.timestamp) return points;
  return [...points, lastAcceptedPoint];
}
