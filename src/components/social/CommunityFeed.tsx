'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BatteryCharging, Bike, CalendarDays, Heart, Loader2, MessageCircle,
  Mountain, Send, Sparkles, Users,
} from 'lucide-react';
import type { User } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/browser';
import type { RidePoint } from '@/lib/activities/types';

interface FeedActivity {
  id: string;
  user_id: string;
  title: string;
  sport_type: string;
  started_at: string;
  duration_seconds: number;
  distance_m: number;
  elevation_gain_m: number;
  average_speed_kmh: number;
  battery_start: number | null;
  battery_end: number | null;
  assist_mode: string | null;
  route_preview: RidePoint[];
}

interface PublicProfile {
  user_id: string;
  display_name: string | null;
  bike_name: string | null;
}

interface Kudo {
  activity_id: string;
  user_id: string;
}

interface Comment {
  id: string;
  activity_id: string;
  user_id: string;
  body: string;
  created_at: string;
}

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor(seconds % 3600 / 60);
  return hours ? `${hours} h ${minutes} min` : `${minutes} min`;
}

function RouteSketch({ points }: { points: RidePoint[] }) {
  const path = useMemo(() => {
    if (points.length < 2) return '';
    const minLat = Math.min(...points.map((point) => point.latitude));
    const maxLat = Math.max(...points.map((point) => point.latitude));
    const minLng = Math.min(...points.map((point) => point.longitude));
    const maxLng = Math.max(...points.map((point) => point.longitude));
    const latRange = Math.max(maxLat - minLat, 0.0001);
    const lngRange = Math.max(maxLng - minLng, 0.0001);
    return points.map((point, index) => {
      const x = 6 + (point.longitude - minLng) / lngRange * 88;
      const y = 94 - (point.latitude - minLat) / latRange * 88;
      return `${index === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
    }).join(' ');
  }, [points]);

  return (
    <div className="relative h-56 overflow-hidden bg-[radial-gradient(circle_at_25%_15%,#334155,#0f172a_50%,#020617)]">
      <div className="absolute inset-0 opacity-20 [background-image:linear-gradient(#64748b_1px,transparent_1px),linear-gradient(90deg,#64748b_1px,transparent_1px)] [background-size:28px_28px]" />
      {path ? (
        <svg viewBox="0 0 100 100" className="relative h-full w-full p-6" role="img" aria-label="Trazado reducido de la actividad">
          <path d={path} fill="none" stroke="#fb923c" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : (
        <div className="relative grid h-full place-items-center text-xs text-slate-600">Sin vista previa del trazado</div>
      )}
    </div>
  );
}

export default function CommunityFeed() {
  const [activities, setActivities] = useState<FeedActivity[]>([]);
  const [profiles, setProfiles] = useState<Record<string, PublicProfile>>({});
  const [kudos, setKudos] = useState<Kudo[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [expandedComments, setExpandedComments] = useState<Set<string>>(new Set());
  const [sendingComment, setSendingComment] = useState<string | null>(null);

  const loadFeed = useCallback(async () => {
    const supabase = createClient();
    if (!supabase) {
      setError('La comunidad no está configurada en este entorno.');
      setLoading(false);
      return;
    }

    const { data: { user: currentUser } } = await supabase.auth.getUser();
    setUser(currentUser);

    const { data: activityRows, error: activityError } = await supabase
      .from('activities')
      .select('id,user_id,title,sport_type,started_at,duration_seconds,distance_m,elevation_gain_m,average_speed_kmh,battery_start,battery_end,assist_mode,route_preview')
      .eq('privacy', 'public')
      .order('started_at', { ascending: false })
      .limit(30);

    if (activityError) {
      setError('No hemos podido cargar la comunidad. Inténtalo de nuevo.');
      setLoading(false);
      return;
    }

    const feedActivities = (activityRows ?? []) as FeedActivity[];
    setActivities(feedActivities);
    const activityIds = feedActivities.map((activity) => activity.id);

    if (activityIds.length === 0) {
      setLoading(false);
      return;
    }

    const [{ data: kudoRows }, { data: commentRows }] = await Promise.all([
      supabase.from('activity_kudos').select('activity_id,user_id').in('activity_id', activityIds),
      supabase.from('activity_comments').select('id,activity_id,user_id,body,created_at').in('activity_id', activityIds).order('created_at'),
    ]);
    const feedComments = (commentRows ?? []) as Comment[];
    setKudos((kudoRows ?? []) as Kudo[]);
    setComments(feedComments);

    const userIds = [...new Set([
      ...feedActivities.map((activity) => activity.user_id),
      ...feedComments.map((comment) => comment.user_id),
    ])];
    const { data: profileRows } = await supabase
      .from('profiles')
      .select('user_id,display_name,bike_name')
      .in('user_id', userIds);
    setProfiles(Object.fromEntries(
      ((profileRows ?? []) as PublicProfile[]).map((profile) => [profile.user_id, profile]),
    ));
    setLoading(false);
  }, []);

  useEffect(() => {
    const initialLoad = window.setTimeout(() => { void loadFeed(); }, 0);
    return () => window.clearTimeout(initialLoad);
  }, [loadFeed]);

  const toggleKudo = async (activityId: string) => {
    if (!user) return;
    const supabase = createClient();
    if (!supabase) return;
    const existing = kudos.some((kudo) => kudo.activity_id === activityId && kudo.user_id === user.id);
    if (existing) {
      const previous = kudos;
      setKudos((items) => items.filter((kudo) => !(kudo.activity_id === activityId && kudo.user_id === user.id)));
      const { error: removeError } = await supabase.from('activity_kudos').delete().eq('activity_id', activityId).eq('user_id', user.id);
      if (removeError) setKudos(previous);
    } else {
      const optimistic = { activity_id: activityId, user_id: user.id };
      setKudos((items) => [...items, optimistic]);
      const { error: insertError } = await supabase.from('activity_kudos').insert(optimistic);
      if (insertError) setKudos((items) => items.filter((kudo) => kudo !== optimistic));
    }
  };

  const submitComment = async (activityId: string) => {
    const body = commentDrafts[activityId]?.trim();
    if (!user || !body) return;
    const supabase = createClient();
    if (!supabase) return;
    setSendingComment(activityId);
    const { data, error: commentError } = await supabase
      .from('activity_comments')
      .insert({ activity_id: activityId, user_id: user.id, body })
      .select('id,activity_id,user_id,body,created_at')
      .single();
    if (!commentError && data) {
      setComments((items) => [...items, data as Comment]);
      setCommentDrafts((drafts) => ({ ...drafts, [activityId]: '' }));
    }
    setSendingComment(null);
  };

  const toggleComments = (activityId: string) => {
    setExpandedComments((current) => {
      const next = new Set(current);
      if (next.has(activityId)) next.delete(activityId);
      else next.add(activityId);
      return next;
    });
  };

  return (
    <main className="min-h-screen bg-slate-950 pb-28 text-white md:pb-16">
      <div className="mx-auto max-w-3xl px-4 py-7 sm:px-6 md:py-12">
        <header className="mb-8 flex flex-wrap items-end justify-between gap-5">
          <div>
            <p className="mb-2 flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-orange-400">
              <Users className="h-4 w-4" /> Riders
            </p>
            <h1 className="text-3xl font-black tracking-tight sm:text-4xl">Comunidad</h1>
            <p className="mt-2 text-sm text-slate-400">Rutas, barro y vatios compartidos por la comunidad MTB.</p>
          </div>
          <Link href="/grabar" className="flex items-center gap-2 rounded-xl bg-orange-500 px-4 py-3 text-xs font-black uppercase">
            <Bike className="h-4 w-4" /> Compartir salida
          </Link>
        </header>

        {loading ? (
          <div className="grid min-h-72 place-items-center">
            <Loader2 className="h-7 w-7 animate-spin text-orange-400" />
          </div>
        ) : error ? (
          <div role="alert" className="rounded-2xl border border-red-500/20 bg-red-500/10 p-5 text-sm text-red-300">{error}</div>
        ) : activities.length === 0 ? (
          <section className="rounded-3xl border border-dashed border-white/15 bg-slate-900/30 px-6 py-16 text-center">
            <Sparkles className="mx-auto h-9 w-9 text-orange-400" />
            <h2 className="mt-4 text-xl font-black">Abre la primera huella</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-slate-400">Termina una salida, elige “Comunidad” y aparecerá aquí cuando la sincronices con tu cuenta.</p>
            <Link href={user ? '/grabar' : '/auth?next=/comunidad'} className="mt-6 inline-flex rounded-xl bg-orange-500 px-5 py-3 text-xs font-black uppercase">
              {user ? 'Grabar salida' : 'Iniciar sesión'}
            </Link>
          </section>
        ) : (
          <section className="space-y-5">
            {activities.map((activity) => {
              const profile = profiles[activity.user_id];
              const displayName = profile?.display_name || 'Rider E-nduro';
              const activityKudos = kudos.filter((kudo) => kudo.activity_id === activity.id);
              const activityComments = comments.filter((comment) => comment.activity_id === activity.id);
              const liked = user ? activityKudos.some((kudo) => kudo.user_id === user.id) : false;
              const commentsOpen = expandedComments.has(activity.id);

              return (
                <article key={activity.id} className="overflow-hidden rounded-3xl border border-white/10 bg-slate-900/60">
                  <header className="flex items-center gap-3 p-4 sm:p-5">
                    <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-orange-500/15 text-sm font-black text-orange-300">
                      {displayName.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-black">{displayName}</p>
                      <p className="mt-0.5 flex items-center gap-1.5 text-[10px] text-slate-500">
                        <CalendarDays className="h-3 w-3" />
                        {new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(activity.started_at))}
                        {profile?.bike_name && <> · {profile.bike_name}</>}
                      </p>
                    </div>
                    <span className="rounded-full bg-slate-950 px-2.5 py-1 text-[9px] font-black uppercase text-slate-400">
                      {activity.sport_type === 'ebike' ? 'E-bike' : 'MTB'}
                    </span>
                  </header>

                  <Link href={`/actividad/${activity.id}`} aria-label={`Abrir ${activity.title}`}>
                    <RouteSketch points={activity.route_preview ?? []} />
                  </Link>

                  <div className="p-4 sm:p-5">
                    <h2 className="text-xl font-black">
                      <Link href={`/actividad/${activity.id}`} className="hover:text-orange-400">{activity.title}</Link>
                    </h2>
                    <div className="mt-4 grid grid-cols-4 gap-2 rounded-2xl bg-slate-950/60 p-3">
                      <div><p className="text-[8px] uppercase text-slate-600">Distancia</p><p className="mt-1 text-sm font-black">{(activity.distance_m / 1000).toFixed(1)} km</p></div>
                      <div><p className="text-[8px] uppercase text-slate-600">Desnivel</p><p className="mt-1 text-sm font-black">{Math.round(activity.elevation_gain_m)} m</p></div>
                      <div><p className="text-[8px] uppercase text-slate-600">Tiempo</p><p className="mt-1 text-sm font-black">{formatDuration(activity.duration_seconds)}</p></div>
                      <div><p className="text-[8px] uppercase text-slate-600">Media</p><p className="mt-1 text-sm font-black">{activity.average_speed_kmh.toFixed(1)}</p></div>
                    </div>

                    {activity.sport_type === 'ebike' && (
                      <p className="mt-3 flex items-center gap-2 text-xs font-bold text-emerald-400">
                        <BatteryCharging className="h-4 w-4" />
                        {activity.battery_start}% → {activity.battery_end}% · {activity.assist_mode}
                      </p>
                    )}

                    <div className="mt-4 flex items-center gap-2 border-t border-white/5 pt-4">
                      {user ? (
                        <button
                          onClick={() => toggleKudo(activity.id)}
                          aria-pressed={liked}
                          className={`flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-black ${liked ? 'bg-orange-500/15 text-orange-400' : 'text-slate-500 hover:bg-white/5 hover:text-white'}`}
                        >
                          <Heart className={`h-4 w-4 ${liked ? 'fill-current' : ''}`} /> {activityKudos.length}
                        </button>
                      ) : (
                        <Link href="/auth?next=/comunidad" className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-black text-slate-500 hover:text-orange-400">
                          <Heart className="h-4 w-4" /> {activityKudos.length}
                        </Link>
                      )}
                      <button onClick={() => toggleComments(activity.id)} className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-black text-slate-500 hover:bg-white/5 hover:text-white">
                        <MessageCircle className="h-4 w-4" /> {activityComments.length}
                      </button>
                      <span className="ml-auto flex items-center gap-1 text-[9px] uppercase tracking-widest text-slate-600">
                        <Mountain className="h-3 w-3" /> Público
                      </span>
                    </div>

                    {commentsOpen && (
                      <div className="mt-3 space-y-3 rounded-2xl bg-slate-950/50 p-3">
                        {activityComments.length === 0 && <p className="py-2 text-center text-xs text-slate-600">Todavía no hay comentarios.</p>}
                        {activityComments.map((comment) => (
                          <div key={comment.id} className="flex gap-2">
                            <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-slate-800 text-[9px] font-black">
                              {(profiles[comment.user_id]?.display_name || 'R').charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <p className="text-[10px] font-black text-slate-300">{profiles[comment.user_id]?.display_name || 'Rider'}</p>
                              <p className="mt-0.5 text-xs leading-relaxed text-slate-400">{comment.body}</p>
                            </div>
                          </div>
                        ))}
                        {user ? (
                          <form onSubmit={(event) => { event.preventDefault(); void submitComment(activity.id); }} className="flex gap-2 border-t border-white/5 pt-3">
                            <label htmlFor={`comment-${activity.id}`} className="sr-only">Comentar en {activity.title}</label>
                            <input
                              id={`comment-${activity.id}`}
                              value={commentDrafts[activity.id] ?? ''}
                              onChange={(event) => setCommentDrafts((drafts) => ({ ...drafts, [activity.id]: event.target.value }))}
                              maxLength={500}
                              placeholder="Escribe un comentario…"
                              className="min-w-0 flex-1 rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-xs outline-none focus:border-orange-500"
                            />
                            <button disabled={sendingComment === activity.id || !commentDrafts[activity.id]?.trim()} className="grid h-9 w-9 place-items-center rounded-xl bg-orange-500 text-white disabled:opacity-40" aria-label="Enviar comentario">
                              {sendingComment === activity.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                            </button>
                          </form>
                        ) : (
                          <Link href="/auth?next=/comunidad" className="block border-t border-white/5 pt-3 text-center text-xs font-bold text-orange-400">Inicia sesión para comentar</Link>
                        )}
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
          </section>
        )}
      </div>
    </main>
  );
}
