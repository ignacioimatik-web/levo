import 'server-only';

import { createClient } from '@/lib/supabase/server';
import type {
  ActivityPrivacy, RidePoint, RideWeatherSample, SegmentEffort,
} from './types';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface PublicActivity {
  id: string;
  userId: string;
  privacy: ActivityPrivacy;
  title: string;
  sportType: 'ebike' | 'mtb';
  startedAt: string;
  durationSeconds: number;
  movingSeconds: number;
  distanceM: number;
  elevationGainM: number;
  averageSpeedKmh: number;
  maxSpeedKmh: number;
  batteryStart: number | null;
  batteryEnd: number | null;
  batteryCapacityWh: number | null;
  assistMode: string | null;
  energyUsedWh: number | null;
  points: RidePoint[];
  weatherSamples: RideWeatherSample[];
  segmentEfforts: SegmentEffort[];
  riderName: string;
  bikeName: string | null;
}

interface ActivityRow {
  id: string;
  user_id: string;
  title: string;
  sport_type: string;
  started_at: string;
  duration_seconds: number;
  moving_seconds: number;
  distance_m: number;
  elevation_gain_m: number;
  average_speed_kmh: number;
  max_speed_kmh: number;
  battery_start: number | null;
  battery_end: number | null;
  battery_capacity_wh: number | null;
  assist_mode: string | null;
  energy_used_wh: number | null;
  route: unknown;
  weather_samples: unknown;
  privacy: string;
}

interface ProfileRow {
  display_name: string | null;
  bike_name: string | null;
}

function validPoint(value: unknown): value is RidePoint {
  if (!value || typeof value !== 'object') return false;
  const point = value as Partial<RidePoint>;
  return typeof point.latitude === 'number'
    && Number.isFinite(point.latitude)
    && point.latitude >= -90
    && point.latitude <= 90
    && typeof point.longitude === 'number'
    && Number.isFinite(point.longitude)
    && point.longitude >= -180
    && point.longitude <= 180
    && typeof point.accuracy === 'number'
    && typeof point.timestamp === 'number';
}

export async function getPublicActivity(id: string): Promise<PublicActivity | null> {
  if (!UUID_PATTERN.test(id)) return null;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('activities')
    .select('id,user_id,title,sport_type,started_at,duration_seconds,moving_seconds,distance_m,elevation_gain_m,average_speed_kmh,max_speed_kmh,battery_start,battery_end,battery_capacity_wh,assist_mode,energy_used_wh,route,weather_samples,privacy')
    .eq('id', id)
    .maybeSingle();
  if (error || !data) return null;
  const row = data as ActivityRow;

  const [{ data: profileData }, { data: effortData }] = await Promise.all([
    supabase
      .from('profiles')
      .select('display_name,bike_name')
      .eq('user_id', row.user_id)
      .maybeSingle(),
    supabase
      .from('segment_efforts')
      .select('segment_id,elapsed_seconds,started_at,ended_at,distance_m,average_speed_kmh,match_quality')
      .eq('activity_id', row.id)
      .order('started_at'),
  ]);
  const profile = profileData as ProfileRow | null;
  const effortRows = (effortData ?? []) as Array<{
    segment_id: string;
    elapsed_seconds: number;
    started_at: string;
    ended_at: string;
    distance_m: number;
    average_speed_kmh: number;
    match_quality: number;
  }>;

  return {
    id: row.id,
    userId: row.user_id,
    privacy: row.privacy === 'private'
      ? 'private'
      : row.privacy === 'followers'
        ? 'followers'
        : 'public',
    title: row.title,
    sportType: row.sport_type === 'mtb' ? 'mtb' : 'ebike',
    startedAt: row.started_at,
    durationSeconds: Math.max(0, row.duration_seconds),
    movingSeconds: Math.max(0, row.moving_seconds),
    distanceM: Math.max(0, row.distance_m),
    elevationGainM: Math.max(0, row.elevation_gain_m),
    averageSpeedKmh: Math.max(0, row.average_speed_kmh),
    maxSpeedKmh: Math.max(0, row.max_speed_kmh),
    batteryStart: row.battery_start,
    batteryEnd: row.battery_end,
    batteryCapacityWh: row.battery_capacity_wh,
    assistMode: row.assist_mode,
    energyUsedWh: row.energy_used_wh,
    points: Array.isArray(row.route) ? row.route.filter(validPoint) : [],
    weatherSamples: Array.isArray(row.weather_samples) ? row.weather_samples as RideWeatherSample[] : [],
    segmentEfforts: (effortRows ?? []).map((effort) => ({
      segmentId: effort.segment_id,
      elapsedSeconds: effort.elapsed_seconds,
      startedAt: effort.started_at,
      endedAt: effort.ended_at,
      distanceM: effort.distance_m,
      averageSpeedKmh: effort.average_speed_kmh,
      matchQuality: effort.match_quality,
    })),
    riderName: profile?.display_name?.trim() || 'Rider E-nduro',
    bikeName: profile?.bike_name?.trim() || null,
  };
}
