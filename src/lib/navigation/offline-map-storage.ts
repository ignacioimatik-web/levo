'use client';

import type { OfflineTrailCollection } from './offline-map-data';
import type { OfflineMapSummary } from './offline-map-data';

const DATABASE_NAME = 'e-nduro-offline';
const STORE_NAME = 'route-maps';
const DATABASE_VERSION = 1;

export type OfflineMapPackage = {
  version?: 2;
  routeId: string;
  routeName: string;
  trails: OfflineTrailCollection;
  summary?: OfflineMapSummary;
  fetchedAt: string;
  attribution: string;
  sampleRadiusM: number;
};

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: 'routeId' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('No se pudo abrir el almacenamiento offline.'));
  });
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Falló el almacenamiento offline.'));
  });
}

export async function saveOfflineMapPackage(mapPackage: OfflineMapPackage): Promise<void> {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    await requestResult(transaction.objectStore(STORE_NAME).put(mapPackage));
  } finally {
    database.close();
  }
}

export async function getOfflineMapPackage(routeId: string): Promise<OfflineMapPackage | null> {
  if (typeof indexedDB === 'undefined') return null;
  const database = await openDatabase();
  try {
    return await requestResult<OfflineMapPackage | undefined>(
      database.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(routeId),
    ) ?? null;
  } finally {
    database.close();
  }
}

export async function listOfflineMapPackages(): Promise<OfflineMapPackage[]> {
  if (typeof indexedDB === 'undefined') return [];
  const database = await openDatabase();
  try {
    return await requestResult<OfflineMapPackage[]>(
      database.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).getAll(),
    );
  } finally {
    database.close();
  }
}

export async function deleteOfflineMapPackage(routeId: string): Promise<void> {
  if (typeof indexedDB === 'undefined') return;
  const database = await openDatabase();
  try {
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    await requestResult(transaction.objectStore(STORE_NAME).delete(routeId));
  } finally {
    database.close();
  }
}
