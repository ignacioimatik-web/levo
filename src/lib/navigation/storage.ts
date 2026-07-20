'use client';

import type { PlannedRoute } from './types';

const STORAGE_KEY = 'e-nduro.planned-routes.v1';

type StoredRoute = Omit<PlannedRoute, 'points'> & {
  p: Array<[number, number, number | null, number?]>;
};

function serialize(route: PlannedRoute): StoredRoute {
  const { points, ...metadata } = route;
  return {
    ...metadata,
    p: points.map((point) => [
      point.latitude,
      point.longitude,
      point.elevation,
      point.referenceElapsedSeconds,
    ]),
  };
}

function deserialize(value: StoredRoute | PlannedRoute): PlannedRoute {
  if ('p' in value) {
    const { p, ...metadata } = value;
    return {
      ...metadata,
      points: p.map(([latitude, longitude, elevation, referenceElapsedSeconds]) => ({
        latitude,
        longitude,
        elevation,
        referenceElapsedSeconds,
      })),
    };
  }
  return value;
}

export function getPlannedRoutes(): PlannedRoute[] {
  if (typeof window === 'undefined') return [];
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') as Array<StoredRoute | PlannedRoute>;
    return stored.map(deserialize);
  } catch {
    return [];
  }
}

export function getPlannedRoute(id: string): PlannedRoute | null {
  return getPlannedRoutes().find((route) => route.id === id) ?? null;
}

export function savePlannedRoute(route: PlannedRoute): boolean {
  if (typeof window === 'undefined') return false;
  const routes = [
    route,
    ...getPlannedRoutes().filter((item) => item.id !== route.id),
  ];
  let retained = routes.slice(0, 30);
  while (retained.length > 0) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(retained.map(serialize)));
      return true;
    } catch {
      retained = retained.slice(0, -1);
    }
  }
  return false;
}

export function deletePlannedRoute(id: string): void {
  if (typeof window === 'undefined') return;
  const retained = getPlannedRoutes().filter((route) => route.id !== id);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(retained.map(serialize)));
  } catch {
    // If storage is temporarily unavailable, preserve the existing library.
  }
}
