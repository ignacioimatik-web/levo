import { haversineKm } from '../gpx-utils.ts';
import type { NavigationProgress, PlannedRoutePoint } from './types';

export type TurnDirection =
  | 'continue'
  | 'slight-left'
  | 'left'
  | 'sharp-left'
  | 'slight-right'
  | 'right'
  | 'sharp-right'
  | 'uturn'
  | 'arrive';

export interface TurnInstruction {
  direction: TurnDirection;
  distanceM: number;
  turnIndex: number;
  angleDeg: number;
  label: string;
}

function distanceM(a: PlannedRoutePoint, b: PlannedRoutePoint): number {
  return haversineKm(a.latitude, a.longitude, b.latitude, b.longitude) * 1_000;
}

function bearing(a: PlannedRoutePoint, b: PlannedRoutePoint): number {
  const lat1 = a.latitude * Math.PI / 180;
  const lat2 = b.latitude * Math.PI / 180;
  const deltaLng = (b.longitude - a.longitude) * Math.PI / 180;
  const y = Math.sin(deltaLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2)
    - Math.sin(lat1) * Math.cos(lat2) * Math.cos(deltaLng);
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}

function signedAngle(from: number, to: number): number {
  return ((to - from + 540) % 360) - 180;
}

function directionForAngle(angle: number): TurnDirection {
  const absolute = Math.abs(angle);
  if (absolute >= 150) return 'uturn';
  if (angle <= -100) return 'sharp-left';
  if (angle <= -45) return 'left';
  if (angle <= -28) return 'slight-left';
  if (angle >= 100) return 'sharp-right';
  if (angle >= 45) return 'right';
  return 'slight-right';
}

function labelForDirection(direction: TurnDirection): string {
  const labels: Record<TurnDirection, string> = {
    continue: 'Sigue el track',
    'slight-left': 'Mantente a la izquierda',
    left: 'Gira a la izquierda',
    'sharp-left': 'Giro cerrado a la izquierda',
    'slight-right': 'Mantente a la derecha',
    right: 'Gira a la derecha',
    'sharp-right': 'Giro cerrado a la derecha',
    uturn: 'Cambio de sentido',
    arrive: 'Llegada',
  };
  return labels[direction];
}

function spacedIndex(
  route: PlannedRoutePoint[],
  origin: number,
  direction: -1 | 1,
  targetDistanceM = 25,
): number {
  let index = origin;
  let traversed = 0;
  while (index + direction >= 0 && index + direction < route.length && traversed < targetDistanceM) {
    traversed += distanceM(route[index], route[index + direction]);
    index += direction;
  }
  return index;
}

export function calculateUpcomingTurn(
  route: PlannedRoutePoint[],
  navigation: NavigationProgress | null,
  maxSearchM = 3_000,
): TurnInstruction | null {
  if (!navigation || route.length < 2) return null;
  if (navigation.remainingM <= 60 || navigation.nearestIndex >= route.length - 2) {
    return {
      direction: 'arrive',
      distanceM: Math.max(0, navigation.remainingM),
      turnIndex: route.length - 1,
      angleDeg: 0,
      label: labelForDirection('arrive'),
    };
  }

  let alongRouteM = 0;
  let lastEvaluatedM = -Infinity;
  for (let index = navigation.nearestIndex + 1; index < route.length - 1; index += 1) {
    alongRouteM += distanceM(route[index - 1], route[index]);
    if (alongRouteM > maxSearchM) break;
    if (alongRouteM - lastEvaluatedM < 18) continue;
    lastEvaluatedM = alongRouteM;

    const before = spacedIndex(route, index, -1);
    const after = spacedIndex(route, index, 1);
    if (before === index || after === index) continue;
    const angle = signedAngle(bearing(route[before], route[index]), bearing(route[index], route[after]));
    if (Math.abs(angle) < 28) continue;
    const direction = directionForAngle(angle);
    return {
      direction,
      distanceM: Math.max(0, alongRouteM),
      turnIndex: index,
      angleDeg: angle,
      label: labelForDirection(direction),
    };
  }

  return {
    direction: 'continue',
    distanceM: navigation.remainingM,
    turnIndex: route.length - 1,
    angleDeg: 0,
    label: labelForDirection('continue'),
  };
}

export function formatTurnDistance(distance: number): string {
  if (distance < 1_000) return `${Math.max(0, Math.round(distance / 10) * 10)} m`;
  return `${(distance / 1_000).toFixed(distance < 10_000 ? 1 : 0)} km`;
}
