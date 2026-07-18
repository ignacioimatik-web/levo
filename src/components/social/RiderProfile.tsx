'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  Bike, CalendarDays, Loader2, MapPin, Mountain, Route, UsersRound,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/browser';
import type { ActivityPrivacy, RidePoint } from '@/lib/activities/types';
import FollowButton from './FollowButton';

interface Rider {
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
  bike_name: string | null;
  bio: string | null;
  home_region: string | null;
  rider_type: 'ebike' | 'mtb' | 'both';
}

interface RiderActivity {
  id: string;
  title: string;
  sport_type: string;
  started_at: string;
  distance_m: number;
  elevation_gain_m: number;
  duration_seconds: number;
  privacy: ActivityPrivacy;
  route_preview: RidePoint[];
}

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return hours ? `${hours} h ${minutes} min` : `${minutes} min`;
}

export default function RiderProfile({ riderId }: { riderId: string }) {
  const [rider, setRider] = useState<Rider | null>(null);
  const [activities, setActivities] = useState<RiderActivity[]>([]);
  const [followers, setFollowers] = useState(0);
  const [following, setFollowing] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    void (async () => {
      const supabase = createClient();
      if (!supabase) {
        if (active) setLoading(false);
        return;
      }
      const [
        { data: profile },
        { data: activityRows },
        { count: followerCount },
        { count: followingCount },
      ] = await Promise.all([
        supabase
          .from('profiles')
          .select('user_id,display_name,avatar_url,bike_name,bio,home_region,rider_type')
          .eq('user_id', riderId)
          .maybeSingle(),
        supabase
          .from('activities')
          .select('id,title,sport_type,started_at,distance_m,elevation_gain_m,duration_seconds,privacy,route_preview')
          .eq('user_id', riderId)
          .in('privacy', ['public', 'followers'])
          .order('started_at', { ascending: false })
          .limit(20),
        supabase
          .from('user_follows')
          .select('*', { count: 'exact', head: true })
          .eq('following_id', riderId),
        supabase
          .from('user_follows')
          .select('*', { count: 'exact', head: true })
          .eq('follower_id', riderId),
      ]);
      if (!active) return;
      setRider(profile as Rider | null);
      setActivities((activityRows ?? []) as RiderActivity[]);
      setFollowers(followerCount ?? 0);
      setFollowing(followingCount ?? 0);
      setLoading(false);
    })();
    return () => { active = false; };
  }, [riderId]);

  const totals = useMemo(() => activities.reduce((result, activity) => ({
    distance: result.distance + activity.distance_m,
    elevation: result.elevation + activity.elevation_gain_m,
  }), { distance: 0, elevation: 0 }), [activities]);

  if (loading) {
    return <main className="grid min-h-screen place-items-center bg-slate-950"><Loader2 className="h-7 w-7 animate-spin text-orange-400" /></main>;
  }
  if (!rider) {
    return (
      <main className="grid min-h-screen place-items-center bg-slate-950 px-6 text-center text-white">
        <div>
          <UsersRound className="mx-auto h-10 w-10 text-slate-600" />
          <h1 className="mt-4 text-2xl font-black">Rider no disponible</h1>
          <Link href="/comunidad" className="mt-6 inline-flex min-h-11 items-center rounded-xl bg-orange-500 px-5 text-xs font-black uppercase">Volver a Comunidad</Link>
        </div>
      </main>
    );
  }

  const name = rider.display_name?.trim() || 'Rider E-nduro';
  const riderType = rider.rider_type === 'ebike' ? 'E-bike' : rider.rider_type === 'mtb' ? 'MTB' : 'MTB + E-bike';

  return (
    <main className="min-h-screen bg-slate-950 pb-28 text-white md:pb-16">
      <div className="mx-auto max-w-6xl px-4 py-7 sm:px-6 md:py-12">
        <section className="overflow-hidden rounded-3xl border border-white/10 bg-[radial-gradient(circle_at_top_right,#7c2d12_0,transparent_38%),linear-gradient(135deg,#172033,#080d18)] p-5 sm:p-8">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
            {rider.avatar_url ? (
              <img src={rider.avatar_url} alt="" className="h-24 w-24 rounded-full border-2 border-orange-400/30 object-cover" />
            ) : (
              <div className="grid h-24 w-24 shrink-0 place-items-center rounded-full border-2 border-orange-400/30 bg-slate-900 text-3xl font-black text-orange-300">
                {name.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-orange-400">{riderType}</p>
                  <h1 className="mt-1 truncate text-3xl font-black sm:text-4xl">{name}</h1>
                </div>
                <FollowButton targetUserId={riderId} onChange={(isFollowing) => setFollowers((value) => Math.max(0, value + (isFollowing ? 1 : -1)))} />
              </div>
              {rider.bio && <p className="mt-4 max-w-2xl text-sm leading-relaxed text-slate-300">{rider.bio}</p>}
              <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-400">
                {rider.home_region && <span className="flex items-center gap-1.5"><MapPin className="h-4 w-4 text-orange-400" /> {rider.home_region}</span>}
                {rider.bike_name && <span className="flex items-center gap-1.5"><Bike className="h-4 w-4 text-orange-400" /> {rider.bike_name}</span>}
                <span><strong className="text-white">{followers}</strong> seguidores</span>
                <span><strong className="text-white">{following}</strong> siguiendo</span>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-5 grid grid-cols-3 gap-3">
          <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-4"><p className="text-[9px] font-black uppercase text-slate-500">Salidas visibles</p><p className="mt-2 text-2xl font-black">{activities.length}</p></div>
          <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-4"><p className="text-[9px] font-black uppercase text-slate-500">Distancia</p><p className="mt-2 text-2xl font-black">{(totals.distance / 1000).toFixed(0)}<span className="ml-1 text-xs text-slate-500">km</span></p></div>
          <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-4"><p className="text-[9px] font-black uppercase text-slate-500">Desnivel</p><p className="mt-2 text-2xl font-black">{Math.round(totals.elevation)}<span className="ml-1 text-xs text-slate-500">m+</span></p></div>
        </section>

        <section className="mt-8">
          <h2 className="text-xl font-black">Últimas salidas</h2>
          {activities.length === 0 ? (
            <div className="mt-4 rounded-3xl border border-dashed border-white/15 px-6 py-12 text-center text-sm text-slate-500">No hay actividades visibles para ti.</div>
          ) : (
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              {activities.map((activity) => (
                <Link key={activity.id} href={`/actividad/${activity.id}`} className="group rounded-2xl border border-white/10 bg-slate-900/60 p-5 transition hover:border-orange-500/30">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="truncate text-lg font-black group-hover:text-orange-300">{activity.title}</p>
                      <p className="mt-1 flex items-center gap-1.5 text-[10px] text-slate-500"><CalendarDays className="h-3.5 w-3.5" /> {new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium' }).format(new Date(activity.started_at))}</p>
                    </div>
                    <span className="rounded-full bg-slate-950 px-2.5 py-1 text-[9px] font-black uppercase text-slate-400">{activity.privacy === 'followers' ? 'Seguidores' : activity.sport_type}</span>
                  </div>
                  <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
                    <span className="flex items-center gap-1.5"><Route className="h-4 w-4 text-orange-400" /> {(activity.distance_m / 1000).toFixed(1)} km</span>
                    <span className="flex items-center gap-1.5"><Mountain className="h-4 w-4 text-orange-400" /> {Math.round(activity.elevation_gain_m)} m+</span>
                    <span>{formatDuration(activity.duration_seconds)}</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
