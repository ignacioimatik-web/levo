'use client';

import { createClient } from '@/lib/supabase/browser';
import {
  getMaintenanceItems, saveMaintenanceItem, saveMaintenanceItems,
} from './storage';
import type { MaintenanceCategory, MaintenanceItem } from './types';

interface MaintenanceRow {
  id: string;
  user_id: string;
  client_id: string;
  name: string;
  category: MaintenanceCategory;
  interval_km: number;
  last_service_odometer_km: number;
  last_service_at: string | null;
  service_count: number;
  updated_at: string;
}

function fromRow(row: MaintenanceRow): MaintenanceItem {
  return {
    id: row.client_id,
    remoteId: row.id,
    name: row.name,
    category: row.category,
    intervalKm: Number(row.interval_km),
    lastServiceOdometerKm: Number(row.last_service_odometer_km),
    lastServiceAt: row.last_service_at,
    serviceCount: row.service_count,
    updatedAt: row.updated_at,
    syncStatus: 'synced',
  };
}

function toRow(item: MaintenanceItem, userId: string) {
  return {
    user_id: userId,
    client_id: item.id,
    name: item.name,
    category: item.category,
    interval_km: item.intervalKm,
    last_service_odometer_km: item.lastServiceOdometerKm,
    last_service_at: item.lastServiceAt,
    service_count: item.serviceCount,
    updated_at: item.updatedAt,
  };
}

export async function reconcileMaintenance(odometerKm: number): Promise<'synced' | 'local' | 'error'> {
  const localItems = getMaintenanceItems(odometerKm);
  const supabase = createClient();
  if (!supabase || !navigator.onLine) return 'local';
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return 'local';

  const { data, error } = await supabase
    .from('maintenance_items')
    .select('id,user_id,client_id,name,category,interval_km,last_service_odometer_km,last_service_at,service_count,updated_at')
    .eq('user_id', user.id);
  if (error) return 'error';

  const remoteRows = (data ?? []) as MaintenanceRow[];
  const remoteByClientId = new Map(remoteRows.map((row) => [row.client_id, row]));
  const pending: MaintenanceItem[] = [];
  const merged = localItems.map((local) => {
    const remote = remoteByClientId.get(local.id);
    if (!remote) {
      pending.push(local);
      return { ...local, syncStatus: 'syncing' as const };
    }
    remoteByClientId.delete(local.id);
    if (Date.parse(local.updatedAt) > Date.parse(remote.updated_at)) {
      pending.push(local);
      return { ...local, remoteId: remote.id, syncStatus: 'syncing' as const };
    }
    return fromRow(remote);
  });
  merged.push(...[...remoteByClientId.values()].map(fromRow));
  saveMaintenanceItems(merged);

  if (pending.length === 0) return 'synced';
  const { data: savedRows, error: syncError } = await supabase
    .from('maintenance_items')
    .upsert(pending.map((item) => toRow(item, user.id)), { onConflict: 'user_id,client_id' })
    .select('id,user_id,client_id,name,category,interval_km,last_service_odometer_km,last_service_at,service_count,updated_at');
  if (syncError || !savedRows) {
    for (const item of pending) saveMaintenanceItem({ ...item, syncStatus: 'error' });
    return 'error';
  }
  const savedByClientId = new Map((savedRows as MaintenanceRow[]).map((row) => [row.client_id, row]));
  saveMaintenanceItems(getMaintenanceItems().map((item) => {
    const saved = savedByClientId.get(item.id);
    return saved ? fromRow(saved) : item;
  }));
  return 'synced';
}

export async function deleteRemoteMaintenanceItem(item: MaintenanceItem): Promise<void> {
  if (!item.remoteId || !navigator.onLine) return;
  const supabase = createClient();
  if (!supabase) return;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await supabase
    .from('maintenance_items')
    .delete()
    .eq('id', item.remoteId)
    .eq('user_id', user.id);
}
