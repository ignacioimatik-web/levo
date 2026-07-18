'use client';

import { createClient } from '@/lib/supabase/browser';
import {
  getActivitiesDurable, getPendingActivityDeletes, removePendingActivityDelete,
  saveActivity, updateActivity,
} from './storage';
import type { AssistMode, RideActivity, RidePoint, SportType } from './types';

function buildRoutePreview(points: RidePoint[], maxPoints = 120): RidePoint[] {
  if (points.length <= maxPoints) return points;
  const step = (points.length - 1) / (maxPoints - 1);
  return Array.from({ length: maxPoints }, (_, index) => points[Math.round(index * step)]);
}

export async function syncActivity(activity: RideActivity): Promise<'synced' | 'local' | 'error'> {
  const supabase = createClient();
  if (!supabase || !navigator.onLine) return 'local';

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return 'local';

  updateActivity(activity.id, { syncStatus: 'syncing' });
  const { data, error } = await supabase
    .from('activities')
    .upsert({
      user_id: user.id,
      client_id: activity.id,
      title: activity.title,
      sport_type: activity.sportType,
      started_at: activity.startedAt,
      ended_at: activity.endedAt,
      duration_seconds: activity.durationSeconds,
      moving_seconds: activity.movingSeconds,
      distance_m: activity.distanceM,
      elevation_gain_m: activity.elevationGainM,
      average_speed_kmh: activity.averageSpeedKmh,
      max_speed_kmh: activity.maxSpeedKmh,
      battery_start: activity.batteryStart,
      battery_end: activity.batteryEnd,
      battery_capacity_wh: activity.batteryCapacityWh,
      assist_mode: activity.assistMode,
      energy_used_wh: activity.energyUsedWh,
      route: activity.points,
      route_preview: buildRoutePreview(activity.points),
      weather_samples: activity.weatherSamples ?? [],
      privacy: activity.privacy ?? 'private',
    }, { onConflict: 'user_id,client_id' })
    .select('id')
    .single();

  let segmentSyncFailed = false;
  if (!error && data?.id) {
    const { error: deleteEffortsError } = await supabase
      .from('segment_efforts')
      .delete()
      .eq('activity_id', data.id)
      .eq('user_id', user.id);
    segmentSyncFailed = Boolean(deleteEffortsError);
    if (!deleteEffortsError && (activity.segmentEfforts?.length ?? 0) > 0) {
      const { error: insertEffortsError } = await supabase
        .from('segment_efforts')
        .insert(activity.segmentEfforts!.map((effort) => ({
          activity_id: data.id,
          user_id: user.id,
          segment_id: effort.segmentId,
          sport_type: activity.sportType,
          elapsed_seconds: effort.elapsedSeconds,
          started_at: effort.startedAt,
          ended_at: effort.endedAt,
          distance_m: effort.distanceM,
          average_speed_kmh: effort.averageSpeedKmh,
          match_quality: effort.matchQuality,
        })));
      segmentSyncFailed = Boolean(insertEffortsError);
    }
  }

  const syncStatus = error || segmentSyncFailed ? 'error' : 'synced';
  updateActivity(activity.id, {
    syncStatus,
    remoteId: data?.id ?? activity.remoteId,
    remoteUserId: error ? activity.remoteUserId : user.id,
  });
  return syncStatus;
}

export async function flushPendingActivityDeletes(): Promise<{
  deleted: number;
  remaining: number;
}> {
  const pending = getPendingActivityDeletes();
  if (pending.length === 0) return { deleted: 0, remaining: 0 };
  const supabase = createClient();
  if (!supabase || !navigator.onLine) return { deleted: 0, remaining: pending.length };
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { deleted: 0, remaining: pending.length };

  let deleted = 0;
  for (const item of pending) {
    if (item.remoteUserId && item.remoteUserId !== user.id) continue;
    const { data, error } = await supabase
      .from('activities')
      .delete()
      .eq('id', item.remoteId)
      .eq('user_id', user.id)
      .select('id');
    const confirmed = !error && ((data?.length ?? 0) > 0 || item.remoteUserId === user.id);
    if (!confirmed) continue;
    removePendingActivityDelete(item.clientId);
    deleted += 1;
  }
  return { deleted, remaining: getPendingActivityDeletes().length };
}

export async function pullActivities(): Promise<number> {
  const supabase = createClient();
  if (!supabase || !navigator.onLine) return 0;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return 0;
  await flushPendingActivityDeletes();

  const { data, error } = await supabase
    .from('activities')
    .select('*')
    .eq('user_id', user.id)
    .order('started_at', { ascending: false })
    .limit(100);
  if (error || !data) return 0;

  const localIds = new Set((await getActivitiesDurable()).map((activity) => activity.id));
  const pendingIds = new Set(getPendingActivityDeletes().map((item) => item.clientId));
  const remoteActivityIds = data.map((row) => row.id);
  const { data: effortRows } = remoteActivityIds.length > 0
    ? await supabase
      .from('segment_efforts')
      .select('activity_id,segment_id,elapsed_seconds,started_at,ended_at,distance_m,average_speed_kmh,match_quality')
      .in('activity_id', remoteActivityIds)
    : { data: [] };
  const effortsByActivity = new Map<string, NonNullable<RideActivity['segmentEfforts']>>();
  for (const effort of effortRows ?? []) {
    const activityEfforts = effortsByActivity.get(effort.activity_id) ?? [];
    activityEfforts.push({
      segmentId: effort.segment_id,
      elapsedSeconds: effort.elapsed_seconds,
      startedAt: effort.started_at,
      endedAt: effort.ended_at,
      distanceM: effort.distance_m,
      averageSpeedKmh: effort.average_speed_kmh,
      matchQuality: effort.match_quality,
    });
    effortsByActivity.set(effort.activity_id, activityEfforts);
  }
  let imported = 0;
  for (const row of data) {
    if (localIds.has(row.client_id) || pendingIds.has(row.client_id)) continue;
    await saveActivity({
      id: row.client_id,
      remoteId: row.id,
      remoteUserId: user.id,
      title: row.title,
      sportType: row.sport_type as SportType,
      startedAt: row.started_at,
      endedAt: row.ended_at,
      durationSeconds: row.duration_seconds,
      movingSeconds: row.moving_seconds,
      distanceM: row.distance_m,
      elevationGainM: row.elevation_gain_m,
      averageSpeedKmh: row.average_speed_kmh,
      maxSpeedKmh: row.max_speed_kmh,
      batteryStart: row.battery_start,
      batteryEnd: row.battery_end,
      batteryCapacityWh: row.battery_capacity_wh,
      assistMode: row.assist_mode as AssistMode | null,
      energyUsedWh: row.energy_used_wh,
      points: row.route as RidePoint[],
      weatherSamples: Array.isArray(row.weather_samples) ? row.weather_samples : [],
      segmentEfforts: effortsByActivity.get(row.id) ?? [],
      privacy: row.privacy === 'public' || row.privacy === 'followers'
        ? row.privacy
        : 'private',
      syncStatus: 'synced',
    });
    imported += 1;
  }
  return imported;
}
