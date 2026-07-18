'use client';

import type { RideActivity, RideDraft } from './types';

const STORAGE_KEY = 'e-nduro.activities.v1';
const DRAFT_KEY = 'e-nduro.active-ride.v1';
const PENDING_DELETES_KEY = 'e-nduro.activity-deletes.v1';
export const ACTIVITIES_CHANGED_EVENT = 'e-nduro:activities-changed';

export interface PendingActivityDelete {
  clientId: string;
  remoteId: string;
  remoteUserId?: string;
  title: string;
  queuedAt: string;
}

export function getActivities(): RideActivity[] {
  if (typeof window === 'undefined') return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') as RideActivity[];
    return parsed.sort((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt));
  } catch {
    return [];
  }
}

function persist(activities: RideActivity[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(activities));
  window.dispatchEvent(new Event(ACTIVITIES_CHANGED_EVENT));
}

export function saveActivity(activity: RideActivity): void {
  const activities = getActivities();
  const index = activities.findIndex((item) => item.id === activity.id);
  if (index >= 0) activities[index] = activity;
  else activities.unshift(activity);
  persist(activities);
}

export function deleteActivity(id: string): void {
  persist(getActivities().filter((activity) => activity.id !== id));
}

export function getPendingActivityDeletes(): PendingActivityDelete[] {
  if (typeof window === 'undefined') return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(PENDING_DELETES_KEY) ?? '[]') as PendingActivityDelete[];
    return parsed.filter((item) => item.clientId && item.remoteId);
  } catch {
    return [];
  }
}

function persistPendingActivityDeletes(items: PendingActivityDelete[]): void {
  localStorage.setItem(PENDING_DELETES_KEY, JSON.stringify(items));
  window.dispatchEvent(new Event(ACTIVITIES_CHANGED_EVENT));
}

export function queueActivityDelete(activity: RideActivity): void {
  if (!activity.remoteId) return;
  const pending = getPendingActivityDeletes().filter((item) => item.clientId !== activity.id);
  pending.push({
    clientId: activity.id,
    remoteId: activity.remoteId,
    remoteUserId: activity.remoteUserId,
    title: activity.title,
    queuedAt: new Date().toISOString(),
  });
  persistPendingActivityDeletes(pending);
}

export function removePendingActivityDelete(clientId: string): void {
  persistPendingActivityDeletes(
    getPendingActivityDeletes().filter((item) => item.clientId !== clientId),
  );
}

export function updateActivity(id: string, patch: Partial<RideActivity>): void {
  const activity = getActivities().find((item) => item.id === id);
  if (activity) saveActivity({ ...activity, ...patch });
}

export function getActivity(id: string): RideActivity | null {
  return getActivities().find((activity) => activity.id === id) ?? null;
}

export function saveRideDraft(draft: RideDraft): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  } catch {
    // On very long rides, retain a progressively downsampled recovery trace
    // instead of losing the whole draft when the browser quota is exhausted.
    let recoveryPoints = draft.points;
    while (recoveryPoints.length > 2_000) {
      recoveryPoints = recoveryPoints.filter((_, index) => index % 2 === 0 || index === recoveryPoints.length - 1);
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify({ ...draft, points: recoveryPoints }));
        return;
      } catch {
        // Keep reducing until it fits or reaches the safety floor.
      }
    }
  }
}

export function getRideDraft(): RideDraft | null {
  if (typeof window === 'undefined') return null;
  try {
    const parsed = JSON.parse(localStorage.getItem(DRAFT_KEY) ?? 'null') as RideDraft | null;
    if (!parsed?.id || !Array.isArray(parsed.points)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearRideDraft(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(DRAFT_KEY);
}
