'use client';

import { createClient } from '@/lib/supabase/browser';
import type { SportType } from '@/lib/activities/types';

export interface SegmentLeaderboardEntry {
  rank: number;
  userId: string;
  riderName: string;
  bikeName: string | null;
  elapsedSeconds: number;
  averageSpeedKmh: number;
  startedAt: string;
  activityId: string;
  own: boolean;
}

interface EffortRow {
  activity_id: string;
  user_id: string;
  elapsed_seconds: number;
  average_speed_kmh: number;
  started_at: string;
}

interface ProfileRow {
  user_id: string;
  display_name: string | null;
  bike_name: string | null;
}

export async function loadSegmentLeaderboard(
  segmentId: string,
  sportType: SportType,
): Promise<SegmentLeaderboardEntry[]> {
  const supabase = createClient();
  if (!supabase) return [];
  const [{ data: effortRows, error }, { data: authData }] = await Promise.all([
    supabase
      .from('segment_efforts')
      .select('activity_id,user_id,elapsed_seconds,average_speed_kmh,started_at')
      .eq('segment_id', segmentId)
      .eq('sport_type', sportType)
      .order('elapsed_seconds', { ascending: true })
      .limit(200),
    supabase.auth.getUser(),
  ]);
  if (error || !effortRows) throw new Error('No hemos podido cargar la clasificación.');

  const bestByRider = new Map<string, EffortRow>();
  for (const row of effortRows as EffortRow[]) {
    const current = bestByRider.get(row.user_id);
    if (!current || row.elapsed_seconds < current.elapsed_seconds) bestByRider.set(row.user_id, row);
  }
  const bestRows = [...bestByRider.values()]
    .sort((a, b) => a.elapsed_seconds - b.elapsed_seconds)
    .slice(0, 50);
  if (bestRows.length === 0) return [];

  const { data: profileRows } = await supabase
    .from('profiles')
    .select('user_id,display_name,bike_name')
    .in('user_id', bestRows.map((row) => row.user_id));
  const profiles = new Map(
    ((profileRows ?? []) as ProfileRow[]).map((profile) => [profile.user_id, profile]),
  );
  const currentUserId = authData.user?.id ?? null;

  return bestRows.map((row, index) => {
    const profile = profiles.get(row.user_id);
    return {
      rank: index + 1,
      userId: row.user_id,
      riderName: profile?.display_name?.trim() || 'Rider E-nduro',
      bikeName: profile?.bike_name?.trim() || null,
      elapsedSeconds: row.elapsed_seconds,
      averageSpeedKmh: row.average_speed_kmh,
      startedAt: row.started_at,
      activityId: row.activity_id,
      own: row.user_id === currentUserId,
    };
  });
}
