import type { RideActivity } from '@/lib/activities/types';
import type {
  GhostComparison, NavigationProgress, PlannedRoute, PlannedRoutePoint,
} from './types';

const MAX_REPEAT_ROUTE_POINTS = 2_000;

function downsample<T>(points: T[], maxPoints: number): T[] {
  if (points.length <= maxPoints) return points;
  const step = (points.length - 1) / (maxPoints - 1);
  return Array.from({ length: maxPoints }, (_, index) => points[Math.round(index * step)]);
}

export function plannedRouteFromActivity(activity: RideActivity): PlannedRoute {
  let elapsedSeconds = 0;
  const timedPoints: PlannedRoutePoint[] = activity.points.map((point, index) => {
    if (index > 0) {
      const segmentSeconds = Math.max(0, (point.timestamp - activity.points[index - 1].timestamp) / 1000);
      if (segmentSeconds <= 120) elapsedSeconds += segmentSeconds;
    }
    return {
      latitude: point.latitude,
      longitude: point.longitude,
      elevation: point.elevation,
      referenceElapsedSeconds: elapsedSeconds,
    };
  });
  const sampled = downsample(timedPoints, MAX_REPEAT_ROUTE_POINTS);

  return {
    id: `repeat-${activity.id}`,
    name: activity.title,
    trackIds: [],
    distanceKm: activity.distanceM / 1000,
    elevationGainM: activity.elevationGainM,
    estimatedTimeMin: Math.max(1, Math.round(activity.durationSeconds / 60)),
    difficulty: 'reto personal',
    warnings: ['Compara tu ritmo con prudencia: el estado del terreno, la meteorología y el tráfico cambian cada día.'],
    points: sampled,
    createdAt: new Date().toISOString(),
    reference: {
      activityId: activity.id,
      title: activity.title,
      durationSeconds: activity.durationSeconds,
      startedAt: activity.startedAt,
    },
  };
}

export function calculateGhostComparison(
  route: PlannedRoute,
  navigation: NavigationProgress | null,
  elapsedSeconds: number,
): GhostComparison | null {
  if (!route.reference || !navigation || navigation.offRouteM > 100) return null;
  if (navigation.progressPercent < 1 || navigation.completedM < 30) return null;

  const point = route.points[navigation.nearestIndex];
  const referenceSeconds = point?.referenceElapsedSeconds
    ?? route.reference.durationSeconds * navigation.progressPercent / 100;
  if (referenceSeconds <= 0) return null;

  const progressRatio = navigation.progressPercent / 100;
  return {
    referenceSeconds,
    deltaSeconds: elapsedSeconds - referenceSeconds,
    projectedFinishSeconds: progressRatio >= 0.1
      ? Math.round(elapsedSeconds / progressRatio)
      : null,
  };
}

export function calculateSecuredNavigation(
  navigation: NavigationProgress | null,
  completedFloorM: number,
  fallbackTotalM: number,
): { completedM: number; remainingM: number; progressPercent: number } {
  const totalM = navigation
    ? navigation.completedM + navigation.remainingM
    : Math.max(0, fallbackTotalM);
  const completedM = Math.min(totalM, Math.max(navigation?.completedM ?? 0, completedFloorM));
  return {
    completedM,
    remainingM: Math.max(0, totalM - completedM),
    progressPercent: totalM > 0 ? completedM / totalM * 100 : 0,
  };
}
