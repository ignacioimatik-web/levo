'use client';

import type { RideActivity, RideDraft } from './types';
import { matchCompetitiveSegments } from '@/lib/segments/matcher';
import {
  compactActivityForLocalStorage,
  clearDurableRideDraft, deleteDurableActivity, getDurableActivity, getDurableRideDraft,
  listDurableActivities, mergeActivityVersions, saveDurableActivity, saveDurableRideDraft,
} from './durable-storage';

const STORAGE_KEY = 'e-nduro.activities.v1';
const DURABLE_MIGRATION_KEY = 'e-nduro.activities.idb-migrated.v1';
const DRAFT_KEY = 'e-nduro.active-ride.v1';
const PENDING_DELETES_KEY = 'e-nduro.activity-deletes.v1';
export const ACTIVITIES_CHANGED_EVENT = 'e-nduro:activities-changed';
let lastDurableDraftSaveAt = 0;
const pendingDurableDeletes = new Set<string>();

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
    let migrated = false;
    const activities = parsed.map((activity) => {
      if (Array.isArray(activity.segmentEfforts)) return activity;
      migrated = true;
      return {
        ...activity,
        segmentEfforts: matchCompetitiveSegments(activity.points ?? []),
      };
    });
    if (migrated) localStorage.setItem(STORAGE_KEY, JSON.stringify(activities));
    return activities.sort((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt));
  } catch {
    return [];
  }
}

function persist(activities: RideActivity[], notify = true): void {
  const compact = activities.map((activity) => compactActivityForLocalStorage(activity));
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(compact));
  } catch {
    const summaries = compact.slice(0, 100).map((activity) => ({
      ...activity,
      points: activity.points.length > 1
        ? [activity.points[0], activity.points.at(-1)!]
        : activity.points,
      weatherSamples: [],
      segmentEfforts: [],
    }));
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(summaries));
    } catch {
      // IndexedDB remains the authoritative local copy when storage quota is exhausted.
    }
  }
  if (notify) window.dispatchEvent(new Event(ACTIVITIES_CHANGED_EVENT));
}

export async function saveActivity(activity: RideActivity): Promise<void> {
  pendingDurableDeletes.delete(activity.id);
  const activities = getActivities();
  const index = activities.findIndex((item) => item.id === activity.id);
  if (index >= 0) activities[index] = activity;
  else activities.unshift(activity);
  persist(activities);
  try {
    await saveDurableActivity(activity);
  } catch {
    // The synchronous local copy still makes the activity immediately available.
  }
}

export function deleteActivity(id: string): void {
  pendingDurableDeletes.add(id);
  persist(getActivities().filter((activity) => activity.id !== id));
  void deleteDurableActivity(id)
    .catch(() => undefined)
    .finally(() => {
      pendingDurableDeletes.delete(id);
      window.dispatchEvent(new Event(ACTIVITIES_CHANGED_EVENT));
    });
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
  if (activity) void saveActivity({ ...activity, ...patch });
}

export function getActivity(id: string): RideActivity | null {
  return getActivities().find((activity) => activity.id === id) ?? null;
}

export async function getActivitiesDurable(): Promise<RideActivity[]> {
  const local = getActivities();
  try {
    if (local.length > 0 && localStorage.getItem(DURABLE_MIGRATION_KEY) !== 'done') {
      await Promise.all(local.map((activity) => saveDurableActivity(activity)));
      persist(local, false);
      try {
        localStorage.setItem(DURABLE_MIGRATION_KEY, 'done');
      } catch {
        // Migration already completed even if the small marker cannot be persisted.
      }
    }
    const durable = await listDurableActivities();
    const merged = new Map(local.map((activity) => [activity.id, activity]));
    for (const activity of durable) {
      if (pendingDurableDeletes.has(activity.id)) continue;
      merged.set(activity.id, mergeActivityVersions(activity, merged.get(activity.id) ?? activity));
    }
    return [...merged.values()]
      .filter((activity) => !pendingDurableDeletes.has(activity.id))
      .sort((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt));
  } catch {
    return local;
  }
}

export async function getActivityDurable(id: string): Promise<RideActivity | null> {
  if (pendingDurableDeletes.has(id)) return null;
  const local = getActivity(id);
  try {
    const durable = await getDurableActivity(id);
    return durable ? mergeActivityVersions(durable, local ?? durable) : local;
  } catch {
    return local;
  }
}

export function saveRideDraft(draft: RideDraft, forceDurable = false): void {
  if (typeof window === 'undefined') return;
  if (forceDurable || draft.updatedAt - lastDurableDraftSaveAt >= 10_000) {
    lastDurableDraftSaveAt = draft.updatedAt;
    void saveDurableRideDraft(draft).catch(() => undefined);
  }
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

export async function getRideDraftDurable(): Promise<RideDraft | null> {
  const local = getRideDraft();
  try {
    const durable = await getDurableRideDraft();
    if (!durable) return local;
    if (!local || durable.updatedAt > local.updatedAt) return durable;
    return local;
  } catch {
    return local;
  }
}

export function clearRideDraft(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(DRAFT_KEY);
  lastDurableDraftSaveAt = 0;
  void clearDurableRideDraft().catch(() => undefined);
}
