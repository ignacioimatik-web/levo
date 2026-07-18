'use client';

import type { MaintenanceCategory, MaintenanceItem } from './types';

const STORAGE_KEY = 'e-nduro.maintenance.v1';
export const MAINTENANCE_CHANGED_EVENT = 'e-nduro:maintenance-changed';

const DEFAULT_ITEMS: Array<{
  id: string;
  name: string;
  category: MaintenanceCategory;
  intervalKm: number;
}> = [
  { id: 'chain', name: 'Cadena y lubricación', category: 'drivetrain', intervalKm: 500 },
  { id: 'brake-pads', name: 'Pastillas de freno', category: 'brakes', intervalKm: 400 },
  { id: 'suspension', name: 'Suspensiones', category: 'suspension', intervalKm: 1_000 },
  { id: 'tires', name: 'Cubiertas y presión', category: 'tires', intervalKm: 300 },
  { id: 'motor', name: 'Motor e-bike', category: 'motor', intervalKm: 2_000 },
];

function readStored(): MaintenanceItem[] | null {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as MaintenanceItem[] | null;
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function persist(items: MaintenanceItem[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  window.dispatchEvent(new Event(MAINTENANCE_CHANGED_EVENT));
}

export function getMaintenanceItems(odometerKm = 0): MaintenanceItem[] {
  if (typeof window === 'undefined') return [];
  const stored = readStored();
  if (stored) return stored;
  const now = new Date().toISOString();
  const defaults = DEFAULT_ITEMS.map((item) => ({
    ...item,
    lastServiceOdometerKm: odometerKm,
    lastServiceAt: null,
    serviceCount: 0,
    updatedAt: now,
    syncStatus: 'local' as const,
  }));
  persist(defaults);
  return defaults;
}

export function saveMaintenanceItem(item: MaintenanceItem): void {
  const items = getMaintenanceItems();
  const index = items.findIndex((current) => current.id === item.id);
  if (index >= 0) items[index] = item;
  else items.push(item);
  persist(items);
}

export function saveMaintenanceItems(items: MaintenanceItem[]): void {
  if (typeof window === 'undefined') return;
  persist(items);
}

export function deleteMaintenanceItem(id: string): void {
  persist(getMaintenanceItems().filter((item) => item.id !== id));
}
