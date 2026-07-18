'use client';

import type { ProgressGoals } from './types';

const STORAGE_KEY = 'e-nduro.progress-goals.v1';

export const DEFAULT_GOALS: ProgressGoals = {
  weeklyDistanceKm: 60,
  weeklyElevationM: 1_500,
  weeklyRides: 2,
};

export function getProgressGoals(): ProgressGoals {
  if (typeof window === 'undefined') return DEFAULT_GOALS;
  try {
    return { ...DEFAULT_GOALS, ...JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') };
  } catch {
    return DEFAULT_GOALS;
  }
}

export function saveProgressGoals(goals: ProgressGoals): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(goals));
}
