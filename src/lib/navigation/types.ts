export interface PlannedRoutePoint {
  latitude: number;
  longitude: number;
  elevation: number | null;
  referenceElapsedSeconds?: number;
}

export type RoutePlanningMode = 'mtb' | 'ebike' | 'manual';

export interface PlannedRoute {
  id: string;
  name: string;
  trackIds: string[];
  distanceKm: number;
  elevationGainM: number;
  estimatedTimeMin: number;
  difficulty: string;
  warnings: string[];
  points: PlannedRoutePoint[];
  controlPoints?: PlannedRoutePoint[];
  createdAt: string;
  routingMode?: RoutePlanningMode;
  reference?: {
    activityId: string;
    title: string;
    durationSeconds: number;
    startedAt: string;
  };
}

export interface NavigationProgress {
  nearestIndex: number;
  offRouteM: number;
  rejoinLatitude: number;
  rejoinLongitude: number;
  bearingToRejoinDeg: number;
  completedM: number;
  remainingM: number;
  remainingGainM: number;
  progressPercent: number;
}

export interface GhostComparison {
  referenceSeconds: number;
  deltaSeconds: number;
  projectedFinishSeconds: number | null;
}
