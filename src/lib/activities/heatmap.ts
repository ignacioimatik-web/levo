import type { RideActivity, RidePoint, SportType } from './types';

export type HeatmapSportFilter = SportType | 'all';
export type HeatmapPeriod = '30d' | '90d' | 'year' | 'all';

export interface HeatmapSummary {
  rides: number;
  distanceM: number;
  elevationM: number;
  exploredCells: number;
  mostRepeatedRides: number;
  mostRepeatedCenter: { latitude: number; longitude: number } | null;
}

const CELL_SIZE_DEG = 0.005;

function periodStart(period: HeatmapPeriod, nowMs: number): number {
  if (period === 'all') return Number.NEGATIVE_INFINITY;
  if (period === 'year') {
    const date = new Date(nowMs);
    return new Date(date.getFullYear(), 0, 1).getTime();
  }
  return nowMs - (period === '30d' ? 30 : 90) * 86_400_000;
}

export function filterHeatmapActivities(
  activities: RideActivity[],
  sport: HeatmapSportFilter,
  period: HeatmapPeriod,
  nowMs: number,
): RideActivity[] {
  const start = periodStart(period, nowMs);
  return activities.filter((activity) => (
    activity.points.length >= 2
    && (sport === 'all' || activity.sportType === sport)
    && Date.parse(activity.startedAt) >= start
  ));
}

function cellFor(point: RidePoint): { key: string; latitude: number; longitude: number } {
  const latIndex = Math.floor(point.latitude / CELL_SIZE_DEG);
  const lngIndex = Math.floor(point.longitude / CELL_SIZE_DEG);
  return {
    key: `${latIndex}:${lngIndex}`,
    latitude: (latIndex + 0.5) * CELL_SIZE_DEG,
    longitude: (lngIndex + 0.5) * CELL_SIZE_DEG,
  };
}

export function summarizeHeatmap(activities: RideActivity[]): HeatmapSummary {
  const cells = new Map<string, {
    latitude: number;
    longitude: number;
    activityIds: Set<string>;
  }>();

  for (const activity of activities) {
    const visited = new Set<string>();
    for (const point of activity.points) {
      const cell = cellFor(point);
      if (visited.has(cell.key)) continue;
      visited.add(cell.key);
      const existing = cells.get(cell.key) ?? {
        latitude: cell.latitude,
        longitude: cell.longitude,
        activityIds: new Set<string>(),
      };
      existing.activityIds.add(activity.id);
      cells.set(cell.key, existing);
    }
  }

  const mostRepeated = [...cells.values()].sort(
    (a, b) => b.activityIds.size - a.activityIds.size,
  )[0];

  return {
    rides: activities.length,
    distanceM: activities.reduce((sum, activity) => sum + activity.distanceM, 0),
    elevationM: activities.reduce((sum, activity) => sum + activity.elevationGainM, 0),
    exploredCells: cells.size,
    mostRepeatedRides: mostRepeated?.activityIds.size ?? 0,
    mostRepeatedCenter: mostRepeated
      ? { latitude: mostRepeated.latitude, longitude: mostRepeated.longitude }
      : null,
  };
}

export function downsampleRoute<T>(points: T[], maxPoints = 600): T[] {
  if (points.length <= maxPoints) return points;
  const step = (points.length - 1) / (maxPoints - 1);
  return Array.from({ length: maxPoints }, (_, index) => points[Math.round(index * step)]);
}
