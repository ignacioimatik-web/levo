'use client';

import type { RideActivity, RideDraft } from './types';

const DATABASE_NAME = 'e-nduro-rides';
const DATABASE_VERSION = 1;
const ACTIVITIES_STORE = 'activities';
const DRAFT_STORE = 'active-draft';
const ACTIVE_DRAFT_KEY = 'current';

export function compactActivityForLocalStorage(
  activity: RideActivity,
  maxPoints = 600,
): RideActivity {
  const pointLimit = Math.max(2, maxPoints);
  if (activity.points.length <= pointLimit) return activity;
  const step = (activity.points.length - 1) / (pointLimit - 1);
  return {
    ...activity,
    points: Array.from(
      { length: pointLimit },
      (_, index) => activity.points[Math.round(index * step)],
    ),
  };
}

export function compactRideDraftForLocalStorage(
  draft: RideDraft,
  maxPoints = 2_000,
): RideDraft {
  const pointLimit = Math.max(2, maxPoints);
  if (draft.points.length <= pointLimit) return draft;

  // Keep a detailed recent tail for recovery/navigation, while sampling the
  // older part of a very long ride so the synchronous emergency copy remains
  // small enough for localStorage and cheap enough to write on a phone.
  const recentCount = Math.min(
    Math.max(1, Math.floor(pointLimit / 4)),
    draft.points.length - 1,
  );
  const historicalLimit = pointLimit - recentCount;
  const historical = draft.points.slice(0, -recentCount);
  const recent = draft.points.slice(-recentCount);
  const sampledHistorical = historicalLimit === 1
    ? [historical[0]]
    : Array.from(
        { length: historicalLimit },
        (_, index) => historical[
          Math.round(index * (historical.length - 1) / (historicalLimit - 1))
        ],
      );

  return {
    ...draft,
    points: [...sampledHistorical, ...recent],
  };
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(ACTIVITIES_STORE)) {
        database.createObjectStore(ACTIVITIES_STORE, { keyPath: 'id' });
      }
      if (!database.objectStoreNames.contains(DRAFT_STORE)) {
        database.createObjectStore(DRAFT_STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('No se pudo abrir el diario de rutas.'));
  });
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Falló el diario de rutas.'));
  });
}

function transactionComplete(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(transaction.error ?? new Error('Se canceló el guardado de la ruta.'));
    transaction.onerror = () => reject(transaction.error ?? new Error('Falló el guardado de la ruta.'));
  });
}

export function mergeActivityVersions(
  stored: RideActivity | null | undefined,
  incoming: RideActivity,
): RideActivity {
  if (!stored) return incoming;
  return {
    ...stored,
    ...incoming,
    points: stored.points.length > incoming.points.length ? stored.points : incoming.points,
    weatherSamples: (stored.weatherSamples?.length ?? 0) > (incoming.weatherSamples?.length ?? 0)
      ? stored.weatherSamples
      : incoming.weatherSamples,
    segmentEfforts: (stored.segmentEfforts?.length ?? 0) > (incoming.segmentEfforts?.length ?? 0)
      ? stored.segmentEfforts
      : incoming.segmentEfforts,
  };
}

export function mergeRideDraftVersions(
  durable: RideDraft | null | undefined,
  local: RideDraft | null | undefined,
): RideDraft | null {
  if (!durable) return local ?? null;
  if (!local) return durable;
  if (durable.id !== local.id) {
    return durable.updatedAt >= local.updatedAt ? durable : local;
  }
  if (durable.updatedAt >= local.updatedAt) return durable;

  const durableLastTimestamp = durable.points.at(-1)?.timestamp ?? Number.NEGATIVE_INFINITY;
  const localTail = local.points.filter((point) => point.timestamp > durableLastTimestamp);
  return {
    ...durable,
    ...local,
    points: localTail.length > 0 ? [...durable.points, ...localTail] : durable.points,
  };
}

export async function saveDurableActivity(activity: RideActivity): Promise<void> {
  if (typeof indexedDB === 'undefined') return;
  const database = await openDatabase();
  try {
    const transaction = database.transaction(ACTIVITIES_STORE, 'readwrite');
    const completion = transactionComplete(transaction);
    const store = transaction.objectStore(ACTIVITIES_STORE);
    const existing = await requestResult<RideActivity | undefined>(store.get(activity.id));
    store.put(mergeActivityVersions(existing, activity));
    await completion;
  } finally {
    database.close();
  }
}

export async function listDurableActivities(): Promise<RideActivity[]> {
  if (typeof indexedDB === 'undefined') return [];
  const database = await openDatabase();
  try {
    return await requestResult<RideActivity[]>(
      database.transaction(ACTIVITIES_STORE, 'readonly').objectStore(ACTIVITIES_STORE).getAll(),
    );
  } finally {
    database.close();
  }
}

export async function getDurableActivity(id: string): Promise<RideActivity | null> {
  if (typeof indexedDB === 'undefined') return null;
  const database = await openDatabase();
  try {
    return await requestResult<RideActivity | undefined>(
      database.transaction(ACTIVITIES_STORE, 'readonly').objectStore(ACTIVITIES_STORE).get(id),
    ) ?? null;
  } finally {
    database.close();
  }
}

export async function deleteDurableActivity(id: string): Promise<void> {
  if (typeof indexedDB === 'undefined') return;
  const database = await openDatabase();
  try {
    const transaction = database.transaction(ACTIVITIES_STORE, 'readwrite');
    const completion = transactionComplete(transaction);
    transaction.objectStore(ACTIVITIES_STORE).delete(id);
    await completion;
  } finally {
    database.close();
  }
}

export async function saveDurableRideDraft(draft: RideDraft): Promise<void> {
  if (typeof indexedDB === 'undefined') return;
  const database = await openDatabase();
  try {
    const transaction = database.transaction(DRAFT_STORE, 'readwrite');
    const completion = transactionComplete(transaction);
    transaction.objectStore(DRAFT_STORE).put(draft, ACTIVE_DRAFT_KEY);
    await completion;
  } finally {
    database.close();
  }
}

export async function getDurableRideDraft(): Promise<RideDraft | null> {
  if (typeof indexedDB === 'undefined') return null;
  const database = await openDatabase();
  try {
    return await requestResult<RideDraft | undefined>(
      database.transaction(DRAFT_STORE, 'readonly').objectStore(DRAFT_STORE).get(ACTIVE_DRAFT_KEY),
    ) ?? null;
  } finally {
    database.close();
  }
}

export async function clearDurableRideDraft(): Promise<void> {
  if (typeof indexedDB === 'undefined') return;
  const database = await openDatabase();
  try {
    const transaction = database.transaction(DRAFT_STORE, 'readwrite');
    const completion = transactionComplete(transaction);
    transaction.objectStore(DRAFT_STORE).delete(ACTIVE_DRAFT_KEY);
    await completion;
  } finally {
    database.close();
  }
}

export async function requestPersistentRideStorage(): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.storage?.persist) return false;
  try {
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}
